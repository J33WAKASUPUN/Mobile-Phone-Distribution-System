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
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new ApiError(401, 'User not found. Token is invalid.'));
      }

      // Check if user is active
      if (!user.isActive) {
        return next(new ApiError(403, 'Your account has been deactivated.'));
      }

      // Check if password was changed after token was issued
      if (user.changedPasswordAfter(decoded.iat)) {
        return next(
          new ApiError(401, 'Password was recently changed. Please login again.')
        );
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(new ApiError(401, 'Token expired. Please login again.'));
      }
      if (error.name === 'JsonWebTokenError') {
        return next(new ApiError(401, 'Invalid token. Please login again.'));
      }
      throw error;
    }
  } catch (error) {
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
      return next(new ApiError(401, 'Not authorized'));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(
        `Unauthorized access attempt by ${req.user.email} (${req.user.role}) to ${req.originalUrl}`
      );
      return next(
        new ApiError(
          403,
          `User role '${req.user.role}' is not authorized to access this route`
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