const Joi = require('joi');

/**
 * Create product validation schema
 */
const createProductSchema = Joi.object({
  brand: Joi.string()
    .required()
    .uppercase()
    .max(50)
    .messages({
      'any.required': 'Brand is required',
      'string.max': 'Brand cannot exceed 50 characters',
    }),
  model: Joi.string()
    .required()
    .max(100)
    .messages({
      'any.required': 'Model is required',
      'string.max': 'Model cannot exceed 100 characters',
    }),
  variant: Joi.string().max(100).allow(''),
  
  specifications: Joi.object({
    storage: Joi.string().required(),
    ram: Joi.string().required(),
    color: Joi.string().required(),
    screenSize: Joi.string().allow(''),
    battery: Joi.string().allow(''),
    camera: Joi.string().allow(''),
    processor: Joi.string().allow(''),
    os: Joi.string().allow(''),
    simType: Joi.string().allow(''),
    connectivity: Joi.array().items(Joi.string()),
  }).required(),

  dimensions: Joi.object({
    height: Joi.number().min(0),
    width: Joi.number().min(0),
    thickness: Joi.number().min(0),
    weight: Joi.number().min(0),
  }),

  pricing: Joi.object({
    costPrice: Joi.number().required().min(0),
    sellingPrice: Joi.number().required().min(0),
    mrp: Joi.number().min(0),
  }).required(),

  warranty: Joi.object({
    duration: Joi.number().default(12),
    type: Joi.string().default('Manufacturer'),
  }),

  description: Joi.string().allow(''),
  features: Joi.array().items(Joi.string()),
  boxContents: Joi.array().items(Joi.string()),
  tags: Joi.array().items(Joi.string()),
  sku: Joi.string().allow(''),
  barcode: Joi.string().allow(''),
});

/**
 * Update product validation schema
 */
const updateProductSchema = Joi.object({
  brand: Joi.string().uppercase().max(50),
  model: Joi.string().max(100),
  variant: Joi.string().max(100).allow(''),
  specifications: Joi.object({
    storage: Joi.string(),
    ram: Joi.string(),
    color: Joi.string(),
    screenSize: Joi.string().allow(''),
    battery: Joi.string().allow(''),
    camera: Joi.string().allow(''),
    processor: Joi.string().allow(''),
    os: Joi.string().allow(''),
    simType: Joi.string().allow(''),
    connectivity: Joi.array().items(Joi.string()),
  }),
  dimensions: Joi.object({
    height: Joi.number().min(0),
    width: Joi.number().min(0),
    thickness: Joi.number().min(0),
    weight: Joi.number().min(0),
  }),
  pricing: Joi.object({
    costPrice: Joi.number().min(0),
    sellingPrice: Joi.number().min(0),
    mrp: Joi.number().min(0),
  }),
  warranty: Joi.object({
    duration: Joi.number(),
    type: Joi.string(),
  }),
  isActive: Joi.boolean(),
  isDiscontinued: Joi.boolean(),
  description: Joi.string().allow(''),
  features: Joi.array().items(Joi.string()),
  boxContents: Joi.array().items(Joi.string()),
  tags: Joi.array().items(Joi.string()),
});

/**
 * Create purchase invoice validation schema
 */
const createPurchaseInvoiceSchema = Joi.object({
  invoiceNumber: Joi.string()
    .required()
    .uppercase()
    .max(50)
    .messages({
      'any.required': 'Invoice number is required',
    }),
  invoiceDate: Joi.date()
    .required()
    .messages({
      'any.required': 'Invoice date is required',
    }),
  invoiceTime: Joi.string()
    .required()
    .pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .messages({
      'string.pattern.base': 'Invoice time must be in HH:MM format',
    }),
  
  supplier: Joi.object({
    name: Joi.string().required(),
    contactPerson: Joi.string().allow(''),
    phone: Joi.string().allow(''),
    email: Joi.string().email().allow(''),
    address: Joi.string().allow(''),
  }).required(),

  phones: Joi.array()
    .items(
      Joi.object({
        product: Joi.string().required(), // MongoDB ObjectId
        imei: Joi.string()
          .required()
          .pattern(/^[0-9]{15}$/)
          .messages({
            'string.pattern.base': 'IMEI must be exactly 15 digits',
          }),
        serialNumber: Joi.string().allow(''),
        costPrice: Joi.number().required().min(0),
        sellingPrice: Joi.number().required().min(0),
        condition: Joi.string()
          .valid('New', 'Refurbished', 'Open Box', 'Like New')
          .default('New'),
        warrantyExpiryDate: Joi.date(),
        notes: Joi.string().allow(''),
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one phone is required',
    }),

  financials: Joi.object({
    tax: Joi.object({
      amount: Joi.number().min(0).default(0),
      percentage: Joi.number().min(0).max(100).default(0),
    }),
    discount: Joi.object({
      amount: Joi.number().min(0).default(0),
      percentage: Joi.number().min(0).max(100).default(0),
    }),
    shippingCost: Joi.number().min(0).default(0),
  }),

  payment: Joi.object({
    method: Joi.string()
      .valid('Cash', 'Bank Transfer', 'Cheque', 'Credit', 'Mixed')
      .default('Cash'),
    status: Joi.string()
      .valid('Paid', 'Partial', 'Pending', 'Overdue')
      .default('Paid'),
    paidAmount: Joi.number().min(0).default(0),
    paymentDate: Joi.date(),
    referenceNumber: Joi.string().allow(''),
  }),

  notes: Joi.string().allow(''),
  tags: Joi.array().items(Joi.string()),
});

/**
 * Update phone status validation schema
 */
const updatePhoneStatusSchema = Joi.object({
  status: Joi.string()
    .valid('Available', 'Reserved', 'Sold', 'Returned', 'Damaged', 'Transit')
    .required(),
  soldDate: Joi.date().when('status', {
    is: 'Sold',
    then: Joi.required(),
  }),
  soldTo: Joi.string().when('status', {
    is: 'Sold',
    then: Joi.required(),
  }),
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  createPurchaseInvoiceSchema,
  updatePhoneStatusSchema,
};