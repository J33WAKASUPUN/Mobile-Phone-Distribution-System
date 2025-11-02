const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * MongoDB Connection Configuration
 * Handles connection to MongoDB with retry logic and event listeners
 */
class Database {
  constructor() {
    this.connection = null;
  }

  /**
   * Connect to MongoDB
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      const options = {
        maxPoolSize: 10,
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 5000,
        family: 4, // Use IPv4
      };

      const uri = process.env.NODE_ENV === 'test' 
        ? process.env.MONGODB_URI_TEST 
        : process.env.MONGODB_URI;

      this.connection = await mongoose.connect(uri, options);

      logger.info(`MongoDB Connected: ${this.connection.connection.host}`);
      
      this.setupEventListeners();
    } catch (error) {
      logger.error(`MongoDB Connection Error: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Setup MongoDB event listeners
   */
  setupEventListeners() {
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      logger.error(`Mongoose connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from MongoDB');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * Disconnect from MongoDB
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error(`Error closing MongoDB connection: ${error.message}`);
    }
  }

  /**
   * Clear all collections (for testing purposes)
   * @returns {Promise<void>}
   */
  async clearCollections() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Cannot clear collections outside test environment');
    }

    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
    logger.info('All collections cleared');
  }

  /**
   * Get database connection status
   * @returns {Object}
   */
  getStatus() {
    return {
      isConnected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    };
  }
}

module.exports = new Database();