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
 * Generate Excel template for invoice import (COLOR OPTIONAL)
 * @route GET /api/v1/inventory/import/templates/invoices
 */
const downloadInvoiceTemplate = async (req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const invoiceSheet = workbook.addWorksheet('Invoices Template');

    // ✅ Main invoice template columns
    invoiceSheet.columns = [
      { header: 'Invoice Number*', key: 'invoiceNumber', width: 20 },
      { header: 'Invoice Date* (YYYY-MM-DD)', key: 'invoiceDate', width: 20 },
      { header: 'Invoice Time* (HH:MM)', key: 'invoiceTime', width: 15 },
      { header: 'Supplier Name*', key: 'supplierName', width: 30 },
      { header: 'Supplier Contact', key: 'supplierContact', width: 20 },
      { header: 'Supplier Phone', key: 'supplierPhone', width: 15 },
      { header: 'Supplier Email', key: 'supplierEmail', width: 25 },
      { header: 'Brand*', key: 'brand', width: 15 },
      { header: 'Model*', key: 'model', width: 25 },
      { header: 'Storage*', key: 'storage', width: 12 },
      { header: 'Color (Optional)', key: 'color', width: 15 }, // Changed to optional
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
    invoiceSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    invoiceSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };

    // ✅ Get real products from database for sample data
    const sampleProducts = await Product.find({ isActive: true })
      .limit(3)
      .select('brand model specifications');

    if (sampleProducts.length > 0) {
      sampleProducts.forEach((product, index) => {
        invoiceSheet.addRow({
          invoiceNumber: `INV-2025-${String(index + 1).padStart(3, '0')}`,
          invoiceDate: '2025-01-15',
          invoiceTime: '10:30',
          supplierName: 'Tech Distributors Lanka',
          supplierContact: 'Mr. Kasun',
          supplierPhone: '0112345678',
          supplierEmail: 'kasun@techdist.lk',
          brand: product.brand,
          model: product.model,
          storage: product.specifications.storage,
          color: product.specifications.color, // Real color from database
          imei: `12345678901234${index}`,
          costPrice: 350000,
          sellingPrice: 380000,
          condition: 'New',
          warrantyExpiry: '2026-01-15',
          discountAmount: 5000,
          shippingCost: 2000,
          paymentMethod: 'Bank Transfer',
          paymentStatus: 'Paid',
          notes: `Sample ${product.brand} ${product.model}`,
        });
      });
    } else {
      // Fallback sample
      invoiceSheet.addRow({
        invoiceNumber: 'INV-2025-001',
        invoiceDate: '2025-01-15',
        invoiceTime: '10:30',
        supplierName: 'Tech Distributors Lanka',
        supplierContact: 'Mr. Kasun',
        supplierPhone: '0112345678',
        supplierEmail: 'kasun@techdist.lk',
        brand: 'SAMSUNG',
        model: 'Galaxy S23 Ultra',
        storage: '256GB',
        color: '', // ✅ Empty to show it's optional
        imei: '123456789012345',
        costPrice: 350000,
        sellingPrice: 380000,
        condition: 'New',
        warrantyExpiry: '2026-01-15',
        discountAmount: 5000,
        shippingCost: 2000,
        paymentMethod: 'Bank Transfer',
        paymentStatus: 'Paid',
        notes: 'Color optional - system will auto-match',
      });
    }

    // Add instructions
    invoiceSheet.addRow({});
    invoiceSheet.addRow({ invoiceNumber: 'INSTRUCTIONS:' }).font = { 
      bold: true, 
      color: { argb: 'FFFF0000' } 
    };
    invoiceSheet.addRow({ invoiceNumber: '1. Brand, Model, and Storage are REQUIRED' });
    invoiceSheet.addRow({ invoiceNumber: '2. Color is OPTIONAL - leave blank to auto-match first available variant' });
    invoiceSheet.addRow({ invoiceNumber: '3. If multiple colors exist for same product, system will ask you to specify' });
    invoiceSheet.addRow({ invoiceNumber: '4. Same invoice number = phones grouped under one invoice' });
    invoiceSheet.addRow({ invoiceNumber: '5. Each row = one phone with unique IMEI' });
    invoiceSheet.addRow({ invoiceNumber: '6. Condition: New, Refurbished, Open Box, Like New' });
    invoiceSheet.addRow({ invoiceNumber: '7. Payment Method: Cash, Bank Transfer, Cheque, Credit, Mixed' });
    invoiceSheet.addRow({ invoiceNumber: '8. Payment Status: Paid, Partial, Pending, Overdue' });
    invoiceSheet.addRow({ invoiceNumber: '9. Delete sample rows before importing' });

    // ✅ ADD SECOND SHEET: Product Catalog for reference
    const catalogSheet = workbook.addWorksheet('Product Catalog (Reference)');

    catalogSheet.columns = [
      { header: 'Brand', key: 'brand', width: 15 },
      { header: 'Model', key: 'model', width: 30 },
      { header: 'Storage', key: 'storage', width: 12 },
      { header: 'Color', key: 'color', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    // Style header
    catalogSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    catalogSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2E7D32' }, // Green background
    };

    // Get all active products from database
    const allProducts = await Product.find({ isActive: true })
      .select('brand model specifications')
      .sort({ brand: 1, model: 1 });

    // Add products to catalog sheet
    allProducts.forEach(product => {
      catalogSheet.addRow({
        brand: product.brand,
        model: product.model,
        storage: product.specifications.storage,
        color: product.specifications.color,
        status: 'Available',
      });
    });

    // Add note
    catalogSheet.addRow({});
    catalogSheet.addRow({ 
      brand: 'NOTE: Use exact Brand, Model, and Storage from this list.' 
    }).font = { bold: true, color: { argb: 'FFFF0000' } };
    catalogSheet.addRow({ 
      brand: 'Color can be left blank - system will auto-match if only one variant exists.' 
    });

    const filename = `invoices_import_template_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    logger.info(`Invoice template with product catalog downloaded by ${req.user.email}`);
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

    // Process each row (skip header row 1)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const brand = row.getCell(1).value;
      if (!brand || brand.toString().trim() === '' || brand.toString().toUpperCase() === 'INSTRUCTIONS:') {
        return;
      }

      try {
        const model = row.getCell(2).value;
        const variant = row.getCell(3).value;
        const storage = row.getCell(4).value;
        const ram = row.getCell(5).value;
        const color = row.getCell(6).value;

        if (!brand || !model || !storage || !ram || !color) {
          errors.push({
            row: rowNumber,
            error: 'Missing required fields (Brand, Model, Storage, RAM, Color)',
            data: { brand, model, storage, ram, color },
          });
          return;
        }

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
      }
    });

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
 * Import purchase invoices from Excel (SMART COLOR MATCHING)
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

    const invoicesMap = new Map();
    const errors = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const invoiceNumber = row.getCell(1).value;
      if (!invoiceNumber || invoiceNumber.toString().trim() === '' || invoiceNumber.toString().toUpperCase() === 'INSTRUCTIONS:') {
        return;
      }

      try {
        const brand = row.getCell(8).value?.toString().trim().toUpperCase();
        const model = row.getCell(9).value?.toString().trim();
        const storage = row.getCell(10).value?.toString().trim();
        const color = row.getCell(11).value?.toString().trim() || ''; // Optional
        const imei = row.getCell(12).value?.toString().replace(/\s/g, '');

        if (!invoicesMap.has(invoiceNumber.toString())) {
          invoicesMap.set(invoiceNumber.toString(), {
            invoiceNumber: invoiceNumber.toString().toUpperCase(),
            invoiceDate: new Date(row.getCell(2).value),
            invoiceTime: row.getCell(3).value?.toString(),
            supplier: {
              name: row.getCell(4).value?.toString() || 'Unknown Supplier',
              contactPerson: row.getCell(5).value?.toString() || '',
              phone: row.getCell(6).value?.toString() || '',
              email: row.getCell(7).value?.toString() || '',
            },
            phones: [],
            financials: {
              tax: { amount: 0, percentage: 0 },
              discount: { amount: parseFloat(row.getCell(17).value) || 0, percentage: 0 },
              shippingCost: parseFloat(row.getCell(18).value) || 0,
            },
            payment: {
              method: row.getCell(19).value?.toString() || 'Cash',
              status: row.getCell(20).value?.toString() || 'Paid',
              paidAmount: 0,
            },
            notes: row.getCell(21).value?.toString() || '',
            invoiceStatus: 'Draft',
          });
        }

        invoicesMap.get(invoiceNumber.toString()).phones.push({
          brand,
          model,
          storage,
          color, // Can be empty
          imei,
          costPrice: parseFloat(row.getCell(13).value),
          sellingPrice: parseFloat(row.getCell(14).value),
          condition: row.getCell(15).value?.toString() || 'New',
          warrantyExpiryDate: row.getCell(16).value ? new Date(row.getCell(16).value) : undefined,
        });

        logger.info(`Row ${rowNumber}: Parsed ${brand} ${model} ${storage}${color ? ` ${color}` : ' (no color)'}`);
      } catch (error) {
        errors.push({
          row: rowNumber,
          error: error.message,
        });
      }
    });

    // Smart product matching
    let successCount = 0;
    const createdInvoices = [];

    for (const [invoiceNumber, invoiceData] of invoicesMap) {
      try {
        const existing = await PurchaseInvoice.findOne({ invoiceNumber });
        if (existing) {
          errors.push({
            invoice: invoiceNumber,
            error: 'Invoice number already exists',
          });
          continue;
        }

        const phonesWithProductIds = [];

        for (const phone of invoiceData.phones) {
          // Build query (case-insensitive)
          const query = {
            brand: new RegExp(`^${phone.brand}$`, 'i'),
            model: new RegExp(`^${phone.model}$`, 'i'),
            'specifications.storage': new RegExp(`^${phone.storage}$`, 'i'),
            isActive: true,
          };

          // Find all matching products
          const matchingProducts = await Product.find(query);

          if (matchingProducts.length === 0) {
            errors.push({
              invoice: invoiceNumber,
              imei: phone.imei,
              error: `No product found: ${phone.brand} ${phone.model} ${phone.storage}`,
            });
            continue;
          }

          let product;

          if (phone.color && phone.color.trim() !== '') {
            // Color specified - exact match
            product = matchingProducts.find(p => 
              p.specifications.color.toLowerCase() === phone.color.toLowerCase()
            );

            if (!product) {
              const availableColors = matchingProducts.map(p => p.specifications.color).join(', ');
              errors.push({
                invoice: invoiceNumber,
                imei: phone.imei,
                error: `Color "${phone.color}" not found. Available: ${availableColors}`,
              });
              continue;
            }
          } else {
            // No color specified - check if multiple variants exist
            if (matchingProducts.length > 1) {
              const availableColors = matchingProducts.map(p => p.specifications.color).join(', ');
              errors.push({
                invoice: invoiceNumber,
                imei: phone.imei,
                error: `Multiple colors available for ${phone.brand} ${phone.model} ${phone.storage}. Please specify: ${availableColors}`,
              });
              continue;
            }

            // Only one variant - auto-select
            product = matchingProducts[0];
            logger.info(`IMEI ${phone.imei}: Auto-matched to ${product.specifications.color}`);
          }

          // Check duplicate IMEI
          const existingIMEI = await PurchaseInvoice.findOne({
            'phones.imei': phone.imei,
          });

          if (existingIMEI) {
            errors.push({
              invoice: invoiceNumber,
              imei: phone.imei,
              error: 'IMEI already exists in system',
            });
            continue;
          }

          phonesWithProductIds.push({
            product: product._id,
            imei: phone.imei,
            costPrice: phone.costPrice,
            sellingPrice: phone.sellingPrice,
            condition: phone.condition,
            warrantyExpiryDate: phone.warrantyExpiryDate,
          });
        }

        if (phonesWithProductIds.length === 0) {
          errors.push({
            invoice: invoiceNumber,
            error: 'No valid phones to import',
          });
          continue;
        }

        // Create invoice
        invoiceData.phones = phonesWithProductIds;
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
      }
    }

    logger.info(`${successCount} invoices imported by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: `Successfully imported ${successCount} invoices as Draft. Upload invoice proofs to verify them.`,
      data: {
        successCount,
        totalInvoices: invoicesMap.size,
        errors: errors.length > 0 ? errors : undefined,
        invoices: createdInvoices.map((inv) => inv.getSummary()),
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