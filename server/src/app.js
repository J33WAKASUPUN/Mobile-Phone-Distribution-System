require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const logger = require('./utils/logger');

// Initialize Express app
const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================
// BODY PARSER MIDDLEWARE
// ============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// DATA SANITIZATION
// ============================================

app.use(mongoSanitize());

// ============================================
// RATE LIMITING
// ============================================

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// ============================================
// HTTP REQUEST LOGGER
// ============================================

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }));
}

// ============================================
// HEALTH CHECK & ROOT ROUTES
// ============================================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Mobile Phone Distribution System API',
    version: process.env.API_VERSION || 'v1',
    status: 'Active',
    documentation: '/api-docs (Coming soon)',
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
  });
});

// ============================================
// API ROUTES
// ============================================

const API_VERSION = process.env.API_VERSION || 'v1';

// Test routes (remove in production)
const testRoutes = require('./routes/test.routes');
app.use(`/api/${API_VERSION}/test`, testRoutes);

// Authentication routes
const authRoutes = require('./routes/auth.routes');
app.use(`/api/${API_VERSION}/auth`, authRoutes);

// User management routes (Owner only)
const userRoutes = require('./routes/user.routes');
app.use(`/api/${API_VERSION}/users`, userRoutes);

// Inventory management routes
const inventoryRoutes = require('./routes/inventory.routes');
app.use(`/api/${API_VERSION}/inventory`, inventoryRoutes);

// DSR Assignment routes
const dsrAssignmentRoutes = require('./routes/dsrAssignment.routes');
app.use(`/api/${API_VERSION}/dsr-assignments`, dsrAssignmentRoutes);

// DSR Schedule Management routes
const dsrScheduleRoutes = require('./routes/dsrSchedule.routes');
app.use(`/api/${API_VERSION}/dsr-schedules`, dsrScheduleRoutes);

// ============================================
// ERROR HANDLING
// ============================================

app.use(notFound);
app.use(errorHandler);

module.exports = app;