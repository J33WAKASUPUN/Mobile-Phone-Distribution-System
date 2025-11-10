const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ApiError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Protect routes - Verify JWT token
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return next(new ApiError(401, 'Not authorized. Please login.'));
    }

    try {
      // Verify token with proper error handling
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Log decoded token for debugging
      logger.debug(`Token decoded: ${JSON.stringify({
        id: decoded.id,
        role: decoded.role,
        iat: decoded.iat,
        exp: decoded.exp
      })}`);

      // Get user from token (don't select password)
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        logger.warn(`Token validation failed: User not found for ID ${decoded.id}`);
        return next(new ApiError(401, 'User not found. Token is invalid.'));
      }

      // Check if user is active
      if (!user.isActive) {
        logger.warn(`Inactive user attempted access: ${user.email}`);
        return next(new ApiError(403, 'Your account has been deactivated. Please contact administrator.'));
      }

      // Check if token was issued before last login (single session)
      if (user.isTokenOutdated(decoded.iat)) {
        logger.warn(`Outdated token used by: ${user.email}. User logged in again from another device.`);
        return next(
          new ApiError(401, 'This session has been invalidated. Please login again.')
        );
      }

      // Check if password was changed after token was issued
      if (user.passwordChangedAt && user.changedPasswordAfter(decoded.iat)) {
        logger.warn(`Password changed after token issue: ${user.email}`);
        return next(
          new ApiError(401, 'Password was recently changed. Please login again.')
        );
      }

      // Attach full user object to request
      req.user = user;
      
      // Log successful authentication
      logger.debug(`User authenticated: ${user.email} (${user.role})`);
      
      next();
    } catch (error) {
      // Better error handling for JWT errors
      if (error.name === 'TokenExpiredError') {
        logger.warn(`Expired token attempt: ${error.message}`);
        return next(new ApiError(401, 'Token expired. Please login again.'));
      }
      if (error.name === 'JsonWebTokenError') {
        logger.warn(`Invalid token attempt: ${error.message}`);
        return next(new ApiError(401, 'Invalid token. Please login again.'));
      }
      logger.error(`Token verification error: ${error.message}`);
      throw error;
    }
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    next(error);
  }
};

/**
 * Authorize specific roles
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authorized. Please login first.'));
    }

    // Log authorization attempt
    logger.debug(`Authorization check: User ${req.user.email} (${req.user.role}) attempting to access route requiring [${roles.join(', ')}]`);

    if (!roles.includes(req.user.role)) {
      logger.warn(
        `Unauthorized access attempt by ${req.user.email} (${req.user.role}) to ${req.originalUrl}. Required roles: [${roles.join(', ')}]`
      );
      return next(
        new ApiError(
          403,
          `Access denied. User role '${req.user.role}' is not authorized. Required roles: ${roles.join(', ')}`
        )
      );
    }

    logger.debug(`Authorization successful for ${req.user.email} (${req.user.role})`);
    next();
  };
};

module.exports = {
  protect,
  authorize,
};