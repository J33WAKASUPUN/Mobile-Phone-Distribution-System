const mongoose = require('mongoose');

const dsrScheduleSchema = new mongoose.Schema({
  // DSR Reference
  dsr: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  // Date Information
  date: {
    type: Date,
    required: true,
    index: true,
  },
  dayOfWeek: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    required: true,
  },
  week: Number, // ISO week number
  month: {
    type: Number,
    min: 1,
    max: 12,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  
  // Schedule Type
  scheduleType: {
    type: String,
    enum: ['WorkDay', 'DayOff', 'Vacation', 'SickLeave', 'Emergency', 'Holiday', 'PersonalLeave', 'UnpaidLeave'],
    default: 'WorkDay',
  },
  
  // Work Shifts (support multiple shifts per day)
  shifts: [
    {
      startTime: {
        type: String,
        required: true,
        match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/,
      },
      endTime: {
        type: String,
        required: true,
        match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/,
      },
      shiftName: String,
      breakStart: String,
      breakEnd: String,
    }
  ],
  
  // Assignment Reference (link to DSR Assignment)
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DsrAssignment',
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: ['Scheduled', 'CheckedIn', 'Present', 'Absent', 'Late', 'OnLeave', 'Holiday', 'Cancelled'],
    default: 'Scheduled',
  },
  
  // Check-in/Check-out (for attendance)
  attendance: {
    checkInTime: Date,
    checkOutTime: Date,
    actualWorkMinutes: Number,
    isLate: {
      type: Boolean,
      default: false,
    },
    lateByMinutes: Number,
  },
  
  // Leave Details
  leaveDetails: {
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    requestedAt: Date,
    reason: String,
    leaveType: {
      type: String,
      enum: ['Annual', 'Sick', 'Emergency', 'Unpaid', 'Personal'],
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: Date,
    rejectionReason: String,
  },
  
  // Performance Metrics
  performance: {
    phonesAssigned: {
      type: Number,
      default: 0,
    },
    phonesSold: {
      type: Number,
      default: 0,
    },
    phonesReturned: {
      type: Number,
      default: 0,
    },
    revenue: {
      type: Number,
      default: 0,
    },
    profit: {
      type: Number,
      default: 0,
    },
    targetAchievement: Number,
  },
  
  // Notes
  notes: String,
  adminNotes: String,
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Compound Indexes
dsrScheduleSchema.index({ dsr: 1, date: 1 }, { unique: true });
dsrScheduleSchema.index({ date: 1, scheduleType: 1 });
dsrScheduleSchema.index({ dsr: 1, year: 1, month: 1 });
dsrScheduleSchema.index({ status: 1, date: 1 });

// Virtuals
dsrScheduleSchema.virtual('totalShiftDuration').get(function() {
  if (!this.shifts || this.shifts.length === 0) return 0;
  
  let totalMinutes = 0;
  this.shifts.forEach(shift => {
    const [startHour, startMin] = shift.startTime.split(':').map(Number);
    const [endHour, endMin] = shift.endTime.split(':').map(Number);
    
    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;
    
    totalMinutes += endTotal - startTotal;
    
    if (shift.breakStart && shift.breakEnd) {
      const [breakStartH, breakStartM] = shift.breakStart.split(':').map(Number);
      const [breakEndH, breakEndM] = shift.breakEnd.split(':').map(Number);
      const breakMinutes = (breakEndH * 60 + breakEndM) - (breakStartH * 60 + breakStartM);
      totalMinutes -= breakMinutes;
    }
  });
  
  return totalMinutes;
});

dsrScheduleSchema.virtual('isWorkDay').get(function() {
  return this.scheduleType === 'WorkDay' && ['Scheduled', 'CheckedIn', 'Present'].includes(this.status);
});

dsrScheduleSchema.virtual('canCheckIn').get(function() {
  return this.scheduleType === 'WorkDay' && this.status === 'Scheduled';
});

// Methods
dsrScheduleSchema.methods.checkIn = async function() {
  const now = new Date();
  
  this.attendance.checkInTime = now;
  this.status = 'CheckedIn';
  
  // Check if late
  if (this.shifts && this.shifts.length > 0) {
    const firstShift = this.shifts[0];
    const [startHour, startMin] = firstShift.startTime.split(':').map(Number);
    
    const scheduledStart = new Date(this.date);
    scheduledStart.setHours(startHour, startMin, 0, 0);
    
    if (now > scheduledStart) {
      const lateMinutes = Math.floor((now - scheduledStart) / (1000 * 60));
      this.attendance.isLate = true;
      this.attendance.lateByMinutes = lateMinutes;
      this.status = 'Late';
    }
  }
  
  await this.save();
  return this;
};

dsrScheduleSchema.methods.checkOut = async function() {
  const now = new Date();
  
  this.attendance.checkOutTime = now;
  
  if (this.attendance.checkInTime) {
    this.attendance.actualWorkMinutes = Math.floor(
      (now - this.attendance.checkInTime) / (1000 * 60)
    );
  }
  
  this.status = 'Present';
  
  await this.save();
  return this;
};

dsrScheduleSchema.methods.markAbsent = async function(notes) {
  this.status = 'Absent';
  if (notes) this.adminNotes = notes;
  await this.save();
  return this;
};

dsrScheduleSchema.methods.getSummary = function() {
  return {
    id: this._id,
    date: this.date,
    dayOfWeek: this.dayOfWeek,
    scheduleType: this.scheduleType,
    status: this.status,
    shifts: this.shifts,
    totalShiftDuration: this.totalShiftDuration,
    hasAssignment: !!this.assignment,
    performance: this.performance,
    attendance: this.attendance,
  };
};

module.exports = mongoose.models.DsrSchedule || mongoose.model('DsrSchedule', dsrScheduleSchema);