const User = require('../models/User');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

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
 * Login user
 * @route POST /api/v1/auth/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { credential, password } = req.body;

    // Validate input
    if (!credential || !password) {
      return next(new ApiError(400, 'Please provide email/username and password'));
    }

    // Find user by email or username (with password field)
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
      return next(new ApiError(403, 'Your account has been deactivated. Please contact administrator.'));
    }

    // Update last login timestamp
    user.lastLogin = Date.now();
    
    // Update lastTokenIssuedAt to invalidate old tokens
    user.lastTokenIssuedAt = Date.now();
    
    await user.save({ validateBeforeSave: false });

    // Generate fresh JWT token (old tokens are now invalid)
    const token = user.generateAuthToken();

    logger.info(`User logged in successfully: ${user.email} (${user.role}). Old sessions invalidated.`);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.getPublicProfile(),
        token,
        tokenExpiry: process.env.JWT_EXPIRE || '7d',
      },
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
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
 * Change password
 * @route PUT /api/v1/auth/change-password
 * @access Private
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(new ApiError(400, 'Please provide current and new password'));
    }

    // Get user with password field
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }

    // Verify current password
    const isPasswordMatch = await user.comparePassword(currentPassword);

    if (!isPasswordMatch) {
      logger.warn(`Failed password change attempt for user: ${user.email}`);
      return next(new ApiError(401, 'Current password is incorrect'));
    }

    // Update password (this will trigger pre-save hook to hash it)
    user.password = newPassword;
    
    // Set passwordChangedAt to NOW to invalidate old tokens
    user.passwordChangedAt = Date.now();
    
    await user.save();

    // Generate new token with updated timestamp
    const token = user.generateAuthToken();

    logger.info(`Password changed successfully for user: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please use the new token for future requests.',
      data: {
        token,
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    logger.error(`Password change error: ${error.message}`);
    next(error);
  }
};

/**
 * Logout user (client-side token removal)
 * @route POST /api/v1/auth/logout
 * @access Private
 */
const logout = async (req, res, next) => {
  try {
    logger.info(`User logged out: ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: 'Logout successful',
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
  validateToken,
};