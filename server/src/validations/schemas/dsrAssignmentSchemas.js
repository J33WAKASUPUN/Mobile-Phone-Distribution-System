const Joi = require('joi');

/**
 * Create DSR assignment validation schema
 */
const createAssignmentSchema = Joi.object({
  dsrId: Joi.string()
    .required()
    .messages({
      'any.required': 'DSR ID is required',
      'string.empty': 'DSR ID cannot be empty',
    }),
  
  phones: Joi.array()
    .items(
      Joi.object({
        imei: Joi.string()
          .pattern(/^[0-9]{15}$/)
          .required()
          .messages({
            'string.pattern.base': 'IMEI must be exactly 15 digits',
            'any.required': 'IMEI is required',
          }),
        targetPrice: Joi.number()
          .min(0)
          .optional()
          .messages({
            'number.min': 'Target price cannot be negative',
          }),
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one phone is required for assignment',
      'any.required': 'Phones array is required',
    }),
  
  notes: Joi.string()
    .max(500)
    .allow('')
    .optional(),
});

/**
 * Mark phone as sold validation schema
 */
const markPhoneAsSoldSchema = Joi.object({
  soldPrice: Joi.number()
    .min(0)
    .required()
    .messages({
      'number.min': 'Sold price cannot be negative',
      'any.required': 'Sold price is required',
    }),
  
  soldDate: Joi.date()
    .optional()
    .default(() => new Date()),
});

/**
 * Return phones validation schema
 */
const returnPhonesSchema = Joi.object({
  imeis: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9]{15}$/)
        .messages({
          'string.pattern.base': 'Each IMEI must be exactly 15 digits',
        })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one IMEI is required',
      'any.required': 'IMEIs array is required',
    }),
  
  returnNotes: Joi.string()
    .max(500)
    .allow('')
    .optional(),
});

module.exports = {
  createAssignmentSchema,
  markPhoneAsSoldSchema,
  returnPhonesSchema,
};