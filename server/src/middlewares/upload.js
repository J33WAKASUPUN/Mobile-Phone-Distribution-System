const multer = require('multer');
const path = require('path');
const { ApiError } = require('./errorHandler');

/**
 * Multer Configuration for File Uploads
 * Stores files in memory before uploading to S3
 */

// Configure storage (memory storage for S3 upload)
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/jpg,application/pdf').split(',');

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(
        400,
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
      ),
      false
    );
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
  },
  fileFilter: fileFilter,
});

module.exports = upload;