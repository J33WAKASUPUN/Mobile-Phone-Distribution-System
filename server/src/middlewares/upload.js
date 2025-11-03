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
  // Allowed file types (including Excel files for import)
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/pdf',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(
        400,
        `Invalid file type: ${file.mimetype}. Allowed types: Excel (.xlsx, .xls), Images (JPEG, PNG), PDF, CSV`
      ),
      false
    );
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
  },
  fileFilter: fileFilter,
});

module.exports = upload;