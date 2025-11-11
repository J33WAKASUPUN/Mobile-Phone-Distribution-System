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

    // 🔍 DEBUG: Log request headers
    console.log('='.repeat(80));
    console.log('🔍 AUTH DEBUG - REQUEST DETAILS');
    console.log('='.repeat(80));
    console.log('📍 URL:', req.originalUrl);
    console.log('📍 Method:', req.method);
    console.log('📍 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('='.repeat(80));

    // Check for token in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
      console.log('✅ Token found in Authorization header');
      console.log('🔑 Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'NONE');
    } else {
      console.log('❌ No valid Authorization header found');
      console.log('📋 Authorization header value:', req.headers.authorization);
    }

    // Check if token exists
    if (!token) {
      console.log('❌ TOKEN NOT FOUND - Sending 401 error');
      console.log('='.repeat(80));
      return next(new ApiError(401, 'Not authorized. Please login.'));
    }

    try {
      // Verify token with proper error handling
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      console.log('✅ Token verified successfully');
      console.log('📋 Decoded token:', JSON.stringify({
        id: decoded.id,
        role: decoded.role,
        iat: decoded.iat,
        exp: decoded.exp
      }, null, 2));

      // Get user from token (don't select password)
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        console.log('❌ User not found for ID:', decoded.id);
        logger.warn(`Token validation failed: User not found for ID ${decoded.id}`);
        return next(new ApiError(401, 'User not found. Token is invalid.'));
      }

      console.log('✅ User found:', user.email, '(', user.role, ')');

      // Check if user is active
      if (!user.isActive) {
        console.log('❌ User is inactive:', user.email);
        logger.warn(`Inactive user attempted access: ${user.email}`);
        return next(new ApiError(403, 'Your account has been deactivated. Please contact administrator.'));
      }

      // Check if token was issued before last login (single session)
      if (user.isTokenOutdated(decoded.iat)) {
        console.log('❌ Token is outdated (issued before last login)');
        logger.warn(`Outdated token used by: ${user.email}. User logged in again from another device.`);
        return next(
          new ApiError(401, 'This session has been invalidated. Please login again.')
        );
      }

      // Check if password was changed after token was issued
      if (user.passwordChangedAt && user.changedPasswordAfter(decoded.iat)) {
        console.log('❌ Password changed after token was issued');
        logger.warn(`Password changed after token issue: ${user.email}`);
        return next(
          new ApiError(401, 'Password was recently changed. Please login again.')
        );
      }

      // Attach full user object to request
      req.user = user;
      
      console.log('✅ Authentication successful for:', user.email, '(', user.role, ')');
      console.log('='.repeat(80));
      
      // Log successful authentication
      logger.debug(`User authenticated: ${user.email} (${user.role})`);
      
      next();
    } catch (error) {
      // Better error handling for JWT errors
      console.log('❌ JWT Verification Error:', error.name, '-', error.message);
      
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
    console.log('❌ Auth Middleware Error:', error.message);
    console.log('='.repeat(80));
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
    console.log('🔐 Authorization check:', req.user.email, '(', req.user.role, ') accessing route requiring [', roles.join(', '), ']');

    if (!roles.includes(req.user.role)) {
      console.log('❌ Authorization failed - Role not allowed');
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

    console.log('✅ Authorization successful');
    logger.debug(`Authorization successful for ${req.user.email} (${req.user.role})`);
    next();
  };
};

module.exports = {
  protect,
  authorize,
};