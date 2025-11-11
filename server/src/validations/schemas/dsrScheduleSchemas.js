const Joi = require('joi');

/**
 * Create Schedule Schema
 */
const createScheduleSchema = Joi.object({
  dsrId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Invalid DSR ID format',
      'any.required': 'DSR ID is required',
    }),
  date: Joi.date()
    .required()
    .messages({
      'any.required': 'Date is required',
    }),
  scheduleType: Joi.string()
    .valid('WorkDay', 'DayOff', 'Vacation', 'SickLeave', 'Emergency', 'Holiday', 'PersonalLeave', 'UnpaidLeave')
    .default('WorkDay'),
  shifts: Joi.array()
    .items(
      Joi.object({
        startTime: Joi.string()
          .pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
          .required()
          .messages({
            'string.pattern.base': 'Invalid start time format. Use HH:MM (24-hour)',
          }),
        endTime: Joi.string()
          .pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
          .required()
          .messages({
            'string.pattern.base': 'Invalid end time format. Use HH:MM (24-hour)',
          }),
        shiftName: Joi.string().optional(),
        breakStart: Joi.string()
          .pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
          .optional(),
        breakEnd: Joi.string()
          .pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
          .optional(),
      })
    )
    .when('scheduleType', {
      is: 'WorkDay',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  notes: Joi.string().max(500).optional(),
});

/**
 * Bulk Create Schedule Schema
 */
const bulkCreateScheduleSchema = Joi.object({
  dsrId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/),
  startDate: Joi.date().required(),
  endDate: Joi.date()
    .required()
    .greater(Joi.ref('startDate'))
    .messages({
      'date.greater': 'End date must be after start date',
    }),
  workDays: Joi.array()
    .items(
      Joi.string().valid('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
    )
    .min(1)
    .required(),
  defaultShifts: Joi.array()
    .items(
      Joi.object({
        startTime: Joi.string()
          .pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
          .required(),
        endTime: Joi.string()
          .pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
          .required(),
        shiftName: Joi.string().optional(),
        breakStart: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        breakEnd: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      })
    )
    .required(),
  notes: Joi.string().max(500).optional(),
});

/**
 * Update Schedule Schema
 */
const updateScheduleSchema = Joi.object({
  scheduleType: Joi.string()
    .valid('WorkDay', 'DayOff', 'Vacation', 'SickLeave', 'Emergency', 'Holiday', 'PersonalLeave', 'UnpaidLeave')
    .optional(),
  shifts: Joi.array()
    .items(
      Joi.object({
        startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
        endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
        shiftName: Joi.string().optional(),
        breakStart: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        breakEnd: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      })
    )
    .optional(),
  status: Joi.string()
    .valid('Scheduled', 'CheckedIn', 'Present', 'Absent', 'Late', 'OnLeave', 'Holiday', 'Cancelled')
    .optional(),
  notes: Joi.string().max(500).optional(),
  adminNotes: Joi.string().max(500).optional(),
});

/**
 * Request Leave Schema
 */
const requestLeaveSchema = Joi.object({
  dsrId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/),
  startDate: Joi.date().required(),
  endDate: Joi.date()
    .required()
    .greater(Joi.ref('startDate'))
    .messages({
      'date.greater': 'End date must be after start date',
    }),
  leaveType: Joi.string()
    .valid('Annual', 'Sick', 'Emergency', 'Unpaid', 'Personal')
    .required(),
  reason: Joi.string().required().min(10).max(500).messages({
    'string.min': 'Reason must be at least 10 characters',
    'string.max': 'Reason cannot exceed 500 characters',
  }),
});

/**
 * Check-in Schema
 */
const checkInSchema = Joi.object({
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    address: Joi.string().max(200).optional(),
  }).optional(),
});

/**
 * Reject Leave Schema
 */
const rejectLeaveSchema = Joi.object({
  rejectionReason: Joi.string().required().min(10).max(500).messages({
    'string.min': 'Rejection reason must be at least 10 characters',
  }),
});

module.exports = {
  createScheduleSchema,
  bulkCreateScheduleSchema,
  updateScheduleSchema,
  requestLeaveSchema,
  checkInSchema,
  rejectLeaveSchema,
};