const express = require('express');
const {
  createSchedule,
  bulkCreateSchedule,
  getScheduleCalendar,
  getScheduleByDate,
  updateSchedule,
  requestLeave,
  approveLeave,
  rejectLeave,
  checkIn,
  checkOut,
  markAbsent,
  getTeamCalendar,
  getMonthlyReport,
  deleteSchedule,
} = require('../controllers/dsrScheduleController');
const { protect, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  createScheduleSchema,
  bulkCreateScheduleSchema,
  updateScheduleSchema,
  requestLeaveSchema,
  checkInSchema,
  rejectLeaveSchema,
} = require('../validations/schemas/dsrScheduleSchemas');

const router = express.Router();

// ============================================
// REPORTS (place BEFORE parameterized routes)
// ============================================

router.get('/reports/team-calendar', protect, authorize('owner', 'clerk'), getTeamCalendar);

router.get('/reports/monthly/:dsrId/:year/:month', protect, getMonthlyReport);

// ============================================
// SCHEDULE MANAGEMENT
// ============================================

router.post(
  '/',
  protect,
  authorize('owner', 'clerk'),
  validate(createScheduleSchema),
  createSchedule
);

router.post(
  '/bulk',
  protect,
  authorize('owner', 'clerk'),
  validate(bulkCreateScheduleSchema),
  bulkCreateSchedule
);

// ============================================
// LEAVE MANAGEMENT (place BEFORE parameterized routes)
// ============================================

router.post(
  '/leave',
  protect,
  authorize('owner', 'clerk'),
  validate(requestLeaveSchema),
  requestLeave
);

// ============================================
// CALENDAR & DATE QUERIES
// ============================================

router.get('/calendar/:dsrId', protect, getScheduleCalendar);

router.get('/:dsrId/date/:date', protect, getScheduleByDate);

// ============================================
// UPDATE & DELETE (parameterized routes)
// ============================================

router.patch(
  '/:id',
  protect,
  authorize('owner', 'clerk'),
  validate(updateScheduleSchema),
  updateSchedule
);

router.delete('/:id', protect, authorize('owner', 'clerk'), deleteSchedule);

router.patch('/:id/approve-leave', protect, authorize('owner', 'clerk'), approveLeave);

router.patch(
  '/:id/reject-leave',
  protect,
  authorize('owner', 'clerk'),
  validate(rejectLeaveSchema),
  rejectLeave
);

// ============================================
// ATTENDANCE TRACKING
// ============================================

router.post('/:id/check-in', protect, validate(checkInSchema), checkIn);

router.post('/:id/check-out', protect, checkOut);

router.patch('/:id/mark-absent', protect, authorize('owner', 'clerk'), markAbsent);

module.exports = router;