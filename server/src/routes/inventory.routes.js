const express = require("express");
const {
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
  getAllPhones,
  getPhoneByIMEI,
  updatePhone,
  deletePhone,
} = require("../controllers/inventoryController");
const { protect, authorize } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const {
  createProductSchema,
  updateProductSchema,
  createPurchaseInvoiceSchema,
  updatePhoneStatusSchema,
} = require("../validations/schemas/inventorySchemas");
const upload = require("../middlewares/upload");
const {
  downloadProductTemplate,
  downloadInvoiceTemplate,
  importProducts,
  importInvoices,
} = require("../controllers/importController");
const router = express.Router();

// ============================================
// PRODUCT ROUTES (Owner only can create/update)
// ============================================

/**
 * @route   POST /api/v1/inventory/products
 * @desc    Create new product
 * @access  Private (Owner only)
 */
router.post(
  "/products",
  protect,
  authorize("owner"),
  validate(createProductSchema),
  createProduct
);

/**
 * @route   GET /api/v1/inventory/products
 * @desc    Get all products
 * @access  Private (All authenticated users)
 */
router.get("/products", protect, getAllProducts);

/**
 * @route   GET /api/v1/inventory/products/:id
 * @desc    Get product by ID
 * @access  Private (All authenticated users)
 */
router.get("/products/:id", protect, getProductById);

/**
 * @route   PUT /api/v1/inventory/products/:id
 * @desc    Update product
 * @access  Private (Owner only)
 */
router.put(
  "/products/:id",
  protect,
  authorize("owner"),
  validate(updateProductSchema),
  updateProduct
);

/**
 * @route   DELETE /api/v1/inventory/products/:id
 * @desc    Delete product (soft delete)
 * @access  Private (Owner only)
 */
router.delete("/products/:id", protect, authorize("owner"), deleteProduct);

// ============================================
// PURCHASE INVOICE ROUTES (Owner only can create)
// ============================================

/**
 * @route   POST /api/v1/inventory/invoices
 * @desc    Create purchase invoice
 * @access  Private (Owner only)
 */
router.post(
  "/invoices",
  protect,
  authorize("owner"),
  validate(createPurchaseInvoiceSchema),
  createPurchaseInvoice
);

/**
 * @route   GET /api/v1/inventory/invoices
 * @desc    Get all purchase invoices
 * @access  Private (All authenticated users)
 */
router.get("/invoices", protect, getAllInvoices);

/**
 * @route   GET /api/v1/inventory/invoices/:id
 * @desc    Get invoice by ID
 * @access  Private (All authenticated users)
 */
router.get("/invoices/:id", protect, getInvoiceById);

/**
 * @route   PUT /api/v1/inventory/invoices/:id
 * @desc    Update invoice
 * @access  Private (Owner only)
 */
router.put("/invoices/:id", protect, authorize("owner"), updateInvoice);

/**
 * @route   POST /api/v1/inventory/invoices/:id/upload-proof
 * @desc    Upload invoice proof image
 * @access  Private (Owner only)
 */
router.post(
  "/invoices/:id/upload-proof",
  protect,
  authorize("owner"),
  upload.single("invoiceProof"),
  uploadInvoiceProof
);

// ============================================
// INVENTORY MANAGEMENT ROUTES
// ============================================

/**
 * @route   GET /api/v1/inventory/search/imei/:imei
 * @desc    Search phone by IMEI
 * @access  Private (All authenticated users)
 */
router.get("/search/imei/:imei", protect, searchByIMEI);

/**
 * @route   GET /api/v1/inventory/stock/available
 * @desc    Get available stock summary
 * @access  Private (All authenticated users)
 */
router.get("/stock/available", protect, getAvailableStock);

/**
 * @route   GET /api/v1/inventory/statistics
 * @desc    Get inventory statistics
 * @access  Private (All authenticated users)
 */
router.get("/statistics", protect, getStatistics);

/**
 * @route   PATCH /api/v1/inventory/phones/:imei/status
 * @desc    Update phone status
 * @access  Private (Owner only)
 */
router.patch(
  "/phones/:imei/status",
  protect,
  authorize("owner"),
  validate(updatePhoneStatusSchema),
  updatePhoneStatus
);

/**
 * @route   GET /api/v1/inventory/phones
 * @desc    Get all individual phones with filtering
 * @access  Private (Owner, Clerk)
 */
router.get("/phones", protect, authorize("owner", "clerk"), getAllPhones);

/**
 * @route   GET /api/v1/inventory/phones/:imei
 * @desc    Get phone details by IMEI
 * @access  Private (All authenticated)
 */
router.get("/phones/:imei", protect, getPhoneByIMEI);

/**
 * @route   PATCH /api/v1/inventory/phones/:imei
 * @desc    Update phone details
 * @access  Private (Owner only)
 */
router.patch("/phones/:imei", protect, authorize("owner"), updatePhone);

/**
 * @route   DELETE /api/v1/inventory/phones/:imei
 * @desc    Delete phone by IMEI
 * @access  Private (Owner only)
 */
router.delete("/phones/:imei", protect, authorize("owner"), deletePhone);

// ============================================
// IMPORT ROUTES (Add before module.exports)
// ============================================

/**
 * @route   GET /api/v1/inventory/import/templates/products
 * @desc    Download product import template
 * @access  Private (Owner only)
 */
router.get(
  "/import/templates/products",
  protect,
  authorize("owner"),
  downloadProductTemplate
);

/**
 * @route   GET /api/v1/inventory/import/templates/invoices
 * @desc    Download invoice import template
 * @access  Private (Owner only)
 */
router.get(
  "/import/templates/invoices",
  protect,
  authorize("owner"),
  downloadInvoiceTemplate
);

/**
 * @route   POST /api/v1/inventory/import/products
 * @desc    Import products from Excel
 * @access  Private (Owner only)
 */
router.post(
  "/import/products",
  protect,
  authorize("owner"),
  upload.single("file"),
  importProducts
);

/**
 * @route   POST /api/v1/inventory/import/invoices
 * @desc    Import purchase invoices from Excel
 * @access  Private (Owner only)
 */
router.post(
  "/import/invoices",
  protect,
  authorize("owner"),
  upload.single("file"),
  importInvoices
);

// ============================================
// EXPORT ROUTES
// ============================================

/**
 * @route   GET /api/v1/inventory/export/excel
 * @desc    Export inventory to Excel
 * @access  Private (All authenticated users)
 */
router.get("/export/excel", protect, exportInventoryToExcel);

module.exports = router;