const mongoose = require('mongoose');

/**
 * Product Schema
 * Master catalog of mobile phone models
 * Contains ONLY phone specifications - NO pricing or warranty
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

// Indexes
productSchema.index({ brand: 1, model: 1, 'specifications.color': 1 });
productSchema.index({ isActive: 1, isDiscontinued: 1 });

// Virtuals
productSchema.virtual('fullName').get(function () {
  const parts = [this.brand, this.model];
  if (this.variant) parts.push(this.variant);
  return parts.join(' ');
});

productSchema.virtual('displayName').get(function () {
  return `${this.brand} ${this.model} ${this.specifications.storage} ${this.specifications.color}`;
});

// Methods
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
    images: this.images,
    features: this.features,
    description: this.description,
    boxContents: this.boxContents,
    isActive: this.isActive,
  };
};

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);