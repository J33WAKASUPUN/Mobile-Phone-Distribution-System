const Product = require('../models/Product');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const InventoryService = require('../services/inventoryService');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const s3Service = require('../config/aws');
const ExcelJS = require('exceljs');

/**
 * Create new product (Owner only)
 * @route POST /api/v1/inventory/products
 */
const createProduct = async (req, res, next) => {
  try {
    const product = await Product.create({
      ...req.body,
      createdBy: req.user._id,
    });

    logger.info(`Product created by ${req.user.email}: ${product.displayName}`);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all products
 * @route GET /api/v1/inventory/products
 */
const getAllProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      brand,
      search,
      isActive,
    } = req.query;

    const filter = {};

    if (brand) filter.brand = brand.toUpperCase();
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(filter)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ brand: 1, model: 1 });

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalProducts: total,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create purchase invoice with phones (Owner only)
 * @route POST /api/v1/inventory/invoices
 */
const createPurchaseInvoice = async (req, res, next) => {
  try {
    const { invoiceNumber, invoiceDate, invoiceTime, supplier, phones, financials, payment, notes } = req.body;

    // Check for duplicate invoice number
    const existingInvoice = await PurchaseInvoice.findOne({ invoiceNumber });
    if (existingInvoice) {
      return next(new ApiError(400, 'Invoice number already exists'));
    }

    // Check for duplicate IMEIs
    for (const phone of phones) {
      const isDuplicate = await InventoryService.isIMEIDuplicate(phone.imei);
      if (isDuplicate) {
        return next(new ApiError(400, `IMEI ${phone.imei} already exists in inventory`));
      }
    }

    // Invoice proof will be uploaded separately via file upload endpoint
    // For now, we'll create without it and update later
    const invoice = await PurchaseInvoice.create({
      invoiceNumber,
      invoiceDate,
      invoiceTime,
      supplier,
      phones,
      financials,
      payment,
      notes,
      createdBy: req.user._id,
    });

    logger.info(`Purchase invoice created by ${req.user.email}: ${invoiceNumber} with ${phones.length} phones`);

    res.status(201).json({
      success: true,
      message: 'Purchase invoice created successfully',
      data: { invoice: invoice.getSummary() },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all purchase invoices
 * @route GET /api/v1/inventory/invoices
 */
const getAllInvoices = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
      supplier,
    } = req.query;

    const filter = {};

    if (status) filter.invoiceStatus = status;
    if (supplier) filter['supplier.name'] = { $regex: supplier, $options: 'i' };
    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) filter.invoiceDate.$gte = new Date(startDate);
      if (endDate) filter.invoiceDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const invoices = await PurchaseInvoice.find(filter)
      .populate('phones.product')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ invoiceDate: -1 });

    const total = await PurchaseInvoice.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        invoices: invoices.map(inv => inv.getSummary()),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalInvoices: total,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get invoice by ID
 * @route GET /api/v1/inventory/invoices/:id
 */
