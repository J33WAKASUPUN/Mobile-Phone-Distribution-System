require('dotenv').config();
const app = require('./app');
const database = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

/**
 * Start Server
 */
const startServer = async () => {
  try {
    // Connect to MongoDB
    await database.connect();

    // Start Express server
    const server = app.listen(PORT, () => {
      logger.info(`

📱 Mobile Phone Distribution System API                                   ║                                 

🚀 Server running on port ${PORT}
🌍 Environment: ${process.env.NODE_ENV?.toUpperCase() || 'DEVELOPMENT'}
📡 API Version: ${process.env.API_VERSION || 'v1'}                                  ║
📊 MongoDB Status: Connected

🔗 Access API: http://localhost:${PORT}
❤️  Health Check: http://localhost:${PORT}/health

      `);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      logger.error(`Unhandled Rejection: ${err.message}`);
      logger.error(err.stack);
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error(`Uncaught Exception: ${err.message}`);
      logger.error(err.stack);
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(async () => {
        logger.info('HTTP server closed');
        await database.disconnect();
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
};

startServer();