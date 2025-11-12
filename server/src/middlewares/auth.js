const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ApiError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Protect routes - Verify JWT token with session validation
 */
const protect = async (req, res, next) => {
  try {
    let token;

    console.log('='.repeat(80));
    console.log('🔍 AUTH DEBUG - SESSION VALIDATION');
    console.log('='.repeat(80));

    // Check for token in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
      console.log('✅ Token found in Authorization header');
    } else {
      console.log('❌ No valid Authorization header found');
      return next(new ApiError(401, 'Not authorized. Please login.'));
    }

    if (!token) {
      console.log('❌ TOKEN NOT FOUND');
      return next(new ApiError(401, 'Not authorized. Please login.'));
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      console.log('✅ Token verified successfully');
      console.log('📋 Decoded token:', JSON.stringify({
        id: decoded.id,
        sessionId: decoded.sessionId,
        role: decoded.role,
        iat: decoded.iat,
        exp: decoded.exp
      }, null, 2));

      // Get user (don't select password but do select activeSessions)
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        console.log('❌ User not found for ID:', decoded.id);
        return next(new ApiError(401, 'User not found. Token is invalid.'));
      }

      console.log('✅ User found:', user.email, '(', user.role, ')');

      // Check if user is active
      if (!user.isActive) {
        console.log('❌ User is inactive:', user.email);
        return next(new ApiError(403, 'Your account has been deactivated.'));
      }

      // Validate session
      if (!decoded.sessionId) {
        console.log('❌ No sessionId in token (old token format)');
        return next(new ApiError(401, 'Invalid token format. Please login again.'));
      }

      if (!user.isSessionValid(decoded.sessionId)) {
        console.log('❌ Session is invalid or expired:', decoded.sessionId);
        return next(new ApiError(401, 'Session expired or invalid. Please login again.'));
      }

      console.log('✅ Session is valid:', decoded.sessionId);

      // Update session activity timestamp
      await user.updateSessionActivity(decoded.sessionId);

      // Check if password was changed after token was issued
      if (user.passwordChangedAt && user.changedPasswordAfter(decoded.iat)) {
        console.log('❌ Password changed after token was issued');
        return next(
          new ApiError(401, 'Password was recently changed. Please login again.')
        );
      }

      // Attach user and sessionId to request
      req.user = user;
      req.sessionId = decoded.sessionId;
      
      console.log('✅ Authentication successful for:', user.email, '(', user.role, ')');
      console.log('🔑 Active sessions:', user.activeSessions.length, '/ 3');
      console.log('='.repeat(80));
      
      logger.debug(`User authenticated: ${user.email} (${user.role}) - Session: ${decoded.sessionId}`);
      
      next();
    } catch (error) {
      console.log('❌ JWT Verification Error:', error.name, '-', error.message);
      
      if (error.name === 'TokenExpiredError') {
        return next(new ApiError(401, 'Token expired. Please login again.'));
      }
      if (error.name === 'JsonWebTokenError') {
        return next(new ApiError(401, 'Invalid token. Please login again.'));
      }
      throw error;
    }
  } catch (error) {
    console.log('❌ Auth Middleware Error:', error.message);
    console.log('='.repeat(80));
    logger.error(`Auth middleware error: ${error.message}`);
    next(error);
  }
};

/**
 * Authorize specific roles (unchanged)
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authorized. Please login first.'));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(
        `Unauthorized access attempt by ${req.user.email} (${req.user.role}) to ${req.originalUrl}`
      );
      return next(
        new ApiError(
          403,
          `Access denied. User role '${req.user.role}' is not authorized.`
        )
      );
    }

    next();
  };
};

module.exports = {
  protect,
  authorize,
};