const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../utils/logger');

/**
 * AWS S3 Configuration (SDK v3)
 * Handles file uploads and retrievals from S3 bucket
 */
class S3Service {
  constructor() {
    this.s3Client = null;
    this.bucketName = process.env.AWS_S3_BUCKET_NAME;
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.isConfigured = false;
    this.initialize();
  }

  /**
   * Initialize AWS S3 client (v3)
   */
  initialize() {
    try {
      // Check if AWS credentials are provided
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        logger.warn('AWS credentials not configured. S3 service will be disabled.');
        return;
      }

      // Create S3 client with v3 SDK
      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      this.isConfigured = true;
      logger.info('AWS S3 Service (v3) initialized successfully');
    } catch (error) {
      logger.error(`AWS S3 Initialization Error: ${error.message}`);
      this.isConfigured = false;
    }
  }

  /**
   * Check if S3 is configured
   * @returns {boolean}
   */
  isReady() {
    return this.isConfigured && this.s3Client !== null;
  }

  /**
   * Upload file to S3 (v3)
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} fileName - Name of the file
   * @param {string} mimeType - MIME type of the file
   * @param {string} folder - Folder path in S3 (e.g., 'invoices', 'products')
   * @returns {Promise<Object>} Upload result with file URL
   */
  async uploadFile(fileBuffer, fileName, mimeType, folder = 'general') {
    if (!this.isReady()) {
      throw new Error('S3 service is not configured. Please check AWS credentials.');
    }

    try {
      const key = `${folder}/${Date.now()}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        ServerSideEncryption: 'AES256', // Server-side encryption
      });

      // Send command to S3
      const response = await this.s3Client.send(command);

      logger.info(`File uploaded to S3: ${key}`);

      return {
        success: true,
        key: key,
        location: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`,
        bucket: this.bucketName,
        etag: response.ETag,
        versionId: response.VersionId,
      };
    } catch (error) {
      logger.error(`S3 Upload Error: ${error.message}`);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Get signed URL for private file access (v3)
   * @param {string} key - S3 object key
   * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(key, expiresIn = 3600) {
    if (!this.isReady()) {
      throw new Error('S3 service is not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      // Generate presigned URL
      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresIn,
      });

      logger.info(`Generated signed URL for: ${key}`);
      return url;
    } catch (error) {
      logger.error(`S3 Get Signed URL Error: ${error.message}`);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Delete file from S3 (v3)
   * @param {string} key - S3 object key
   * @returns {Promise<Object>} Deletion result
   */
  async deleteFile(key) {
    if (!this.isReady()) {
      throw new Error('S3 service is not configured');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);

      logger.info(`File deleted from S3: ${key}`);

      return {
        success: true,
        message: 'File deleted successfully',
        key: key,
      };
    } catch (error) {
      logger.error(`S3 Delete Error: ${error.message}`);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * List files in a folder (v3)
   * @param {string} folder - Folder path in S3
   * @param {number} maxKeys - Maximum number of files to retrieve
   * @returns {Promise<Array>} List of files
   */
  async listFiles(folder, maxKeys = 100) {
    if (!this.isReady()) {
      throw new Error('S3 service is not configured');
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: folder,
        MaxKeys: maxKeys,
      });

      const response = await this.s3Client.send(command);

      if (!response.Contents) {
        return [];
      }

      return response.Contents.map((item) => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
        etag: item.ETag,
      }));
    } catch (error) {
      logger.error(`S3 List Files Error: ${error.message}`);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Check if file exists in S3
   * @param {string} key - S3 object key
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(key) {
    if (!this.isReady()) {
      throw new Error('S3 service is not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param {string} key - S3 object key
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(key) {
    if (!this.isReady()) {
      throw new Error('S3 service is not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata,
      };
    } catch (error) {
      logger.error(`S3 Get Metadata Error: ${error.message}`);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }
}

module.exports = new S3Service();