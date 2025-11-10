const Product = require('../models/Product');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Inventory Service
 * Business logic for inventory management
 */
class InventoryService {
  /**
   * Search available phones by IMEI
   */
  static async searchByIMEI(imei) {
    const invoice = await PurchaseInvoice.findOne({
      'phones.imei': imei,
    }).populate('phones.product');

    if (!invoice) {
      throw new ApiError(404, 'Phone with this IMEI not found');
    }

    const phone = invoice.phones.find(p => p.imei === imei);

    return {
      invoice: invoice.getSummary(),
      phone: {
        ...phone.toObject(),
        product: phone.product,
      },
    };
  }

  /**
   * Get available stock summary (UPDATED - includes individual phones)
   */
  static async getAvailableStock() {
    const result = await PurchaseInvoice.aggregate([
      { $unwind: '$phones' },
      { $match: { 'phones.status': 'Available' } },
      {
        $lookup: {
          from: 'products',
          localField: 'phones.product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
      {
        $group: {
          _id: '$phones.product',
          count: { $sum: 1 },
          totalCost: { $sum: '$phones.costPrice' },
          totalSellingPrice: { $sum: '$phones.sellingPrice' },
          productDetails: { $first: '$productDetails' },
          // Collect individual phones with IMEI
          phones: {
            $push: {
              imei: '$phones.imei',
              costPrice: '$phones.costPrice',
              sellingPrice: '$phones.sellingPrice',
              condition: '$phones.condition',
              warrantyExpiryDate: '$phones.warrantyExpiryDate',
              invoiceNumber: '$invoiceNumber',
              invoiceId: '$_id',
              addedAt: '$phones.addedAt',
            },
          },
        },
      },
      { $sort: { 'productDetails.brand': 1, 'productDetails.model': 1 } },
    ]);

    return result;
  }

  /**
   * Get inventory statistics
   */
  static async getStatistics() {
    const stats = await PurchaseInvoice.aggregate([
      { $unwind: '$phones' },
      {
        $group: {
          _id: '$phones.status',
          count: { $sum: 1 },
          totalCost: { $sum: '$phones.costPrice' },
          totalSellingPrice: { $sum: '$phones.sellingPrice' },
        },
      },
    ]);

    return stats;
  }

  /**
   * Check if IMEI is duplicate
   */
  static async isIMEIDuplicate(imei) {
    const existing = await PurchaseInvoice.findOne({
      'phones.imei': imei,
    });

    return !!existing;
  }

  /**
   * Get low stock products
   */
  static async getLowStock(threshold = 5) {
    const result = await PurchaseInvoice.aggregate([
      { $unwind: '$phones' },
      { $match: { 'phones.status': 'Available' } },
      {
        $group: {
          _id: '$phones.product',
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $lte: threshold } } },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
    ]);

    return result;
  }

  /**
   * Get detailed available stock (alternative method - flattened view)
   */
  static async getAvailableStockDetailed() {
    const result = await PurchaseInvoice.aggregate([
      { $unwind: '$phones' },
      { $match: { 'phones.status': 'Available' } },
      {
        $lookup: {
          from: 'products',
          localField: 'phones.product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
      {
        $project: {
          _id: 0,
          invoiceNumber: 1,
          invoiceId: '$_id',
          imei: '$phones.imei',
          costPrice: '$phones.costPrice',
          sellingPrice: '$phones.sellingPrice',
          condition: '$phones.condition',
          warrantyExpiryDate: '$phones.warrantyExpiryDate',
          addedAt: '$phones.addedAt',
          product: {
            _id: '$productDetails._id',
            brand: '$productDetails.brand',
            model: '$productDetails.model',
            variant: '$productDetails.variant',
            specifications: '$productDetails.specifications',
            features: '$productDetails.features',
            images: '$productDetails.images',
          },
        },
      },
      {
        $sort: {
          'product.brand': 1,
          'product.model': 1,
          imei: 1,
        },
      },
    ]);

    return result;
  }
}

module.exports = InventoryService;