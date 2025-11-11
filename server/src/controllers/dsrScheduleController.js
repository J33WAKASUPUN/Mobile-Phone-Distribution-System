const DsrSchedule = require('../models/DsrSchedule');
const DsrAssignment = require('../models/DsrAssignment');
const User = require('../models/User');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const ExcelJS = require('exceljs');
const { 
  getSriLankaTime, 
  formatSriLankaDateTime, 
  getStartOfDaySriLanka, 
  getEndOfDaySriLanka,
  toSriLankaTime 
} = require('../utils/dateUtils');

/**
 * Helper: Get week number
 */
const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

/**
 * Helper: Get day of week (Sri Lanka time)
 */
const getDayOfWeek = (date) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const sriLankaDate = toSriLankaTime(date);
  return days[sriLankaDate.getUTCDay()];
};

/**
 * Create schedule entry
 * @route POST /api/v1/dsr-schedules
 */
const createSchedule = async (req, res, next) => {
  try {
    const { dsrId, date, scheduleType, shifts, notes } = req.body;

    // Validate DSR exists
    const dsr = await User.findById(dsrId);
    if (!dsr || dsr.role !== 'dsr') {
      return next(new ApiError(400, 'Invalid DSR'));
    }

    // Use Sri Lanka timezone for schedule date
    const scheduleDate = getStartOfDaySriLanka(new Date(date));

    // Check if schedule already exists
    const existingSchedule = await DsrSchedule.findOne({
      dsr: dsrId,
      date: {
        $gte: scheduleDate,
        $lt: getEndOfDaySriLanka(scheduleDate)
      }
    });

    if (existingSchedule) {
      return next(new ApiError(400, `Schedule already exists for ${formatSriLankaDateTime(scheduleDate).date}`));
    }

    const schedule = await DsrSchedule.create({
      dsr: dsrId,
      date: scheduleDate,
      dayOfWeek: getDayOfWeek(scheduleDate),
      week: getWeekNumber(scheduleDate),
      month: scheduleDate.getMonth() + 1,
      year: scheduleDate.getFullYear(),
      scheduleType,
      shifts: shifts || [],
      notes,
      createdBy: req.user._id,
    });

    await schedule.populate('dsr', 'firstName lastName email phone');

    logger.info(`Schedule created by ${req.user.email} for DSR ${dsr.email} on ${formatSriLankaDateTime(scheduleDate).date}`);

    res.status(201).json({
      success: true,
      message: 'Schedule created successfully',
      data: { 
        schedule: schedule.getSummary(),
        sriLankaTime: formatSriLankaDateTime(getSriLankaTime())
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk create schedule for date range
 * @route POST /api/v1/dsr-schedules/bulk
 */
const bulkCreateSchedule = async (req, res, next) => {
  try {
    const { dsrId, startDate, endDate, workDays, defaultShifts, notes } = req.body;

    // Validate DSR
    const dsr = await User.findById(dsrId);
    if (!dsr || dsr.role !== 'dsr') {
      return next(new ApiError(400, 'Invalid DSR'));
    }

    // Use Sri Lanka timezone
    const start = getStartOfDaySriLanka(new Date(startDate));
    const end = getEndOfDaySriLanka(new Date(endDate));

    const schedulesToCreate = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dayName = getDayOfWeek(currentDate);
      
      // Only create schedule if day is in workDays array
      if (workDays.includes(dayName)) {
        // Check if schedule already exists
        const existing = await DsrSchedule.findOne({
          dsr: dsrId,
          date: {
            $gte: getStartOfDaySriLanka(currentDate),
            $lt: getEndOfDaySriLanka(currentDate)
          }
        });

        if (!existing) {
          schedulesToCreate.push({
            dsr: dsrId,
            date: getStartOfDaySriLanka(new Date(currentDate)),
            dayOfWeek: dayName,
            week: getWeekNumber(currentDate),
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear(),
            scheduleType: 'WorkDay',
            shifts: defaultShifts,
            notes,
            createdBy: req.user._id,
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (schedulesToCreate.length === 0) {
      return next(new ApiError(400, 'No new schedules to create. All dates already have schedules.'));
    }

    const createdSchedules = await DsrSchedule.insertMany(schedulesToCreate);

    logger.info(`Bulk schedule created by ${req.user.email}: ${createdSchedules.length} schedules for DSR ${dsr.email}`);

    res.status(201).json({
      success: true,
      message: `${createdSchedules.length} schedules created successfully`,
      data: {
        count: createdSchedules.length,
        dateRange: {
          start: formatSriLankaDateTime(start).date,
          end: formatSriLankaDateTime(end).date,
        },
        sriLankaTime: formatSriLankaDateTime(getSriLankaTime())
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get schedule calendar for specific DSR
 * @route GET /api/v1/dsr-schedules/calendar/:dsrId
 */
const getScheduleCalendar = async (req, res, next) => {
  try {
    const { dsrId } = req.params;
    const { year, month, view = 'month' } = req.query;

    // Validate DSR
    const dsr = await User.findById(dsrId);
    if (!dsr || dsr.role !== 'dsr') {
      return next(new ApiError(404, 'DSR not found'));
    }

    // Check authorization
    if (req.user.role === 'dsr' && req.user._id.toString() !== dsrId) {
      return next(new ApiError(403, 'You can only view your own schedule'));
    }

    let startDate, endDate;

    if (view === 'month') {
      // Use Sri Lanka current time as default
      const nowSriLanka = toSriLankaTime(getSriLankaTime());
      const targetYear = year ? parseInt(year) : nowSriLanka.getUTCFullYear();
      const targetMonth = month ? parseInt(month) : nowSriLanka.getUTCMonth() + 1;

      startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));
    } else if (view === 'week') {
      const today = getSriLankaTime();
      const dayOfWeek = today.getDay();
      startDate = new Date(today);
      startDate.setDate(today.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    }

    const schedules = await DsrSchedule.find({
      dsr: dsrId,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .populate('assignment')
      .sort({ date: 1 });

    // Calculate summary statistics
    const summary = {
      totalDays: schedules.length,
      workDays: schedules.filter(s => s.scheduleType === 'WorkDay').length,
      presentDays: schedules.filter(s => s.status === 'Present').length,
      absentDays: schedules.filter(s => s.status === 'Absent').length,
      leaveDays: schedules.filter(s => ['OnLeave', 'Vacation', 'SickLeave'].includes(s.status)).length,
      totalRevenue: schedules.reduce((sum, s) => sum + (s.performance.revenue || 0), 0),
      totalProfit: schedules.reduce((sum, s) => sum + (s.performance.profit || 0), 0),
      phonesSold: schedules.reduce((sum, s) => sum + (s.performance.phonesSold || 0), 0),
    };

    res.status(200).json({
      success: true,
      data: {
        dsr: {
          id: dsr._id,
          name: dsr.fullName,
          email: dsr.email,
          phone: dsr.phone,
        },
        view,
        dateRange: {
          start: startDate,
          end: endDate,
        },
        calendar: schedules,
        summary,
        sriLankaTime: formatSriLankaDateTime(getSriLankaTime())
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get schedule for specific date
 * @route GET /api/v1/dsr-schedules/:dsrId/date/:date
 */
const getScheduleByDate = async (req, res, next) => {
  try {
    const { dsrId, date } = req.params;

    // Use Sri Lanka timezone
    const targetDate = getStartOfDaySriLanka(new Date(date));

    const schedule = await DsrSchedule.findOne({
      dsr: dsrId,
      date: {
        $gte: targetDate,
        $lt: getEndOfDaySriLanka(targetDate)
      }
    })
      .populate('dsr', 'firstName lastName email phone')
      .populate('assignment');

    if (!schedule) {
      return next(new ApiError(404, 'Schedule not found for this date'));
    }

    // Check authorization
    if (req.user.role === 'dsr' && req.user._id.toString() !== dsrId) {
      return next(new ApiError(403, 'You can only view your own schedule'));
    }

    res.status(200).json({
      success: true,
      data: { 
        schedule,
        sriLankaTime: formatSriLankaDateTime(getSriLankaTime())
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update schedule
 * @route PATCH /api/v1/dsr-schedules/:id
 */
const updateSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const schedule = await DsrSchedule.findById(id);

    if (!schedule) {
      return next(new ApiError(404, 'Schedule not found'));
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      schedule[key] = updates[key];
    });

    schedule.updatedBy = req.user._id;
    await schedule.save();

    await schedule.populate('dsr', 'firstName lastName email phone');

    logger.info(`Schedule updated by ${req.user.email} for date ${formatSriLankaDateTime(schedule.date).date}`);

    res.status(200).json({
      success: true,
      message: 'Schedule updated successfully',
      data: { 
        schedule: schedule.getSummary(),
        sriLankaTime: formatSriLankaDateTime(getSriLankaTime())
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete schedule
 * @route DELETE /api/v1/dsr-schedules/:id
 */
const deleteSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;

    const schedule = await DsrSchedule.findById(id);

    if (!schedule) {
      return next(new ApiError(404, 'Schedule not found'));
    }

    // Cannot delete if has assignment
    if (schedule.assignment) {
      return next(new ApiError(400, 'Cannot delete schedule with existing assignment'));
    }

    await schedule.deleteOne();

    logger.info(`Schedule deleted by ${req.user.email} for date ${formatSriLankaDateTime(schedule.date).date}`);

    res.status(200).json({
      success: true,
      message: 'Schedule deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request leave
 * @route POST /api/v1/dsr-schedules/leave
 */
const requestLeave = async (req, res, next) => {
  try {
    const { dsrId, startDate, endDate, leaveType, reason } = req.body;

    const dsr = await User.findById(dsrId);
    if (!dsr || dsr.role !== 'dsr') {
      return next(new ApiError(400, 'Invalid DSR'));
    }

    // Use Sri Lanka timezone
    const start = getStartOfDaySriLanka(new Date(startDate));
    const end = getEndOfDaySriLanka(new Date(endDate));

    const schedulesToUpdate = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      let schedule = await DsrSchedule.findOne({
        dsr: dsrId,
        date: {
          $gte: getStartOfDaySriLanka(currentDate),
          $lt: getEndOfDaySriLanka(currentDate)
        }
      });

      // Create schedule if doesn't exist
      if (!schedule) {
        schedule = await DsrSchedule.create({
          dsr: dsrId,
          date: getStartOfDaySriLanka(new Date(currentDate)),
          dayOfWeek: getDayOfWeek(currentDate),
          week: getWeekNumber(currentDate),
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
          scheduleType: leaveType === 'Sick' ? 'SickLeave' : 
                       leaveType === 'Emergency' ? 'Emergency' : 
                       leaveType === 'Personal' ? 'PersonalLeave' :
                       leaveType === 'Unpaid' ? 'UnpaidLeave' : 'Vacation',
          shifts: [],
          status: 'OnLeave',
          leaveDetails: {
            requestedBy: req.user._id,
            requestedAt: getSriLankaTime(),
            reason,
            leaveType,
            isApproved: true, // Auto-approved since Owner/Clerk creates it
            approvedBy: req.user._id,
            approvedAt: getSriLankaTime(),
          },
          createdBy: req.user._id,
        });
      } else {
        // Update existing schedule
        schedule.scheduleType = leaveType === 'Sick' ? 'SickLeave' : 
                               leaveType === 'Emergency' ? 'Emergency' : 
                               leaveType === 'Personal' ? 'PersonalLeave' :
                               leaveType === 'Unpaid' ? 'UnpaidLeave' : 'Vacation';
        schedule.status = 'OnLeave';
        schedule.leaveDetails = {
          requestedBy: req.user._id,
          requestedAt: getSriLankaTime(),
          reason,
          leaveType,
          isApproved: true,
          approvedBy: req.user._id,
          approvedAt: getSriLankaTime(),
        };
        schedule.updatedBy = req.user._id;
        await schedule.save();
      }

      schedulesToUpdate.push(schedule);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    logger.info(`Leave marked by ${req.user.email} for DSR ${dsr.email} from ${formatSriLankaDateTime(start).date} to ${formatSriLankaDateTime(end).date}`);

    res.status(200).json({
      success: true,
      message: `Leave marked for ${schedulesToUpdate.length} days`,
      data: {
        count: schedulesToUpdate.length,
        dateRange: {
          start: formatSriLankaDateTime(start).date,
          end: formatSriLankaDateTime(end).date,
        },
        sriLankaTime: formatSriLankaDateTime(getSriLankaTime())
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve leave request
 * @route PATCH /api/v1/dsr-schedules/:id/approve-leave
 */
const approveLeave = async (req, res, next) => {
  try {
    const { id } = req.params;

    const schedule = await DsrSchedule.findById(id);

    if (!schedule) {
      return next(new ApiError(404, 'Schedule not found'));
    }

    if (!schedule.leaveDetails || schedule.leaveDetails.isApproved) {
      return next(new ApiError(400, 'No pending leave request'));
    }

    schedule.leaveDetails.isApproved = true;
    schedule.leaveDetails.approvedBy = req.user._id;
    schedule.leaveDetails.approvedAt = getSriLankaTime();
    schedule.status = 'OnLeave';

    await schedule.save();

    logger.info(`Leave approved by ${req.user.email} for date ${formatSriLankaDateTime(schedule.date).date}`);

    res.status(200).json({
      success: true,
      message: 'Leave approved successfully',
      data: {
        sriLankaTime: formatSriLankaDateTime(getSriLankaTime())
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject leave request
 * @route PATCH /api/v1/dsr-schedules/:id/reject-leave
 */
const rejectLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const schedule = await DsrSchedule.findById(id);

    if (!schedule) {
      return next(new ApiError(404, 'Schedule not found'));
    }

    schedule.leaveDetails.isApproved = false;
    schedule.leaveDetails.rejectionReason = rejectionReason;
    schedule.scheduleType = 'WorkDay';
    schedule.status = 'Scheduled';

    await schedule.save();

    logger.info(`Leave rejected by ${req.user.email} for date ${formatSriLankaDateTime(schedule.date).date}`);

    res.status(200).json({
      success: true,
      message: 'Leave rejected',
      data: {
        sriLankaTime: formatSriLankaDateTime(getSriLankaTime())
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check-in for the day
 * @route POST /api/v1/dsr-schedules/:id/check-in
 */
const checkIn = async (req, res, next) => {
  try {
    const { id } = req.params;

    const schedule = await DsrSchedule.findById(id).populate('dsr', 'firstName lastName email');

    if (!schedule) {
      return next(new ApiError(404, 'Schedule not found'));
    }

    // ✅ 1. Check if today (prevent checking in for future dates)
    const todaySriLanka = getStartOfDaySriLanka(getSriLankaTime());
    const scheduleDateSriLanka = getStartOfDaySriLanka(schedule.date);

    if (scheduleDateSriLanka > todaySriLanka) {
      return next(new ApiError(400, 'Cannot check-in for future schedules. This task is locked until tomorrow.'));
    }

    if (scheduleDateSriLanka < todaySriLanka) {
      return next(new ApiError(400, 'Cannot check-in for past schedules'));
    }

    // ✅ 2. DSR can only check-in their own schedule
    if (req.user.role === 'dsr' && schedule.dsr._id.toString() !== req.user._id.toString()) {
      return next(new ApiError(403, 'You can only check-in your own schedule'));
    }

    // ✅ 3. Check status
    if (!schedule.canCheckIn) {
      return next(new ApiError(400, `Cannot check-in. Current status: ${schedule.status}`));
    }

    // ✅ 4. Use Sri Lanka time for check-in
    const now = getSriLankaTime();
    
    schedule.attendance.checkInTime = now;
    schedule.status = 'CheckedIn';
    
    // ✅ 5. Check if late
    if (schedule.shifts && schedule.shifts.length > 0) {
      const firstShift = schedule.shifts[0];
      const [startHour, startMin] = firstShift.startTime.split(':').map(Number);
      
      const scheduledStart = new Date(schedule.date);
      scheduledStart.setHours(startHour, startMin, 0, 0);
      
      if (now > scheduledStart) {
        const lateMinutes = Math.floor((now - scheduledStart) / (1000 * 60));
        schedule.attendance.isLate = true;
        schedule.attendance.lateByMinutes = lateMinutes;
        schedule.status = 'Late';
      }
    }
    
    await schedule.save();

    logger.info(`DSR ${schedule.dsr.email} checked in at ${formatSriLankaDateTime(now).dateTime}`);

    res.status(200).json({
      success: true,
      message: 'Checked in successfully',
      data: {
        checkInTime: schedule.attendance.checkInTime,
        isLate: schedule.attendance.isLate,
        lateByMinutes: schedule.attendance.lateByMinutes,
        status: schedule.status,
        sriLankaTime: formatSriLankaDateTime(now)
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check-out for the day
 * @route POST /api/v1/dsr-schedules/:id/check-out
 */
const checkOut = async (req, res, next) => {
  try {
    const { id } = req.params;

    const schedule = await DsrSchedule.findById(id).populate('dsr', 'firstName lastName email');

    if (!schedule) {
      return next(new ApiError(404, 'Schedule not found'));
    }

    // DSR can only check-out their own schedule
    if (req.user.role === 'dsr' && schedule.dsr._id.toString() !== req.user._id.toString()) {
      return next(new ApiError(403, 'You can only check-out your own schedule'));
    }

    if (!schedule.attendance.checkInTime) {
      return next(new ApiError(400, 'Cannot check-out without checking in first'));
    }

    if (schedule.attendance.checkOutTime) {
      return next(new ApiError(400, 'Already checked out'));
    }

    // Use Sri Lanka time for check-out
    const now = getSriLankaTime();
    
    schedule.attendance.checkOutTime = now;
    
    if (schedule.attendance.checkInTime) {
      schedule.attendance.actualWorkMinutes = Math.floor(
        (now - schedule.attendance.checkInTime) / (1000 * 60)
      );
    }
    
    schedule.status = 'Present';
    
    await schedule.save();

    logger.info(`DSR ${schedule.dsr.email} checked out at ${formatSriLankaDateTime(now).dateTime}`);

    res.status(200).json({
      success: true,
      message: 'Checked out successfully',
      data: {
        checkOutTime: schedule.attendance.checkOutTime,
        actualWorkMinutes: schedule.attendance.actualWorkMinutes,
        sriLankaTime: formatSriLankaDateTime(now)
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark DSR as absent
 * @route PATCH /api/v1/dsr-schedules/:id/mark-absent
 */
const markAbsent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const schedule = await DsrSchedule.findById(id);

    if (!schedule) {
      return next(new ApiError(404, 'Schedule not found'));
    }

    await schedule.markAbsent(notes);

    logger.info(`Schedule marked as absent by ${req.user.email} for date ${formatSriLankaDateTime(schedule.date).date}`);

    res.status(200).json({
      success: true,
      message: 'Marked as absent',
      data: {
        sriLankaTime: formatSriLankaDateTime(getSriLankaTime())
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get team calendar (all DSRs)
 * @route GET /api/v1/dsr-schedules/reports/team-calendar
 */
const getTeamCalendar = async (req, res, next) => {
  try {
    const { date } = req.query;

    // Use Sri Lanka time
    const targetDate = date ? getStartOfDaySriLanka(new Date(date)) : getStartOfDaySriLanka(getSriLankaTime());

    const schedules = await DsrSchedule.find({
      date: {
        $gte: targetDate,
        $lt: getEndOfDaySriLanka(targetDate)
      }
    })
      .populate('dsr', 'firstName lastName email phone')
      .populate('assignment')
      .sort({ 'dsr.firstName': 1 });

    res.status(200).json({
      success: true,
      data: {
        date: targetDate,
        displayDate: formatSriLankaDateTime(targetDate).date,
        totalDSRs: schedules.length,
        schedules,
        sriLankaTime: formatSriLankaDateTime(getSriLankaTime())
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get monthly report
 * @route GET /api/v1/dsr-schedules/reports/monthly/:dsrId/:year/:month
 */
const getMonthlyReport = async (req, res, next) => {
  try {
    const { dsrId, year, month } = req.params;

    const dsr = await User.findById(dsrId);
    if (!dsr || dsr.role !== 'dsr') {
      return next(new ApiError(404, 'DSR not found'));
    }

    // Check authorization
    if (req.user.role === 'dsr' && req.user._id.toString() !== dsrId) {
      return next(new ApiError(403, 'You can only view your own reports'));
    }

    const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 0, 23, 59, 59, 999));

    const schedules = await DsrSchedule.find({
      dsr: dsrId,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .populate('assignment')
      .sort({ date: 1 });

    const summary = {
      month: parseInt(month),
      year: parseInt(year),
      totalDays: schedules.length,
      workDays: schedules.filter(s => s.scheduleType === 'WorkDay').length,
      presentDays: schedules.filter(s => s.status === 'Present').length,
      absentDays: schedules.filter(s => s.status === 'Absent').length,
      lateDays: schedules.filter(s => s.status === 'Late').length,
      leaveDays: schedules.filter(s => s.status === 'OnLeave').length,
      totalRevenue: schedules.reduce((sum, s) => sum + (s.performance.revenue || 0), 0),
      totalProfit: schedules.reduce((sum, s) => sum + (s.performance.profit || 0), 0),
      phonesAssigned: schedules.reduce((sum, s) => sum + (s.performance.phonesAssigned || 0), 0),
      phonesSold: schedules.reduce((sum, s) => sum + (s.performance.phonesSold || 0), 0),
      phonesReturned: schedules.reduce((sum, s) => sum + (s.performance.phonesReturned || 0), 0),
    };

    res.status(200).json({
      success: true,
      data: {
        dsr: {
          id: dsr._id,
          name: dsr.fullName,
          email: dsr.email,
        },
        summary,
        schedules,
        sriLankaTime: formatSriLankaDateTime(getSriLankaTime())
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSchedule,
  bulkCreateSchedule,
  getScheduleCalendar,
  getScheduleByDate,
  updateSchedule,
  deleteSchedule,
  requestLeave,
  approveLeave,
  rejectLeave,
  checkIn,
  checkOut,
  markAbsent,
  getTeamCalendar,
  getMonthlyReport,
};