const User = require('../models/User');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const UAParser = require('ua-parser-js');

/**
 * Register a new user
 * @route POST /api/v1/auth/register
 * @access Public (but should be restricted in production to admin only)
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, phone, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return next(new ApiError(400, 'User with this email or username already exists'));
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      phone,
      role: role || 'dsr', // Default to DSR role
      createdBy: req.user?._id, // If admin is creating user
    });

    // Generate JWT token
    const token = user.generateAuthToken();

    logger.info(`New user registered: ${user.email} (${user.role})`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.getPublicProfile(),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Extract device info from request
 */
const getDeviceInfo = (req) => {
  const parser = new UAParser(req.headers['user-agent']);
  const result = parser.getResult();

  return {
    userAgent: req.headers['user-agent'] || 'Unknown',
    browser: result.browser.name || 'Unknown Browser',
    os: result.os.name || 'Unknown OS',
    device: result.device.type || 'Desktop',
    ip: req.ip || req.connection.remoteAddress || 'Unknown IP',
  };
};

/**
 * Login user (UPDATED with multi-device support)
 * @route POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { credential, password } = req.body;

    if (!credential || !password) {
      return next(new ApiError(400, 'Please provide email/username and password'));
    }

    // Find user
    const user = await User.findByCredentials(credential);

    if (!user) {
      logger.warn(`Failed login attempt: User not found for credential ${credential}`);
      return next(new ApiError(401, 'Invalid credentials'));
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      logger.warn(`Failed login attempt: Invalid password for user ${user.email}`);
      return next(new ApiError(401, 'Invalid credentials'));
    }

    // Check if account is active
    if (!user.isActive) {
      logger.warn(`Inactive account login attempt: ${user.email}`);
      return next(new ApiError(403, 'Your account has been deactivated.'));
    }

    // Extract device info
    const deviceInfo = getDeviceInfo(req);

    // Generate new token with session ID
    const { token, sessionId, expiresAt } = user.generateAuthToken(deviceInfo);

    // Add session to user (auto-removes oldest if >3 sessions)
    await user.addSession(token, sessionId, expiresAt, deviceInfo);

    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    logger.info(
      `User logged in: ${user.email} (${user.role}) - Device: ${deviceInfo.device} (${deviceInfo.browser} on ${deviceInfo.os}) - Active sessions: ${user.activeSessions.length}/3`
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.getPublicProfile(),
        token,
        sessionId,
        deviceInfo: {
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          device: deviceInfo.device,
        },
        activeSessions: user.activeSessions.length,
        maxSessions: 3,
        tokenExpiry: process.env.JWT_EXPIRE || '7d',
      },
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    next(error);
  }
};

/**
 * Get active sessions
 * @route GET /api/v1/auth/sessions
 */
const getSessions = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }

    const sessions = user.getActiveSessions();

    res.status(200).json({
      success: true,
      data: {
        totalSessions: sessions.length,
        maxSessions: 3,
        currentSessionId: req.sessionId,
        sessions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 * @route GET /api/v1/auth/me
 * @access Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }

    res.status(200).json({
      success: true,
      data: {
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * @route PUT /api/v1/auth/profile
 * @access Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, address } = req.body;

    // Fields that can be updated
    const allowedUpdates = {
      firstName,
      lastName,
      phone,
      address,
      updatedBy: req.user._id,
    };

    // Remove undefined fields
    Object.keys(allowedUpdates).forEach(
      (key) => allowedUpdates[key] === undefined && delete allowedUpdates[key]
    );

    const user = await User.findByIdAndUpdate(
      req.user._id,
      allowedUpdates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }

    logger.info(`User profile updated: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password (revoke all sessions except current)
 * @route PUT /api/v1/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(new ApiError(400, 'Please provide current and new passwords'));
    }

    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }

    // Verify current password
    const isPasswordMatch = await user.comparePassword(currentPassword);

    if (!isPasswordMatch) {
      return next(new ApiError(401, 'Current password is incorrect'));
    }

    // Update password
    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    
    // Revoke all sessions except current
    const currentSessionId = req.sessionId;
    user.activeSessions = user.activeSessions.filter(
      session => session.sessionId === currentSessionId
    );

    await user.save();

    logger.info(`Password changed for ${user.email}. All other sessions revoked.`);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. All other devices have been logged out.',
      data: {
        user: user.getPublicProfile(),
        remainingSessions: 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout (revoke current session only)
 * @route POST /api/v1/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }

    // Revoke current session only
    await user.revokeSession(req.sessionId);

    logger.info(`User logged out from current device: ${req.user.email} - Session: ${req.sessionId}`);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully from this device',
      data: {
        remainingSessions: user.activeSessions.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout from all devices
 * @route POST /api/v1/auth/logout-all
 */
const logoutAll = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }

    // Revoke all sessions
    await user.revokeAllSessions();

    logger.info(`User logged out from all devices: ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully from all devices',
      data: {
        sessionsRevoked: user.activeSessions.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke specific session
 * @route DELETE /api/v1/auth/sessions/:sessionId
 */
const revokeSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }

    // Check if session exists
    const session = user.activeSessions.find(s => s.sessionId === sessionId);

    if (!session) {
      return next(new ApiError(404, 'Session not found'));
    }

    // Revoke session
    await user.revokeSession(sessionId);

    logger.info(`Session revoked by ${req.user.email}: ${sessionId}`);

    res.status(200).json({
      success: true,
      message: 'Session revoked successfully',
      data: {
        remainingSessions: user.activeSessions.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validate current token
 * @route GET /api/v1/auth/validate-token
 * @access Private
 */
const validateToken = async (req, res, next) => {
  try {
    // If we reach here, token is valid (protect middleware already validated it)
    res.status(200).json({
      success: true,
      message: 'Token is valid',
      data: {
        user: req.user.getPublicProfile(),
        tokenValid: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
  logoutAll,
  getSessions,
  revokeSession, 
  validateToken,
};