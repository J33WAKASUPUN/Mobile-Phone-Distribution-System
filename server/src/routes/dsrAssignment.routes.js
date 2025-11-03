const express = require('express');
const {
  createAssignment,
  getAllAssignments,
  getAssignmentById,
  markPhoneAsSold,
  returnPhones,
  exportDailyReport,
} = require('../controllers/dsrAssignmentController');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  createAssignmentSchema,
  markPhoneAsSoldSchema,
  returnPhonesSchema,
} = require('../validations/schemas/dsrAssignmentSchemas');

const router = express.Router();

// ============================================
// DSR ASSIGNMENT ROUTES
// ============================================

/**
 * @route   POST /api/v1/dsr-assignments
 * @desc    Create new DSR assignment (assign phones to DSR)
 * @access  Private (Admin/Clerk only)
 */
router.post(
  '/',
  protect,
  authorize('owner', 'clerk'),
  validate(createAssignmentSchema),
  createAssignment
);

/**
 * @route   GET /api/v1/dsr-assignments
 * @desc    Get all DSR assignments with filters
 * @access  Private (All authenticated users)
 */
router.get('/', protect, getAllAssignments);

/**
 * @route   GET /api/v1/dsr-assignments/:id
 * @desc    Get assignment by ID
 * @access  Private (All authenticated users)
 */
router.get('/:id', protect, getAssignmentById);

// ============================================
// PHONE STATUS MANAGEMENT
// ============================================

/**
 * @route   PATCH /api/v1/dsr-assignments/:id/phones/:imei/sold
 * @desc    Mark phone as sold in assignment
 * @access  Private (DSR can update their own, Admin/Clerk can update all)
 */
router.patch(
  '/:id/phones/:imei/sold',
  protect,
  validate(markPhoneAsSoldSchema),
  markPhoneAsSold
);

/**
 * @route   PATCH /api/v1/dsr-assignments/:id/return
 * @desc    Return unsold phones from assignment
 * @access  Private (DSR can return their own, Admin/Clerk can return all)
 */
router.patch(
  '/:id/return',
  protect,
  validate(returnPhonesSchema),
  returnPhones
);

// ============================================
// REPORTS
// ============================================

/**
 * @route   GET /api/v1/dsr-assignments/reports/daily
 * @desc    Export daily assignment report to Excel
 * @access  Private (Admin/Clerk only)
 */
router.get(
  '/reports/daily',
  protect,
  authorize('owner', 'clerk'),
  exportDailyReport
);

module.exports = router;