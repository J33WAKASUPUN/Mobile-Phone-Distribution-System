const Joi = require('joi');

/**
 * Create user validation schema (for Owner)
 */
const createUserSchema = Joi.object({
  username: Joi.string()
    .min(3)
    .max(30)
    .pattern(/^[a-z0-9_]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Username can only contain lowercase letters, numbers, and underscores',
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username cannot exceed 30 characters',
      'any.required': 'Username is required',
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required',
    }),
  firstName: Joi.string()
    .max(50)
    .required()
    .messages({
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required',
    }),
  lastName: Joi.string()
    .max(50)
    .required()
    .messages({
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required',
    }),
  phone: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid 10-digit phone number',
      'any.required': 'Phone number is required',
    }),
  role: Joi.string()
    .valid('dsr', 'clerk')
    .required()
    .messages({
      'any.only': 'Role must be one of: dsr, clerk',
      'any.required': 'Role is required',
    }),
  address: Joi.object({
    street: Joi.string().allow(''),
    city: Joi.string().allow(''),
    state: Joi.string().allow(''),
    zipCode: Joi.string().allow(''),
  }),
});

/**
 * Update user validation schema (for Owner)
 */
const updateUserSchema = Joi.object({
  firstName: Joi.string().max(50),
  lastName: Joi.string().max(50),
  phone: Joi.string().pattern(/^[0-9]{10}$/),
  role: Joi.string().valid('dsr', 'clerk'),
  address: Joi.object({
    street: Joi.string().allow(''),
    city: Joi.string().allow(''),
    state: Joi.string().allow(''),
    zipCode: Joi.string().allow(''),
  }),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
};