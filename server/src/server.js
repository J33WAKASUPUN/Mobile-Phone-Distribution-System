require('dotenv').config();
const app = require('./app');
const database = require('./config/database');
const logger = require('./utils/logger');
const { getRegisteredRoutes, displayRoutesTable, getRouteSummary } = require('./utils/routesList');

const PORT = process.env.PORT || 5000;

/**
 * Start Server
 */
const startServer = async () => {
  try {
    // Connect to MongoDB
    await database.connect();

    // Get all registered routes
    const routes = getRegisteredRoutes(app);
    const routeSummary = getRouteSummary(routes);

    // Start Express server
    const server = app.listen(PORT, () => {
      logger.info(`
                                                                               
  📱 Mobile Phone Distribution System API                         
  ---------------------------------------                                                                      
  🚀 Server Status:    RUNNING                                                
  🌍 Environment:      ${(process.env.NODE_ENV?.toUpperCase() || 'DEVELOPMENT').padEnd(59)} 
  🔌 Port:             ${PORT.toString().padEnd(59)}
  📡 API Version:      ${(process.env.API_VERSION || 'v1').padEnd(59)} 
  📊 MongoDB:          CONNECTED                                               
  ☁️  AWS S3:           ${(require('./config/aws').isReady() ? 'CONFIGURED' : 'NOT CONFIGURED').padEnd(59)} 
                                                                               
  🔗 Access Points:                                                            
    • API Base:       http://localhost:${PORT}${' '.repeat(43 - PORT.toString().length)}
    • Health Check:   http://localhost:${PORT}/health${' '.repeat(36 - PORT.toString().length)}
    • API Routes:     http://localhost:${PORT}/api/v1${' '.repeat(36 - PORT.toString().length)}
                                                                               
  📊 Route Summary:                                                            
    • Total Routes:   ${routeSummary.total.toString().padEnd(59)} 
    • GET:            ${routeSummary.GET.toString().padEnd(59)} 
    • POST:           ${routeSummary.POST.toString().padEnd(59)} 
    • PUT:            ${routeSummary.PUT.toString().padEnd(59)} 
    • PATCH:          ${routeSummary.PATCH.toString().padEnd(59)} 
    • DELETE:         ${routeSummary.DELETE.toString().padEnd(59)} 
                                                                               

      `);

      // Display all registered routes
      console.log(displayRoutesTable(routes));

      logger.info('✅ Server initialized successfully');
      logger.info(`⏰ Server started at: ${new Date().toISOString()}`);
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