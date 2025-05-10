// src/server.js
const http = require('http');
const socketIo = require('socket.io');
const app = require('./app');
const { createLogger } = require('./utils/logger');

// Load environment variables
require('dotenv').config();

const logger = createLogger('server');
const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// Set up socket events
io.on('connection', (socket) => {
  logger.info(`New client connected: ${socket.id}`);
  
  // Handle agent query
  socket.on('agent:query', (data) => {
    logger.info(`Received agent query from ${socket.id}`, data);
    // Handle agent query logic here
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  
  // Close server & exit process
  server.close(() => process.exit(1));
});
