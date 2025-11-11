const mongoose = require("mongoose");

/**
 * Purchase Invoice Schema
 * Represents a purchase invoice with multiple phones
 */
const purchaseInvoiceSchema = new mongoose.Schema(
  {
    // Invoice Details
    invoiceNumber: {
      type: String,
      required: [true, "Invoice number is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    invoiceDate: {
      type: Date,
      required: [true, "Invoice date is required"],
      index: true,
    },
    invoiceTime: {
      type: String, // HH:MM format
      required: true,
    },

    // Supplier Information
    supplier: {
      name: {
        type: String,
        required: [true, "Supplier name is required"],
        trim: true,
      },
      contactPerson: String,
      phone: String,
      email: String,
      address: String,
    },

    // Invoice Proof (AWS S3) - OPTIONAL ON CREATE
    invoiceProof: {
      url: {
        type: String,
        required: false,
      },
      key: {
        type: String,
        required: false,
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },

    // Phones in this invoice (Array of phone items)
    phones: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        imei: {
          type: String,
          required: [true, "IMEI number is required"],
          unique: true,
          trim: true,
          match: [/^[0-9]{15}$/, "IMEI must be exactly 15 digits"],
          index: true,
        },
        serialNumber: String,

        costPrice: {
          type: Number,
          required: [true, "Cost price is required"],
          min: 0,
        },
        sellingPrice: {
          type: Number,
          required: [true, "Selling price is required"],
          min: 0,
        },

        condition: {
          type: String,
          enum: ["New", "Refurbished", "Open Box", "Like New"],
          default: "New",
        },

        status: {
          type: String,
          enum: [
            "Available",
            "Assigned",
            "Reserved",
            "Sold",
            "Returned",
            "Damaged",
            "Transit",
          ],
          default: "Available",
          index: true,
        },

        warrantyExpiryDate: Date,
        notes: String,
        soldDate: Date,
        soldTo: String,

        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Financial Summary
    financials: {
      subtotal: {
        type: Number,
        required: true,
        default: 0,
      },
      tax: {
        amount: {
          type: Number,
          default: 0,
        },
        percentage: {
          type: Number,
          default: 0,
        },
      },
      discount: {
        amount: {
          type: Number,
          default: 0,
        },
        percentage: {
          type: Number,
          default: 0,
        },
      },
      shippingCost: {
        type: Number,
        default: 0,
      },
      totalCost: {
        type: Number,
        required: true,
        default: 0,
      },
      totalSellingPrice: {
        type: Number,
        default: 0,
      },
    },

    // Payment Details
    payment: {
      method: {
        type: String,
        enum: ["Cash", "Bank Transfer", "Cheque", "Credit", "Mixed"],
        default: "Cash",
      },
      status: {
        type: String,
        enum: ["Paid", "Partial", "Pending", "Overdue"],
        default: "Paid",
      },
      paidAmount: {
        type: Number,
        default: 0,
      },
      pendingAmount: {
        type: Number,
        default: 0,
      },
      paymentDate: Date,
      referenceNumber: String,
    },

    // Status
    invoiceStatus: {
      type: String,
      enum: ["Draft", "Verified", "Completed", "Cancelled"],
      default: "Draft",
      index: true,
    },

    // Additional Information
    notes: String,
    tags: [String],

    // Verification
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    verifiedAt: Date,

    // Audit Trail
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================
// INDEXES
// ============================================
purchaseInvoiceSchema.index({ invoiceDate: -1 });
purchaseInvoiceSchema.index({ "supplier.name": 1 });
purchaseInvoiceSchema.index({ invoiceStatus: 1 });
purchaseInvoiceSchema.index({ "phones.imei": 1 });
purchaseInvoiceSchema.index({ "phones.status": 1 });

// ============================================
// VIRTUALS
// ============================================

purchaseInvoiceSchema.virtual("totalPhones").get(function () {
  return this.phones.length;
});

purchaseInvoiceSchema.virtual("availablePhones").get(function () {
  return this.phones.filter((phone) => phone.status === "Available").length;
});

purchaseInvoiceSchema.virtual("soldPhones").get(function () {
  return this.phones.filter((phone) => phone.status === "Sold").length;
});

purchaseInvoiceSchema.virtual("expectedProfit").get(function () {
  return this.financials.totalSellingPrice - this.financials.totalCost;
});

// ============================================
// MIDDLEWARE
// ============================================

purchaseInvoiceSchema.pre("save", function (next) {
  this.financials.subtotal = this.phones.reduce(
    (sum, phone) => sum + phone.costPrice,
    0
  );

  this.financials.totalCost =
    this.financials.subtotal +
    this.financials.tax.amount +
    this.financials.shippingCost -
    this.financials.discount.amount;

  this.financials.totalSellingPrice = this.phones.reduce(
    (sum, phone) => sum + phone.sellingPrice,
    0
  );

  this.payment.pendingAmount =
    this.financials.totalCost - this.payment.paidAmount;

  next();
});

// ============================================
// METHODS
// ============================================

purchaseInvoiceSchema.methods.hasIMEI = function (imei) {
  return this.phones.some((phone) => phone.imei === imei);
};

purchaseInvoiceSchema.methods.getPhoneByIMEI = function (imei) {
  return this.phones.find((phone) => phone.imei === imei);
};

purchaseInvoiceSchema.methods.updatePhoneStatus = async function (
  imei,
  newStatus,
  soldInfo = {}
) {
  const phone = this.getPhoneByIMEI(imei);

  if (!phone) {
    throw new Error("Phone with this IMEI not found in invoice");
  }

  phone.status = newStatus;

  if (newStatus === "Sold" && soldInfo) {
    phone.soldDate = soldInfo.soldDate || new Date();
    phone.soldTo = soldInfo.soldTo || "";
  }

  await this.save();
  return phone;
};

purchaseInvoiceSchema.methods.getSummary = function () {
  return {
    id: this._id.toString(),
    invoiceNumber: this.invoiceNumber,
    invoiceDate: this.invoiceDate,
    supplier:
      typeof this.supplier === "object" && this.supplier !== null
        ? this.supplier.name
        : this.supplier || "Unknown",
    totalPhones: this.phones.length,
    availablePhones: this.phones.filter((p) => p.status === "Available").length,
    soldPhones: this.phones.filter((p) => p.status === "Sold").length,
    totalCost: this.financials.totalCost,
    totalSellingPrice: this.financials.totalSellingPrice,
    expectedProfit:
      this.financials.totalSellingPrice - this.financials.totalCost,
    invoiceStatus: this.invoiceStatus,
    paymentStatus: this.payment?.status || "Pending",
  };
};

// ============================================
// EXPORT MODEL (FIX FOR OVERWRITE ERROR)
// ============================================

// Check if model exists before creating it
module.exports =
  mongoose.models.PurchaseInvoice ||
  mongoose.model("PurchaseInvoice", purchaseInvoiceSchema);