const express = require('express');
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logoutAll,
  getSessions,
  revokeSession,
  logout,
  validateToken,
} = require('../controllers/authController');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} = require('../validations/schemas/authSchemas');

const router = express.Router();

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public (TODO: Restrict to admin in production)
 */
router.post('/register', validate(registerSchema), register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validate(loginSchema), login);

// ============================================
// PROTECTED ROUTES
// ============================================

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', protect, getMe);

/**
 * @route   GET /api/v1/auth/validate-token
 * @desc    Validate current JWT token
 * @access  Private
 */
router.get('/validate-token', protect, validateToken);

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', protect, validate(updateProfileSchema), updateProfile);

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Change user password (keeps current session, revokes others)
 * @access  Private
 */
router.put('/change-password', protect, validate(changePasswordSchema), changePassword);

// ============================================
// SESSION MANAGEMENT ROUTES
// ============================================

/**
 * @route   GET /api/v1/auth/sessions
 * @desc    Get all active sessions for current user
 * @access  Private
 */
router.get('/sessions', protect, getSessions);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout from current device only
 * @access  Private
 */
router.post('/logout', protect, logout);

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post('/logout-all', protect, logoutAll);

/**
 * @route   DELETE /api/v1/auth/sessions/:sessionId
 * @desc    Revoke specific session (logout from specific device)
 * @access  Private
 */
router.delete('/sessions/:sessionId', protect, revokeSession);

module.exports = router;