const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await PurchaseInvoice.findById(req.params.id)
      .populate('phones.product')
      .populate('createdBy', 'firstName lastName email')
      .populate('verifiedBy', 'firstName lastName email');

    if (!invoice) {
      return next(new ApiError(404, 'Invoice not found'));
    }

    res.status(200).json({
      success: true,
      data: { invoice },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search phone by IMEI
 * @route GET /api/v1/inventory/search/imei/:imei
 */
const searchByIMEI = async (req, res, next) => {
  try {
    const { imei } = req.params;

    const result = await InventoryService.searchByIMEI(imei);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get available stock (now includes individual phones with IMEI)
 * @route GET /api/v1/inventory/stock/available
 */
const getAvailableStock = async (req, res, next) => {
  try {
    const { view = 'grouped' } = req.query; // Support 'grouped' or 'detailed' view

    if (view === 'detailed') {
      // Return flat list of all available phones
      const stock = await InventoryService.getAvailableStockDetailed();

      return res.status(200).json({
        success: true,
        data: {
          view: 'detailed',
          totalPhones: stock.length,
          phones: stock,
        },
      });
    }

    // Default: Return grouped by product (with individual phone details)
    const stock = await InventoryService.getAvailableStock();

    const totalPhones = stock.reduce((sum, item) => sum + item.count, 0);
    const totalValue = stock.reduce((sum, item) => sum + item.totalCost, 0);
    const totalRevenue = stock.reduce((sum, item) => sum + item.totalSellingPrice, 0);

    res.status(200).json({
      success: true,
      data: {
        view: 'grouped',
        summary: {
          totalProducts: stock.length,
          totalPhones: totalPhones,
          totalInventoryValue: totalValue,
          expectedRevenue: totalRevenue,
          expectedProfit: totalRevenue - totalValue,
        },
        stock: stock,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get inventory statistics
 * @route GET /api/v1/inventory/statistics
 */
const getStatistics = async (req, res, next) => {
  try {
    const stats = await InventoryService.getStatistics();

    res.status(200).json({
      success: true,
      data: { statistics: stats },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get product by ID
 * @route GET /api/v1/inventory/products/:id
 */
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(new ApiError(404, 'Product not found'));
    }

    res.status(200).json({
      success: true,
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product (Owner only)
 * @route PUT /api/v1/inventory/products/:id
 */
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user._id,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!product) {
      return next(new ApiError(404, 'Product not found'));
    }

    logger.info(`Product updated by ${req.user.email}: ${product.displayName}`);

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product (soft delete - Owner only)
 * @route DELETE /api/v1/inventory/products/:id
 */
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        isActive: false,
        isDiscontinued: true,
        updatedBy: req.user._id,
      },
      { new: true }
    );

    if (!product) {
      return next(new ApiError(404, 'Product not found'));
    }

    logger.info(`Product deleted by ${req.user.email}: ${product.displayName}`);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update invoice
 * @route PUT /api/v1/inventory/invoices/:id
 */
const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await PurchaseInvoice.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user._id,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!invoice) {
      return next(new ApiError(404, 'Invoice not found'));
    }

    logger.info(`Invoice updated by ${req.user.email}: ${invoice.invoiceNumber}`);

    res.status(200).json({
      success: true,
      message: 'Invoice updated successfully',
      data: { invoice: invoice.getSummary() },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload invoice proof to S3
 * @route POST /api/v1/inventory/invoices/:id/upload-proof
 */
const uploadInvoiceProof = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ApiError(400, 'Please upload an invoice proof image'));
    }

    const invoice = await PurchaseInvoice.findById(req.params.id);

    if (!invoice) {
      return next(new ApiError(404, 'Invoice not found'));
    }

    // Upload to S3
    const uploadResult = await s3Service.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'invoices'
    );

    // Update invoice with proof details
    invoice.invoiceProof = {
      url: uploadResult.location,
      key: uploadResult.key,
      uploadedAt: new Date(),
    };
    invoice.updatedBy = req.user._id;

    await invoice.save();

    logger.info(`Invoice proof uploaded for ${invoice.invoiceNumber} by ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: 'Invoice proof uploaded successfully',
      data: {
        invoiceProof: invoice.invoiceProof,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update phone status
 * @route PATCH /api/v1/inventory/phones/:imei/status
 */
const updatePhoneStatus = async (req, res, next) => {
  try {
    const { imei } = req.params;
    const { status, soldDate, soldTo } = req.body;

    const invoice = await PurchaseInvoice.findOne({
      'phones.imei': imei,
    });

    if (!invoice) {
      return next(new ApiError(404, 'Phone with this IMEI not found'));
    }

    await invoice.updatePhoneStatus(imei, status, { soldDate, soldTo });

    logger.info(`Phone ${imei} status updated to ${status} by ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: 'Phone status updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export inventory to Excel
 * @route GET /api/v1/inventory/export/excel
 */
const exportInventoryToExcel = async (req, res, next) => {
  try {
    // Get all available stock
    const stock = await InventoryService.getAvailableStock();

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventory');

    // Define columns
    worksheet.columns = [
      { header: 'Brand', key: 'brand', width: 15 },
      { header: 'Model', key: 'model', width: 25 },
      { header: 'Storage', key: 'storage', width: 10 },
      { header: 'RAM', key: 'ram', width: 10 },
      { header: 'Color', key: 'color', width: 15 },
      { header: 'Available Quantity', key: 'count', width: 18 },
      { header: 'Total Cost', key: 'totalCost', width: 15 },
      { header: 'Total Selling Price', key: 'totalSellingPrice', width: 18 },
      { header: 'Expected Profit', key: 'expectedProfit', width: 15 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add data rows
    stock.forEach((item) => {
      worksheet.addRow({
        brand: item.productDetails.brand,
        model: item.productDetails.model,
        storage: item.productDetails.specifications.storage,
        ram: item.productDetails.specifications.ram,
        color: item.productDetails.specifications.color,
        count: item.count,
        totalCost: item.totalCost.toFixed(2),
        totalSellingPrice: item.totalSellingPrice.toFixed(2),
        expectedProfit: (item.totalSellingPrice - item.totalCost).toFixed(2),
      });
    });

    // Format currency columns
    ['totalCost', 'totalSellingPrice', 'expectedProfit'].forEach((col) => {
      worksheet.getColumn(col).numFmt = '"Rs. "#,##0.00';
    });

    // Add borders
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Generate filename
    const filename = `inventory_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    // Write to response
    await workbook.xlsx.write(res);

    logger.info(`Inventory exported to Excel by ${req.user.email}`);

    res.end();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  createPurchaseInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  uploadInvoiceProof,
  searchByIMEI,
  getAvailableStock,
  getStatistics,
  updatePhoneStatus,
  exportInventoryToExcel,
};
