const User = require('../models/User');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Get all users
 * @route GET /api/v1/users
 * @access Private (Owner only)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      isActive,
      search,
    } = req.query;

    // Build filter object
    const filter = {};

    if (role) {
      filter.role = role;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .select('-password')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        users: users.map(user => user.getPublicProfile()),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get users by role
 * @route GET /api/v1/users/role/:role
 * @access Private (Owner only)
 */
const getUsersByRole = async (req, res, next) => {
  try {
    const { role } = req.params;

    // Validate role
    const validRoles = ['owner', 'dsr', 'backoffice', 'warehouse'];
    if (!validRoles.includes(role)) {
      return next(new ApiError(400, 'Invalid role'));
    }

    const users = await User.find({ role, isActive: true })
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        role,
        count: users.length,
        users: users.map(user => user.getPublicProfile()),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID
 * @route GET /api/v1/users/:id
 * @access Private (Owner only)
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

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
 * Create new user (Owner only)
 * @route POST /api/v1/users
 * @access Private (Owner only)
 */
const createUser = async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, phone, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return next(new ApiError(400, 'User with this email or username already exists'));
    }

    // Prevent creating another owner
    if (role === 'owner') {
      return next(new ApiError(403, 'Cannot create another owner account'));
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      phone,
      role,
      createdBy: req.user._id,
    });

    logger.info(`New user created by ${req.user.email}: ${user.email} (${user.role})`);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user
 * @route PUT /api/v1/users/:id
 * @access Private (Owner only)
 */
const updateUser = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, address, role } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }

    // Prevent changing owner role
    if (user.role === 'owner' && role && role !== 'owner') {
      return next(new ApiError(403, 'Cannot change owner role'));
    }

    // Prevent creating another owner
    if (role === 'owner' && user.role !== 'owner') {
      return next(new ApiError(403, 'Cannot change role to owner'));
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (role) user.role = role;
    user.updatedBy = req.user._id;

    await user.save({ validateBeforeSave: true });

    logger.info(`User updated by ${req.user.email}: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user (soft delete)
 * @route DELETE /api/v1/users/:id
 * @access Private (Owner only)
 */
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }

    // Prevent deleting owner
    if (user.role === 'owner') {
      return next(new ApiError(403, 'Cannot delete owner account'));
    }

    // Prevent self-deletion
    if (user._id.toString() === req.user._id.toString()) {
      return next(new ApiError(403, 'Cannot delete your own account'));
    }

    await User.findByIdAndDelete(req.params.id);

    logger.info(`User deleted by ${req.user.email}: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Activate user
 * @route PATCH /api/v1/users/:id/activate
 * @access Private (Owner only)
 */
const activateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }

    if (user.isActive) {
      return next(new ApiError(400, 'User is already active'));
    }

    user.isActive = true;
    user.updatedBy = req.user._id;
    await user.save({ validateBeforeSave: false });

    logger.info(`User activated by ${req.user.email}: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'User activated successfully',
      data: {
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate user
 * @route PATCH /api/v1/users/:id/deactivate
 * @access Private (Owner only)
 */
const deactivateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }

    // Prevent deactivating owner
    if (user.role === 'owner') {
      return next(new ApiError(403, 'Cannot deactivate owner account'));
    }

    // Prevent self-deactivation
    if (user._id.toString() === req.user._id.toString()) {
      return next(new ApiError(403, 'Cannot deactivate your own account'));
    }

    if (!user.isActive) {
      return next(new ApiError(400, 'User is already inactive'));
    }

    user.isActive = false;
    user.updatedBy = req.user._id;
    await user.save({ validateBeforeSave: false });

    logger.info(`User deactivated by ${req.user.email}: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
      data: {
        user: user.getPublicProfile(),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  getUsersByRole,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
};