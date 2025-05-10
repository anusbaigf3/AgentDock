const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { createLogger } = require('./utils/logger');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/error');

// Import route files
const agentRoutes = require('./routes/agentRoutes');
const toolRoutes = require('./routes/toolRoutes');
const authRoutes = require('./routes/authRoutes');
const logRoutes = require('./routes/logRoutes');

// Load environment variables
require('dotenv').config();

// Initialize MCP server
const mcpServer = require('./mcp/server');

// Create logger
const logger = createLogger('app');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Body parser
app.use(express.json());

// CORS setup
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Mount routes
app.use('/api/agents', agentRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/logs', logRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'AgentDock API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// Handle unhandled routes
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.originalUrl}`
  });
});

// Initialize MCP server on app startup
const initializeMCP = async () => {
  try {
    await mcpServer.initialize();
    logger.info('MCP server initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize MCP server', error);
    process.exit(1);
  }
};

// Call initialize function
initializeMCP();

module.exports = app;