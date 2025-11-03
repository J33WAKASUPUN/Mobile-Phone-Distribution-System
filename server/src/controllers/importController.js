const ExcelJS = require('exceljs');
const Product = require('../models/Product');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Generate Excel template for product import
 * @route GET /api/v1/inventory/import/templates/products
 */
const downloadProductTemplate = async (req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products Template');

    // Define columns with instructions
    worksheet.columns = [
      { header: 'Brand*', key: 'brand', width: 15 },
      { header: 'Model*', key: 'model', width: 25 },
      { header: 'Variant', key: 'variant', width: 20 },
      { header: 'Storage*', key: 'storage', width: 12 },
      { header: 'RAM*', key: 'ram', width: 10 },
      { header: 'Color*', key: 'color', width: 15 },
      { header: 'Screen Size', key: 'screenSize', width: 15 },
      { header: 'Battery', key: 'battery', width: 12 },
      { header: 'Camera', key: 'camera', width: 20 },
      { header: 'Processor', key: 'processor', width: 20 },
      { header: 'OS', key: 'os', width: 15 },
      { header: 'SIM Type', key: 'simType', width: 15 },
      { header: 'Connectivity', key: 'connectivity', width: 25 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Features', key: 'features', width: 40 },
      { header: 'Box Contents', key: 'boxContents', width: 40 },
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add sample data
    worksheet.addRow({
      brand: 'SAMSUNG',
      model: 'Galaxy S23 Ultra',
      variant: '256GB Phantom Black',
      storage: '256GB',
      ram: '12GB',
      color: 'Phantom Black',
      screenSize: '6.8 inches',
      battery: '5000mAh',
      camera: '200MP + 10MP + 10MP + 12MP',
      processor: 'Snapdragon 8 Gen 2',
      os: 'Android 13',
      simType: 'Dual SIM',
      connectivity: '5G, WiFi 6E, Bluetooth 5.3',
      description: 'Flagship Samsung phone with best-in-class camera',
      features: 'S Pen, 120Hz Display, Gorilla Glass Victus 2',
      boxContents: 'Phone, S Pen, USB-C Cable, SIM Tool',
    });

    worksheet.addRow({
      brand: 'APPLE',
      model: 'iPhone 15 Pro Max',
      variant: '256GB Natural Titanium',
      storage: '256GB',
      ram: '8GB',
      color: 'Natural Titanium',
      screenSize: '6.7 inches',
      battery: '4422mAh',
      camera: '48MP + 12MP + 12MP',
      processor: 'A17 Pro',
      os: 'iOS 17',
      simType: 'Dual eSIM',
      connectivity: '5G, WiFi 6E, Bluetooth 5.3',
      description: 'Latest iPhone with titanium design',
      features: 'Titanium Build, Action Button, ProMotion 120Hz',
      boxContents: 'iPhone, USB-C Cable, SIM Tool, Documentation',
    });

    // Add instructions
    worksheet.addRow({});
    worksheet.addRow({ brand: 'INSTRUCTIONS:' }).font = { bold: true, color: { argb: 'FFFF0000' } };
    worksheet.addRow({ brand: '* = Required fields' });
    worksheet.addRow({ brand: 'For multiple values (Connectivity, Features, Box Contents), separate with commas' });
    worksheet.addRow({ brand: 'Delete sample rows before importing' });

    const filename = `products_import_template_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    logger.info(`Product template downloaded by ${req.user.email}`);
    res.end();
  } catch (error) {
    next(error);
  }
};

/**
 * Generate Excel template for invoice import
 * @route GET /api/v1/inventory/import/templates/invoices
 */
const downloadInvoiceTemplate = async (req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invoices Template');

    worksheet.columns = [
      { header: 'Invoice Number*', key: 'invoiceNumber', width: 20 },
      { header: 'Invoice Date* (YYYY-MM-DD)', key: 'invoiceDate', width: 20 },
      { header: 'Invoice Time* (HH:MM)', key: 'invoiceTime', width: 15 },
      { header: 'Supplier Name*', key: 'supplierName', width: 30 },
      { header: 'Supplier Contact', key: 'supplierContact', width: 20 },
      { header: 'Supplier Phone', key: 'supplierPhone', width: 15 },
      { header: 'Supplier Email', key: 'supplierEmail', width: 25 },
      { header: 'Product ID*', key: 'productId', width: 25 },
      { header: 'IMEI* (15 digits)', key: 'imei', width: 20 },
      { header: 'Cost Price*', key: 'costPrice', width: 15 },
      { header: 'Selling Price*', key: 'sellingPrice', width: 15 },
      { header: 'Condition', key: 'condition', width: 15 },
      { header: 'Warranty Expiry (YYYY-MM-DD)', key: 'warrantyExpiry', width: 20 },
      { header: 'Discount Amount', key: 'discountAmount', width: 15 },
      { header: 'Shipping Cost', key: 'shippingCost', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Payment Status', key: 'paymentStatus', width: 15 },
      { header: 'Notes', key: 'notes', width: 40 },
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };

    // Sample data
    worksheet.addRow({
      invoiceNumber: 'INV-2024-001',
      invoiceDate: '2024-01-15',
      invoiceTime: '10:30',
      supplierName: 'Tech Distributors Lanka',
      supplierContact: 'Mr. Kasun',
      supplierPhone: '0771234567',
      supplierEmail: 'kasun@techdist.lk',
      productId: 'PASTE_PRODUCT_ID_HERE',
      imei: '123456789012345',
      costPrice: 280000,
      sellingPrice: 310000,
      condition: 'New',
      warrantyExpiry: '2025-01-15',
      discountAmount: 5000,
      shippingCost: 2000,
      paymentMethod: 'Bank Transfer',
      paymentStatus: 'Paid',
      notes: 'Initial stock purchase',
    });

    // Add instructions
    worksheet.addRow({});
    worksheet.addRow({ invoiceNumber: 'INSTRUCTIONS:' }).font = { bold: true, color: { argb: 'FFFF0000' } };
    worksheet.addRow({ invoiceNumber: '1. Get Product IDs from: GET /api/v1/inventory/products' });
    worksheet.addRow({ invoiceNumber: '2. Same invoice number = phones grouped under one invoice' });
    worksheet.addRow({ invoiceNumber: '3. Each row = one phone with unique IMEI' });
    worksheet.addRow({ invoiceNumber: '4. Condition: New, Refurbished, Open Box, Like New' });
    worksheet.addRow({ invoiceNumber: '5. Payment Method: Cash, Bank Transfer, Cheque, Credit, Mixed' });
    worksheet.addRow({ invoiceNumber: '6. Payment Status: Paid, Partial, Pending, Overdue' });
    worksheet.addRow({ invoiceNumber: '7. Delete sample row before importing' });

    const filename = `invoices_import_template_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    logger.info(`Invoice template downloaded by ${req.user.email}`);
    res.end();
  } catch (error) {
    next(error);
  }
};

/**
 * Import products from Excel
 * @route POST /api/v1/inventory/import/products
 */
const importProducts = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ApiError(400, 'Please upload an Excel file'));
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.getWorksheet(1);
    const products = [];
    const errors = [];

    // Get total rows
    const totalRows = worksheet.rowCount;

    // Process each row (skip header row 1)
    worksheet.eachRow((row, rowNumber) => {
      // Skip header row
      if (rowNumber === 1) {
        return;
      }

      // Skip empty rows
      const brand = row.getCell(1).value;
      if (!brand || brand.toString().trim() === '' || brand.toString().toUpperCase() === 'INSTRUCTIONS:') {
        return; // Skip instruction rows and empty rows
      }

      try {
        const model = row.getCell(2).value;
        const variant = row.getCell(3).value;
        const storage = row.getCell(4).value;
        const ram = row.getCell(5).value;
        const color = row.getCell(6).value;

        // Validate required fields
        if (!brand || !model || !storage || !ram || !color) {
          errors.push({
            row: rowNumber,
            error: 'Missing required fields (Brand, Model, Storage, RAM, Color)',
            data: { brand, model, storage, ram, color },
          });
          return;
        }

        // Parse arrays (comma-separated values)
        const connectivity = row.getCell(13).value 
          ? row.getCell(13).value.toString().split(',').map(s => s.trim())
          : [];
        
        const features = row.getCell(15).value
          ? row.getCell(15).value.toString().split(',').map(s => s.trim())
          : [];

        const boxContents = row.getCell(16).value
          ? row.getCell(16).value.toString().split(',').map(s => s.trim())
          : [];

        const productData = {
          brand: brand.toString().toUpperCase(),
          model: model.toString(),
          variant: variant ? variant.toString() : '',
          specifications: {
            storage: storage.toString(),
            ram: ram.toString(),
            color: color.toString(),
            screenSize: row.getCell(7).value ? row.getCell(7).value.toString() : '',
            battery: row.getCell(8).value ? row.getCell(8).value.toString() : '',
            camera: row.getCell(9).value ? row.getCell(9).value.toString() : '',
            processor: row.getCell(10).value ? row.getCell(10).value.toString() : '',
            os: row.getCell(11).value ? row.getCell(11).value.toString() : '',
            simType: row.getCell(12).value ? row.getCell(12).value.toString() : '',
            connectivity,
          },
          description: row.getCell(14).value ? row.getCell(14).value.toString() : '',
          features,
          boxContents,
          createdBy: req.user._id,
        };

        products.push(productData);
        logger.info(`Row ${rowNumber}: Parsed product - ${productData.brand} ${productData.model}`);
      } catch (error) {
        errors.push({
          row: rowNumber,
          error: error.message,
        });
        logger.error(`Row ${rowNumber}: Parse error - ${error.message}`);
      }
    });

    logger.info(`Total rows processed: ${products.length}, Errors: ${errors.length}`);

    // Insert products
    let successCount = 0;
    const createdProducts = [];

    for (const productData of products) {
      try {
        const product = await Product.create(productData);
        createdProducts.push(product);
        successCount++;
        logger.info(`Product created: ${product.displayName}`);
      } catch (error) {
        errors.push({
          product: `${productData.brand} ${productData.model}`,
          error: error.message,
        });
        logger.error(`Failed to create product: ${productData.brand} ${productData.model} - ${error.message}`);
      }
    }

    logger.info(`${successCount} products imported by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: `Successfully imported ${successCount} products`,
      data: {
        successCount,
        totalRows: products.length,
        errors: errors.length > 0 ? errors : undefined,
        products: createdProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Import purchase invoices from Excel
 * @route POST /api/v1/inventory/import/invoices
 */
const importInvoices = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ApiError(400, 'Please upload an Excel file'));
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.getWorksheet(1);
    const invoicesMap = new Map(); // Group phones by invoice number
    const errors = [];

    worksheet.eachRow((row, rowNumber) => {
      // Skip header row
      if (rowNumber === 1) {
        return;
      }

      // Skip empty rows and instruction rows
      const invoiceNumber = row.getCell(1).value;
      if (!invoiceNumber || invoiceNumber.toString().trim() === '' || invoiceNumber.toString().toUpperCase() === 'INSTRUCTIONS:') {
        return;
      }

      try {
        const invoiceDate = row.getCell(2).value;
        const invoiceTime = row.getCell(3).value;
        const productId = row.getCell(8).value;
        const imei = row.getCell(9).value;
        const costPrice = row.getCell(10).value;
        const sellingPrice = row.getCell(11).value;

        // Validate required fields
        if (!invoiceNumber || !invoiceDate || !invoiceTime || !productId || !imei || !costPrice || !sellingPrice) {
          errors.push({
            row: rowNumber,
            error: 'Missing required fields',
            data: { invoiceNumber, invoiceDate, invoiceTime, productId, imei, costPrice, sellingPrice },
          });
          return;
        }

        // Validate IMEI (15 digits)
        const imeiStr = imei.toString().replace(/\s/g, '');
        if (!/^[0-9]{15}$/.test(imeiStr)) {
          errors.push({
            row: rowNumber,
            error: `Invalid IMEI: ${imei} (must be 15 digits)`,
          });
          return;
        }

        // Create or get invoice entry
        if (!invoicesMap.has(invoiceNumber.toString())) {
          invoicesMap.set(invoiceNumber.toString(), {
            invoiceNumber: invoiceNumber.toString().toUpperCase(),
            invoiceDate: new Date(invoiceDate),
            invoiceTime: invoiceTime.toString(),
            supplier: {
              name: row.getCell(4).value ? row.getCell(4).value.toString() : 'Unknown Supplier',
              contactPerson: row.getCell(5).value ? row.getCell(5).value.toString() : '',
              phone: row.getCell(6).value ? row.getCell(6).value.toString() : '',
              email: row.getCell(7).value ? row.getCell(7).value.toString() : '',
            },
            phones: [],
            financials: {
              discount: {
                amount: row.getCell(14).value ? parseFloat(row.getCell(14).value) : 0,
              },
              shippingCost: row.getCell(15).value ? parseFloat(row.getCell(15).value) : 0,
            },
            payment: {
              method: row.getCell(16).value ? row.getCell(16).value.toString() : 'Cash',
              status: row.getCell(17).value ? row.getCell(17).value.toString() : 'Paid',
            },
            notes: row.getCell(18).value ? row.getCell(18).value.toString() : '',
          });
          logger.info(`Created invoice entry: ${invoiceNumber}`);
        }

        // Add phone to invoice
        const invoice = invoicesMap.get(invoiceNumber.toString());
        invoice.phones.push({
          product: productId.toString(),
          imei: imeiStr,
          costPrice: parseFloat(costPrice),
          sellingPrice: parseFloat(sellingPrice),
          condition: row.getCell(12).value ? row.getCell(12).value.toString() : 'New',
          warrantyExpiryDate: row.getCell(13).value ? new Date(row.getCell(13).value) : undefined,
        });

        logger.info(`Row ${rowNumber}: Added phone ${imeiStr} to invoice ${invoiceNumber}`);

      } catch (error) {
        errors.push({
          row: rowNumber,
          error: error.message,
        });
        logger.error(`Row ${rowNumber}: Parse error - ${error.message}`);
      }
    });

    logger.info(`Total invoices to create: ${invoicesMap.size}`);

    // Insert invoices
    let successCount = 0;
    const createdInvoices = [];

    for (const [invoiceNumber, invoiceData] of invoicesMap) {
      try {
        // Check for duplicate invoice number
        const existing = await PurchaseInvoice.findOne({ invoiceNumber });
        if (existing) {
          errors.push({
            invoice: invoiceNumber,
            error: 'Invoice number already exists',
          });
          continue;
        }

        // Check for duplicate IMEIs
        let skipInvoice = false;
        for (const phone of invoiceData.phones) {
          const existingIMEI = await PurchaseInvoice.findOne({
            'phones.imei': phone.imei,
          });
          if (existingIMEI) {
            errors.push({
              invoice: invoiceNumber,
              imei: phone.imei,
              error: 'IMEI already exists in system',
            });
            skipInvoice = true;
            break;
          }
        }

        if (skipInvoice) continue;

        invoiceData.createdBy = req.user._id;

        const invoice = await PurchaseInvoice.create(invoiceData);
        createdInvoices.push(invoice);
        successCount++;
        logger.info(`Invoice created: ${invoice.invoiceNumber} with ${invoice.phones.length} phones`);
      } catch (error) {
        errors.push({
          invoice: invoiceNumber,
          error: error.message,
        });
        logger.error(`Failed to create invoice ${invoiceNumber}: ${error.message}`);
      }
    }

    logger.info(`${successCount} invoices imported by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: `Successfully imported ${successCount} invoices`,
      data: {
        successCount,
        totalInvoices: invoicesMap.size,
        errors: errors.length > 0 ? errors : undefined,
        invoices: createdInvoices.map(inv => inv.getSummary()),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  downloadProductTemplate,
  downloadInvoiceTemplate,
  importProducts,
  importInvoices,
};