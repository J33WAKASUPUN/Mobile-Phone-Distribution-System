const Product = require("../models/Product");
const PurchaseInvoice = require("../models/PurchaseInvoice");
const InventoryService = require("../services/inventoryService");
const { ApiError } = require("../middlewares/errorHandler");
const logger = require("../utils/logger");
const s3Service = require("../config/aws");
const ExcelJS = require("exceljs");

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
      message: "Product created successfully",
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
    const { page = 1, limit = 20, brand, search, isActive } = req.query;

    const filter = {};

    if (brand) filter.brand = brand.toUpperCase();
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search) {
      filter.$or = [
        { brand: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
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
    const {
      invoiceNumber,
      invoiceDate,
      invoiceTime,
      supplier,
      phones,
      financials,
      payment,
      notes,
    } = req.body;

    // Check for duplicate invoice number
    const existingInvoice = await PurchaseInvoice.findOne({ invoiceNumber });
    if (existingInvoice) {
      return next(new ApiError(400, "Invoice number already exists"));
    }

    // Check for duplicate IMEIs
    for (const phone of phones) {
      const isDuplicate = await InventoryService.isIMEIDuplicate(phone.imei);
      if (isDuplicate) {
        return next(
          new ApiError(400, `IMEI ${phone.imei} already exists in inventory`)
        );
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

    logger.info(
      `Purchase invoice created by ${req.user.email}: ${invoiceNumber} with ${phones.length} phones`
    );

    res.status(201).json({
      success: true,
      message: "Purchase invoice created successfully",
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
    if (supplier) filter["supplier.name"] = { $regex: supplier, $options: "i" };
    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) filter.invoiceDate.$gte = new Date(startDate);
      if (endDate) filter.invoiceDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const invoices = await PurchaseInvoice.find(filter)
      .populate("phones.product")
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ invoiceDate: -1 });

    const total = await PurchaseInvoice.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        invoices: invoices.map((inv) => inv.getSummary()),
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
      .populate("phones.product") // ✅ ADD: Populate product details
      .populate("createdBy", "email firstName lastName")
      .populate("verifiedBy", "email firstName lastName");

    if (!invoice) {
      return next(new ApiError(404, "Invoice not found"));
    }

    res.status(200).json({
      success: true,
      message: "Invoice retrieved successfully",
      data: {
        invoice,
      },
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
    const { view = "grouped" } = req.query; // Support 'grouped' or 'detailed' view

    if (view === "detailed") {
      // Return flat list of all available phones
      const stock = await InventoryService.getAvailableStockDetailed();

      return res.status(200).json({
        success: true,
        data: {
          view: "detailed",
          totalPhones: stock.length,
          phones: stock,
        },
      });
    }

    // Default: Return grouped by product (with individual phone details)
    const stock = await InventoryService.getAvailableStock();

    const totalPhones = stock.reduce((sum, item) => sum + item.count, 0);
    const totalValue = stock.reduce((sum, item) => sum + item.totalCost, 0);
    const totalRevenue = stock.reduce(
      (sum, item) => sum + item.totalSellingPrice,
      0
    );

    res.status(200).json({
      success: true,
      data: {
        view: "grouped",
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
      return next(new ApiError(404, "Product not found"));
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
      return next(new ApiError(404, "Product not found"));
    }

    logger.info(`Product updated by ${req.user.email}: ${product.displayName}`);

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
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
      return next(new ApiError(404, "Product not found"));
    }

    logger.info(`Product deleted by ${req.user.email}: ${product.displayName}`);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update invoice (Draft only)
 * @route PUT /api/v1/inventory/invoices/:id
 */
const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await PurchaseInvoice.findById(req.params.id);

    if (!invoice) {
      return next(new ApiError(404, 'Invoice not found'));
    }

    // Only allow editing Draft invoices
    if (invoice.invoiceStatus !== 'Draft') {
      return next(
        new ApiError(
          400,
          `Cannot edit ${invoice.invoiceStatus} invoice. Only Draft invoices can be edited.`
        )
      );
    }

    // Prevent editing if phones are assigned
    const hasAssignedPhones = invoice.phones.some(
      (phone) => phone.status !== 'Available'
    );

    if (hasAssignedPhones) {
      return next(
        new ApiError(
          400,
          'Cannot edit invoice. Some phones are already assigned.'
        )
      );
    }

    // Allow updates
    const updatedInvoice = await PurchaseInvoice.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        invoiceStatus: 'Draft', // Keep as draft
        updatedBy: req.user._id,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    logger.info(
      `Draft invoice updated by ${req.user.email}: ${updatedInvoice.invoiceNumber}`
    );

    res.status(200).json({
      success: true,
      message: 'Invoice updated successfully',
      data: { invoice: updatedInvoice.getSummary() },
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
      return next(new ApiError(400, "Please upload an invoice proof image"));
    }

    const invoice = await PurchaseInvoice.findById(req.params.id);

    if (!invoice) {
      return next(new ApiError(404, "Invoice not found"));
    }

    // Upload to S3
    const uploadResult = await s3Service.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      "invoices"
    );

    // Update invoice with proof details
    invoice.invoiceProof = {
      url: uploadResult.location,
      key: uploadResult.key,
      uploadedAt: new Date(),
    };
    invoice.updatedBy = req.user._id;

    await invoice.save();

    logger.info(
      `Invoice proof uploaded for ${invoice.invoiceNumber} by ${req.user.email}`
    );

    res.status(200).json({
      success: true,
      message: "Invoice proof uploaded successfully",
      data: {
        invoiceProof: invoice.invoiceProof,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify invoice (requires invoice proof image)
 * @route PATCH /api/v1/inventory/invoices/:id/verify
 */
const verifyInvoice = async (req, res, next) => {
  try {
    const invoice = await PurchaseInvoice.findById(req.params.id);

    if (!invoice) {
      return next(new ApiError(404, 'Invoice not found'));
    }

    // Can only verify Draft invoices
    if (invoice.invoiceStatus !== 'Draft') {
      return next(
        new ApiError(
          400,
          `Invoice is already ${invoice.invoiceStatus}. Cannot verify.`
        )
      );
    }

    // MUST have invoice proof uploaded
    if (!invoice.invoiceProof || !invoice.invoiceProof.url) {
      return next(
        new ApiError(
          400,
          'Invoice proof image is required for verification. Please upload invoice proof first.'
        )
      );
    }

    // Verify the invoice
    invoice.invoiceStatus = 'Verified';
    invoice.verifiedBy = req.user._id;
    invoice.verifiedAt = new Date();
    invoice.updatedBy = req.user._id;

    await invoice.save();

    logger.info(
      `Invoice ${invoice.invoiceNumber} verified by ${req.user.email}`
    );

    res.status(200).json({
      success: true,
      message: 'Invoice verified successfully. This invoice is now permanent and cannot be edited.',
      data: {
        invoice: invoice.getSummary(),
        verifiedAt: invoice.verifiedAt,
        verifiedBy: req.user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete invoice (Draft only)
 * @route DELETE /api/v1/inventory/invoices/:id
 */
const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await PurchaseInvoice.findById(req.params.id);

    if (!invoice) {
      return next(new ApiError(404, 'Invoice not found'));
    }

    // Only allow deletion of Draft invoices
    if (invoice.invoiceStatus !== 'Draft') {
      return next(
        new ApiError(
          400,
          `Cannot delete ${invoice.invoiceStatus} invoice. Only Draft invoices can be deleted.`
        )
      );
    }

    // Check if any phones are already assigned/sold
    const hasAssignedPhones = invoice.phones.some(
      (phone) => phone.status !== 'Available'
    );

    if (hasAssignedPhones) {
      return next(
        new ApiError(
          400,
          'Cannot delete invoice. Some phones are already assigned or sold.'
        )
      );
    }

    // Soft delete by changing status to Cancelled
    invoice.invoiceStatus = 'Cancelled';
    invoice.updatedBy = req.user._id;
    await invoice.save();

    logger.info(
      `Invoice ${invoice.invoiceNumber} cancelled by ${req.user.email}`
    );

    res.status(200).json({
      success: true,
      message: 'Invoice cancelled successfully',
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
      "phones.imei": imei,
    });

    if (!invoice) {
      return next(new ApiError(404, "Phone with this IMEI not found"));
    }

    await invoice.updatePhoneStatus(imei, status, { soldDate, soldTo });

    logger.info(
      `Phone ${imei} status updated to ${status} by ${req.user.email}`
    );

    res.status(200).json({
      success: true,
      message: "Phone status updated successfully",
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
    const worksheet = workbook.addWorksheet("Inventory");

    // Define columns
    worksheet.columns = [
      { header: "Brand", key: "brand", width: 15 },
      { header: "Model", key: "model", width: 25 },
      { header: "Storage", key: "storage", width: 10 },
      { header: "RAM", key: "ram", width: 10 },
      { header: "Color", key: "color", width: 15 },
      { header: "Available Quantity", key: "count", width: 18 },
      { header: "Total Cost", key: "totalCost", width: 15 },
      { header: "Total Selling Price", key: "totalSellingPrice", width: 18 },
      { header: "Expected Profit", key: "expectedProfit", width: 15 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    worksheet.getRow(1).font = { color: { argb: "FFFFFFFF" }, bold: true };

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
    ["totalCost", "totalSellingPrice", "expectedProfit"].forEach((col) => {
      worksheet.getColumn(col).numFmt = '"Rs. "#,##0.00';
    });

    // Add borders
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Generate filename
    const filename = `inventory_${new Date().toISOString().split("T")[0]}.xlsx`;

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    // Write to response
    await workbook.xlsx.write(res);

    logger.info(`Inventory exported to Excel by ${req.user.email}`);

    res.end();
  } catch (error) {
    next(error);
  }
};

/**
 * Get all individual phones with details
 * @route GET /api/v1/inventory/phones
 */
const getAllPhones = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      brand,
      condition,
      startDate,
      endDate,
      sortBy = "addedAt",
      sortOrder = "desc",
    } = req.query;

    // Build aggregation pipeline
    const matchStage = {};

    if (status) {
      matchStage["phones.status"] = status;
    }

    if (condition) {
      matchStage["phones.condition"] = condition;
    }

    if (startDate || endDate) {
      matchStage["phones.addedAt"] = {};
      if (startDate) matchStage["phones.addedAt"].$gte = new Date(startDate);
      if (endDate) matchStage["phones.addedAt"].$lte = new Date(endDate);
    }

    const pipeline = [
      { $unwind: "$phones" },
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $lookup: {
          from: "products",
          localField: "phones.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
    ];

    // Add search filter
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "phones.imei": { $regex: search, $options: "i" } },
            { "productDetails.brand": { $regex: search, $options: "i" } },
            { "productDetails.model": { $regex: search, $options: "i" } },
            { invoiceNumber: { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // Add brand filter
    if (brand) {
      pipeline.push({
        $match: { "productDetails.brand": brand.toUpperCase() },
      });
    }

    // Add sorting
    const sortField =
      sortBy === "addedAt" ? "phones.addedAt" : `phones.${sortBy}`;
    pipeline.push({ $sort: { [sortField]: sortOrder === "asc" ? 1 : -1 } });

    // Get total count
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await PurchaseInvoice.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Add pagination
    const skip = (page - 1) * limit;
    pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });

    // Project final structure
    pipeline.push({
      $project: {
        _id: "$phones._id",
        imei: "$phones.imei",
        serialNumber: "$phones.serialNumber",
        costPrice: "$phones.costPrice",
        sellingPrice: "$phones.sellingPrice",
        condition: "$phones.condition",
        status: "$phones.status",
        warrantyExpiryDate: "$phones.warrantyExpiryDate",
        notes: "$phones.notes",
        soldDate: "$phones.soldDate",
        soldTo: "$phones.soldTo",
        addedAt: "$phones.addedAt",
        product: {
          _id: "$productDetails._id",
          brand: "$productDetails.brand",
          model: "$productDetails.model",
          displayName: "$productDetails.displayName",
          specifications: "$productDetails.specifications",
          sku: "$productDetails.sku",
        },
        invoice: {
          _id: "$_id",
          invoiceNumber: "$invoiceNumber",
          invoiceDate: "$invoiceDate",
          supplier: "$supplier",
        },
        profit: { $subtract: ["$phones.sellingPrice", "$phones.costPrice"] },
      },
    });

    const phones = await PurchaseInvoice.aggregate(pipeline);

    res.status(200).json({
      success: true,
      data: {
        phones,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalPhones: total,
          limit: parseInt(limit),
        },
        summary: {
          totalPhones: total,
          totalValue: phones.reduce((sum, p) => sum + p.costPrice, 0),
          totalSellingValue: phones.reduce((sum, p) => sum + p.sellingPrice, 0),
          totalProfit: phones.reduce((sum, p) => sum + p.profit, 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get phone by IMEI (detailed view)
 * @route GET /api/v1/inventory/phones/:imei
 */
const getPhoneByIMEI = async (req, res, next) => {
  try {
    const { imei } = req.params;

    const result = await PurchaseInvoice.aggregate([
      { $unwind: "$phones" },
      { $match: { "phones.imei": imei } },
      {
        $lookup: {
          from: "products",
          localField: "phones.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $lookup: {
          from: "dsrassignments",
          let: { phoneImei: "$phones.imei" },
          pipeline: [
            { $unwind: "$phones" },
            { $match: { $expr: { $eq: ["$phones.imei", "$$phoneImei"] } } },
            {
              $lookup: {
                from: "users",
                localField: "dsr",
                foreignField: "_id",
                as: "dsrDetails",
              },
            },
            {
              $unwind: {
                path: "$dsrDetails",
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
          as: "assignmentDetails",
        },
      },
      {
        $project: {
          phone: {
            imei: "$phones.imei",
            serialNumber: "$phones.serialNumber",
            costPrice: "$phones.costPrice",
            sellingPrice: "$phones.sellingPrice",
            condition: "$phones.condition",
            status: "$phones.status",
            warrantyExpiryDate: "$phones.warrantyExpiryDate",
            notes: "$phones.notes",
            soldDate: "$phones.soldDate",
            soldTo: "$phones.soldTo",
            addedAt: "$phones.addedAt",
          },
          product: "$productDetails",
          invoice: {
            _id: "$_id",
            invoiceNumber: "$invoiceNumber",
            invoiceDate: "$invoiceDate",
            supplier: "$supplier",
          },
          assignment: { $arrayElemAt: ["$assignmentDetails", 0] },
        },
      },
    ]);

    if (!result || result.length === 0) {
      return next(new ApiError(404, "Phone with this IMEI not found"));
    }

    res.status(200).json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update phone details
 * @route PATCH /api/v1/inventory/phones/:imei
 */
const updatePhone = async (req, res, next) => {
  try {
    const { imei } = req.params;
    const { costPrice, sellingPrice, condition, notes, warrantyExpiryDate } =
      req.body;

    const invoice = await PurchaseInvoice.findOne({ "phones.imei": imei });

    if (!invoice) {
      return next(new ApiError(404, "Phone with this IMEI not found"));
    }

    const phone = invoice.phones.find((p) => p.imei === imei);

    // Only allow editing if phone is Available or Damaged
    if (phone.status !== "Available" && phone.status !== "Damaged") {
      return next(
        new ApiError(400, `Cannot edit phone with status: ${phone.status}`)
      );
    }

    // Update phone details
    if (costPrice !== undefined) phone.costPrice = costPrice;
    if (sellingPrice !== undefined) phone.sellingPrice = sellingPrice;
    if (condition) phone.condition = condition;
    if (notes !== undefined) phone.notes = notes;
    if (warrantyExpiryDate) phone.warrantyExpiryDate = warrantyExpiryDate;

    invoice.updatedBy = req.user._id;
    await invoice.save();

    logger.info(`Phone ${imei} updated by ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: "Phone updated successfully",
      data: { phone },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete phone (Owner only)
 * @route DELETE /api/v1/inventory/phones/:imei
 */
const deletePhone = async (req, res, next) => {
  try {
    const { imei } = req.params;

    const invoice = await PurchaseInvoice.findOne({ "phones.imei": imei });

    if (!invoice) {
      return next(new ApiError(404, "Phone with this IMEI not found"));
    }

    const phone = invoice.phones.find((p) => p.imei === imei);

    // Only allow deletion if phone is Available
    if (phone.status !== "Available") {
      return next(
        new ApiError(
          400,
          `Cannot delete phone with status: ${phone.status}. Only Available phones can be deleted.`
        )
      );
    }

    // Remove phone from invoice
    invoice.phones = invoice.phones.filter((p) => p.imei !== imei);

    // If invoice has no phones left, delete the invoice
    if (invoice.phones.length === 0) {
      await invoice.deleteOne();
      logger.info(
        `Invoice ${invoice.invoiceNumber} deleted (no phones remaining) by ${req.user.email}`
      );
    } else {
      await invoice.save();
    }

    logger.info(`Phone ${imei} deleted by ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: "Phone deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Add to module.exports
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
  deleteInvoice,
  verifyInvoice,
  searchByIMEI,
  getAvailableStock,
  getStatistics,
  updatePhoneStatus,
  exportInventoryToExcel,
  getAllPhones,
  getPhoneByIMEI,
  updatePhone,
  deletePhone,
};