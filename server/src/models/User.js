const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * User Schema
 * Supports 3 roles: Owner, DSR, Clerk
 */
const userSchema = new mongoose.Schema(
  {
    // Basic Information
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't return password in queries by default
    },
    
    // Personal Details
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number'],
    },
    
    // Role & Permissions
    role: {
      type: String,
      enum: {
        values: ['owner', 'dsr', 'clerk'],
        message: '{VALUE} is not a valid role',
      },
      required: [true, 'User role is required'],
      default: 'dsr',
    },
    
    // Account Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    
    // Additional Information
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
    },
    
    // Metadata
    lastLogin: {
      type: Date,
    },
    passwordChangedAt: {
      type: Date,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    
    // Created/Updated by (for audit trail)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================
// INDEXES
// ============================================

// Compound index for faster queries
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ username: 1, isActive: 1 });
userSchema.index({ role: 1, isActive: 1 });

// ============================================
// VIRTUALS
// ============================================

// Full name virtual field
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ============================================
// MIDDLEWARE (Pre-save hooks)
// ============================================

/**
 * Hash password before saving
 */
userSchema.pre('save', async function (next) {
  // Only hash password if it's modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(
      parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12
    );
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Update passwordChangedAt timestamp when password is modified
 */
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) {
    return next();
  }

  // Set passwordChangedAt to 1 second in the past to ensure JWT is created after
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Compare entered password with hashed password
 * @param {string} enteredPassword - Plain text password
 * @returns {Promise<boolean>} True if passwords match
 */
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Generate JWT token
 * @returns {string} JWT token
 */
userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    {
      id: this._id,
      username: this.username,
      email: this.email,
      role: this.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '7d',
    }
  );
};

/**
 * Check if password was changed after JWT was issued
 * @param {number} jwtTimestamp - JWT issued timestamp
 * @returns {boolean} True if password was changed after JWT
 */
userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return jwtTimestamp < changedTimestamp;
  }
  return false;
};

/**
 * Get public profile (without sensitive data)
 * @returns {Object} Public user profile
 */
userSchema.methods.getPublicProfile = function () {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    firstName: this.firstName,
    lastName: this.lastName,
    fullName: this.fullName,
    phone: this.phone,
    role: this.role,
    isActive: this.isActive,
    isEmailVerified: this.isEmailVerified,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Find user by credentials (email or username)
 * @param {string} credential - Email or username
 * @returns {Promise<User|null>} User document
 */
userSchema.statics.findByCredentials = async function (credential) {
  return await this.findOne({
    $or: [
      { email: credential.toLowerCase() },
      { username: credential.toLowerCase() },
    ],
    isActive: true,
  }).select('+password');
};

/**
 * Get users by role
 * @param {string} role - User role
 * @returns {Promise<Array>} Array of users
 */
userSchema.statics.findByRole = async function (role) {
  return await this.find({ role, isActive: true });
};

const User = mongoose.model('User', userSchema);

module.exports = User;