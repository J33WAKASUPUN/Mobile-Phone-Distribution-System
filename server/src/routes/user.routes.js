const express = require('express');
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  getUsersByRole,
} = require('../controllers/userController');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  createUserSchema,
  updateUserSchema,
} = require('../validations/schemas/userSchemas');

const router = express.Router();

// All routes require Owner role
router.use(protect, authorize('owner'));

/**
 * @route   GET /api/v1/users
 * @desc    Get all users (Owner only)
 * @access  Private (Owner)
 */
router.get('/', getAllUsers);

/**
 * @route   GET /api/v1/users/role/:role
 * @desc    Get users by role (Owner only)
 * @access  Private (Owner)
 */
router.get('/role/:role', getUsersByRole);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID (Owner only)
 * @access  Private (Owner)
 */
router.get('/:id', getUserById);

/**
 * @route   POST /api/v1/users
 * @desc    Create new user (Owner only)
 * @access  Private (Owner)
 */
router.post('/', validate(createUserSchema), createUser);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update user (Owner only)
 * @access  Private (Owner)
 */
router.put('/:id', validate(updateUserSchema), updateUser);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete user (Owner only)
 * @access  Private (Owner)
 */
router.delete('/:id', deleteUser);

/**
 * @route   PATCH /api/v1/users/:id/activate
 * @desc    Activate user account (Owner only)
 * @access  Private (Owner)
 */
router.patch('/:id/activate', activateUser);

/**
 * @route   PATCH /api/v1/users/:id/deactivate
 * @desc    Deactivate user account (Owner only)
 * @access  Private (Owner)
 */
router.patch('/:id/deactivate', deactivateUser);

module.exports = router;