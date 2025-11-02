const mongoose = require('mongoose');

/**
 * Product Schema
 * Master catalog of mobile phone models
 */
const productSchema = new mongoose.Schema(
  {
    // Basic Information
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    model: {
      type: String,
      required: [true, 'Model is required'],
      trim: true,
      index: true,
    },
    variant: {
      type: String,
      trim: true,
    },
    
    // Specifications
    specifications: {
      storage: {
        type: String,
        required: true,
      },
      ram: {
        type: String,
        required: true,
      },
      color: {
        type: String,
        required: true,
      },
      screenSize: String,
      battery: String,
      camera: String,
      processor: String,
      os: String,
      simType: String,
      connectivity: [String],
    },

    // Physical Details
    dimensions: {
      height: Number,
      width: Number,
      thickness: Number,
      weight: Number,
    },

    // Pricing
    pricing: {
      costPrice: {
        type: Number,
        required: [true, 'Cost price is required'],
        min: 0,
      },
      sellingPrice: {
        type: Number,
        required: [true, 'Selling price is required'],
        min: 0,
      },
      mrp: {
        type: Number,
        min: 0,
      },
    },

    // Warranty & Support
    warranty: {
      duration: {
        type: Number,
        default: 12,
      },
      type: {
        type: String,
        default: 'Manufacturer',
      },
    },

    // Product Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isDiscontinued: {
      type: Boolean,
      default: false,
    },

    // Additional Information
    description: String,
    features: [String],
    boxContents: [String],
    tags: [String],

    // Images (AWS S3 URLs)
    images: {
      main: String,
      gallery: [String],
    },

    // Metadata
    sku: {
      type: String,
      unique: true,
      sparse: true,
    },
    barcode: String,

    // Audit Trail
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================
// INDEXES
// ============================================
productSchema.index({ brand: 1, model: 1, 'specifications.color': 1 });
productSchema.index({ isActive: 1, isDiscontinued: 1 });
productSchema.index({ 'pricing.sellingPrice': 1 });

// ============================================
// VIRTUALS
// ============================================

productSchema.virtual('fullName').get(function () {
  const parts = [this.brand, this.model];
  if (this.variant) parts.push(this.variant);
  return parts.join(' ');
});

productSchema.virtual('displayName').get(function () {
  return `${this.brand} ${this.model} ${this.specifications.storage} ${this.specifications.color}`;
});

productSchema.virtual('profitMargin').get(function () {
  if (this.pricing.costPrice && this.pricing.sellingPrice) {
    return this.pricing.sellingPrice - this.pricing.costPrice;
  }
  return 0;
});

productSchema.virtual('profitPercentage').get(function () {
  if (this.pricing.costPrice && this.pricing.sellingPrice) {
    return ((this.pricing.sellingPrice - this.pricing.costPrice) / this.pricing.costPrice) * 100;
  }
  return 0;
});

// ============================================
// METHODS
// ============================================

productSchema.methods.getPublicInfo = function () {
  return {
    id: this._id,
    brand: this.brand,
    model: this.model,
    variant: this.variant,
    fullName: this.fullName,
    displayName: this.displayName,
    specifications: this.specifications,
    dimensions: this.dimensions,
    pricing: {
      sellingPrice: this.pricing.sellingPrice,
      mrp: this.pricing.mrp,
    },
    warranty: this.warranty,
    images: this.images,
    features: this.features,
    isActive: this.isActive,
  };
};

// ============================================
// EXPORT MODEL (FIX FOR OVERWRITE ERROR)
// ============================================

// Check if model exists before creating it
module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);