const mongoose = require('mongoose');

/**
 * DSR Assignment Schema
 * Tracks daily phone assignments to DSRs
 */
const dsrAssignmentSchema = new mongoose.Schema(
  {
    // Assignment Details
    assignmentNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    assignmentDate: {
      type: Date,
      required: true,
      index: true,
      default: Date.now,
    },
    assignmentTime: {
      type: String, // HH:MM format
      required: true,
    },

    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DsrSchedule',
      index: true,
    },

    // DSR Information
    dsr: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Assigned Phones
    phones: [
      {
        invoice: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'PurchaseInvoice',
          required: true,
        },
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        imei: {
          type: String,
          required: true,
          index: true,
        },
        assignedPrice: {
          type: Number,
          required: true,
        },
        targetPrice: {
          type: Number,
          required: true,
        },
        status: {
          type: String,
          enum: ['Assigned', 'Sold', 'Returned'],
          default: 'Assigned',
        },
        soldDate: Date,
        soldPrice: Number,
        returnedDate: Date,
        returnNotes: String,
      },
    ],

    // Assignment Status
    status: {
      type: String,
      enum: ['Active', 'Partially Returned', 'Fully Returned', 'Completed'],
      default: 'Active',
      index: true,
    },

    // Financial Summary
    totalPhones: {
      type: Number,
      default: 0,
    },
    totalValue: {
      type: Number,
      default: 0,
    },
    totalTargetRevenue: {
      type: Number,
      default: 0,
    },
    soldPhones: {
      type: Number,
      default: 0,
    },
    soldRevenue: {
      type: Number,
      default: 0,
    },
    returnedPhones: {
      type: Number,
      default: 0,
    },

    // Return Information
    returnDate: Date,
    returnTime: String,
    returnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Notes
    notes: String,
    assignmentNotes: String,
    returnNotes: String,

    // Audit Trail
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
dsrAssignmentSchema.index({ assignmentDate: -1, dsr: 1 });
dsrAssignmentSchema.index({ status: 1, assignmentDate: -1 });

// Virtuals
dsrAssignmentSchema.virtual('assignedPhonesCount').get(function () {
  return this.phones.filter(p => p.status === 'Assigned').length;
});

dsrAssignmentSchema.virtual('profitGenerated').get(function () {
  return this.soldRevenue - this.phones
    .filter(p => p.status === 'Sold')
    .reduce((sum, p) => sum + p.assignedPrice, 0);
});

// Pre-save middleware
dsrAssignmentSchema.pre('save', function (next) {
  this.totalPhones = this.phones.length;
  this.totalValue = this.phones.reduce((sum, p) => sum + p.assignedPrice, 0);
  this.totalTargetRevenue = this.phones.reduce((sum, p) => sum + p.targetPrice, 0);
  
  this.soldPhones = this.phones.filter(p => p.status === 'Sold').length;
  this.soldRevenue = this.phones
    .filter(p => p.status === 'Sold')
    .reduce((sum, p) => sum + (p.soldPrice || 0), 0);
  
  this.returnedPhones = this.phones.filter(p => p.status === 'Returned').length;

  // Update status
  if (this.returnedPhones === this.totalPhones) {
    this.status = 'Fully Returned';
  } else if (this.returnedPhones > 0 || this.soldPhones > 0) {
    this.status = 'Partially Returned';
  } else {
    this.status = 'Active';
  }

  next();
});

// Methods
dsrAssignmentSchema.methods.getSummary = function () {
  return {
    id: this._id,
    assignmentNumber: this.assignmentNumber,
    assignmentDate: this.assignmentDate,
    dsr: this.dsr,
    totalPhones: this.totalPhones,
    assignedPhones: this.assignedPhonesCount,
    soldPhones: this.soldPhones,
    returnedPhones: this.returnedPhones,
    totalValue: this.totalValue,
    soldRevenue: this.soldRevenue,
    profitGenerated: this.profitGenerated,
    status: this.status,
  };
};

dsrAssignmentSchema.methods.canReturn = function () {
  return this.assignedPhonesCount > 0 || this.soldPhones > 0;
};

module.exports = mongoose.models.DsrAssignment || mongoose.model('DsrAssignment', dsrAssignmentSchema);