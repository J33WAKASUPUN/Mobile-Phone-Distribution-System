const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

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

    // Active Sessions (Max 3 devices)
    activeSessions: [
      {
        sessionId: {
          type: String,
          required: true,
          unique: true,
        },
        token: {
          type: String,
          required: true,
        },
        deviceInfo: {
          userAgent: String,
          browser: String,
          os: String,
          device: String,
          ip: String,
        },
        lastActivity: {
          type: Date,
          default: Date.now,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        expiresAt: {
          type: Date,
          required: true,
        },
      },
    ],
    
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
userSchema.index({ 'activeSessions.sessionId': 1 });

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
userSchema.methods.generateAuthToken = function (deviceInfo = {}) {
  const sessionId = crypto.randomBytes(16).toString('hex');
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = process.env.JWT_EXPIRE || '7d';
  
  // Calculate expiry timestamp
  const expiryDuration = expiresIn.includes('d') 
    ? parseInt(expiresIn) * 24 * 60 * 60 
    : parseInt(expiresIn);
  
  const token = jwt.sign(
    {
      id: this._id.toString(),
      username: this.username,
      email: this.email,
      role: this.role,
      sessionId: sessionId, // Include session ID in token
      iat: now,
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );

  return { token, sessionId, expiresAt: new Date((now + expiryDuration) * 1000) };
};

// ============================================
// Add Session to User
// ============================================
userSchema.methods.addSession = async function (token, sessionId, expiresAt, deviceInfo = {}) {
  // Remove expired sessions first
  this.activeSessions = this.activeSessions.filter(
    session => session.expiresAt > new Date()
  );

  // If already 3 sessions, remove the oldest one
  if (this.activeSessions.length >= 3) {
    this.activeSessions.sort((a, b) => a.createdAt - b.createdAt);
    this.activeSessions.shift(); // Remove oldest session
    logger.info(`Removed oldest session for user: ${this.email}`);
  }

  // Add new session
  this.activeSessions.push({
    sessionId,
    token,
    deviceInfo,
    lastActivity: new Date(),
    createdAt: new Date(),
    expiresAt,
  });

  await this.save({ validateBeforeSave: false });
  return sessionId;
};

// ============================================
// Validate Session
// ============================================
userSchema.methods.isSessionValid = function (sessionId) {
  const session = this.activeSessions.find(s => s.sessionId === sessionId);
  
  if (!session) return false;
  
  // Check if session is expired
  if (session.expiresAt < new Date()) {
    return false;
  }
  
  return true;
};

// ============================================
// ✅ NEW: Update Session Activity
// ============================================
userSchema.methods.updateSessionActivity = async function (sessionId) {
  const session = this.activeSessions.find(s => s.sessionId === sessionId);
  
  if (session) {
    session.lastActivity = new Date();
    await this.save({ validateBeforeSave: false });
  }
};

// ============================================
// Revoke Session (Logout from specific device)
// ============================================
userSchema.methods.revokeSession = async function (sessionId) {
  this.activeSessions = this.activeSessions.filter(
    session => session.sessionId !== sessionId
  );
  await this.save({ validateBeforeSave: false });
};

// ============================================
// Revoke All Sessions (Logout from all devices)
// ============================================
userSchema.methods.revokeAllSessions = async function () {
  this.activeSessions = [];
  await this.save({ validateBeforeSave: false });
};

// ============================================
// Get Active Sessions Summary
// ============================================
userSchema.methods.getActiveSessions = function () {
  return this.activeSessions.map(session => ({
    sessionId: session.sessionId,
    device: session.deviceInfo.device || 'Unknown Device',
    browser: session.deviceInfo.browser || 'Unknown Browser',
    os: session.deviceInfo.os || 'Unknown OS',
    ip: session.deviceInfo.ip || 'Unknown IP',
    lastActivity: session.lastActivity,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    isActive: session.expiresAt > new Date(),
  }));
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
    return changedTimestamp > jwtTimestamp;
  }
  return false;
};

/**
 * Check if token was issued before last login
 * @param {number} jwtTimestamp - JWT issued timestamp
 * @returns {boolean} True if token is outdated
 */
userSchema.methods.isTokenOutdated = function (jwtTimestamp) {
  if (this.lastTokenIssuedAt) {
    const lastTokenTimestamp = parseInt(
      this.lastTokenIssuedAt.getTime() / 1000,
      10
    );
    // Token is outdated if it was issued before the last token
    return jwtTimestamp < lastTokenTimestamp;
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