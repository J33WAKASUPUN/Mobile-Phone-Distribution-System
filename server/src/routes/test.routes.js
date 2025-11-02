const express = require('express');
const {
  testS3Connection,
  testMongoConnection,
  testAllServices,
} = require('../controllers/testController');

const router = express.Router();

/**
 * @route   GET /api/v1/test/s3
 * @desc    Test AWS S3 connection
 * @access  Public (for testing only - remove in production)
 */
router.get('/s3', testS3Connection);

/**
 * @route   GET /api/v1/test/mongodb
 * @desc    Test MongoDB connection
 * @access  Public (for testing only - remove in production)
 */
router.get('/mongodb', testMongoConnection);

/**
 * @route   GET /api/v1/test/all
 * @desc    Test all services (MongoDB + AWS S3)
 * @access  Public (for testing only - remove in production)
 */
router.get('/all', testAllServices);

module.exports = router;