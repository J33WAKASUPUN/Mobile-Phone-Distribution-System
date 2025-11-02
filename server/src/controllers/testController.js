const s3Service = require('../config/aws');
const logger = require('../utils/logger');

/**
 * Test AWS S3 Connection
 */
const testS3Connection = async (req, res) => {
  try {
    // Check if S3 is configured
    if (!s3Service.isReady()) {
      return res.status(503).json({
        success: false,
        message: 'AWS S3 service is not configured',
        details: 'Please check your AWS credentials in .env file',
      });
    }

    // Try to list buckets to verify connection
    const testMessage = `AWS S3 Connection Test - ${new Date().toISOString()}`;
    const buffer = Buffer.from(testMessage);

    // Upload a small test file
    const uploadResult = await s3Service.uploadFile(
      buffer,
      'connection-test.txt',
      'text/plain',
      'tests'
    );

    logger.info('AWS S3 connection test successful');

    // Delete the test file
    await s3Service.deleteFile(uploadResult.key);

    res.status(200).json({
      success: true,
      message: 'AWS S3 connection successful',
      details: {
        bucket: uploadResult.bucket,
        region: process.env.AWS_REGION,
        testFileUploaded: uploadResult.key,
        testFileDeleted: true,
      },
    });
  } catch (error) {
    logger.error(`AWS S3 Connection Test Failed: ${error.message}`);

    res.status(500).json({
      success: false,
      message: 'AWS S3 connection failed',
      error: error.message,
      troubleshooting: {
        checkCredentials: 'Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env',
        checkBucket: 'Ensure the S3 bucket exists and has correct permissions',
        checkRegion: 'Verify AWS_REGION matches your bucket region',
      },
    });
  }
};

/**
 * Test MongoDB Connection
 */
const testMongoConnection = async (req, res) => {
  try {
    const database = require('../config/database');
    const status = database.getStatus();

    res.status(200).json({
      success: true,
      message: 'MongoDB connection active',
      details: status,
    });
  } catch (error) {
    logger.error(`MongoDB Connection Test Failed: ${error.message}`);

    res.status(500).json({
      success: false,
      message: 'MongoDB connection failed',
      error: error.message,
    });
  }
};

/**
 * Test All Services
 */
const testAllServices = async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    services: {},
  };

  // Test MongoDB
  try {
    const database = require('../config/database');
    const status = database.getStatus();
    results.services.mongodb = {
      status: 'connected',
      details: status,
    };
  } catch (error) {
    results.services.mongodb = {
      status: 'failed',
      error: error.message,
    };
  }

  // Test AWS S3
  try {
    if (s3Service.isReady()) {
      results.services.awsS3 = {
        status: 'configured',
        bucket: process.env.AWS_S3_BUCKET_NAME,
        region: process.env.AWS_REGION,
      };
    } else {
      results.services.awsS3 = {
        status: 'not_configured',
        message: 'AWS credentials not provided',
      };
    }
  } catch (error) {
    results.services.awsS3 = {
      status: 'failed',
      error: error.message,
    };
  }

  // Overall status
  const allServicesOk = Object.values(results.services).every(
    service => service.status === 'connected' || service.status === 'configured'
  );

  res.status(allServicesOk ? 200 : 503).json({
    success: allServicesOk,
    message: allServicesOk ? 'All services operational' : 'Some services have issues',
    ...results,
  });
};

module.exports = {
  testS3Connection,
  testMongoConnection,
  testAllServices,
};