const express = require('express');
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
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

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user (Owner only)
 * @access  Private (Owner role only)
 */
router.post('/register', protect, authorize('owner'), validate(registerSchema), register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user (All roles)
 * @access  Public
 */
router.post('/login', validate(loginSchema), login);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', protect, getMe);

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', protect, validate(updateProfileSchema), updateProfile);

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', protect, validate(changePasswordSchema), changePassword);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', protect, logout);

module.exports = router;