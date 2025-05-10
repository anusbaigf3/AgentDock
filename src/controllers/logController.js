// src/controllers/logController.js
const Log = require('../models/Log');
const { createLogger } = require('../utils/logger');

const logger = createLogger('logController');

/**
 * @desc    Get all logs
 * @route   GET /api/logs
 * @access  Private
 */
exports.getLogs = async (req, res, next) => {
  try {
    // Build query
    let query;
    
    // Copy req.query
    const reqQuery = { ...req.query };
    
    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];
    
    // Remove excluded fields
    removeFields.forEach(param => delete reqQuery[param]);
    
    // Create query string
    let queryStr = JSON.stringify(reqQuery);
    
    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
    
    // Add userId filter for non-admin users
    const parsedQuery = JSON.parse(queryStr);
    if (req.user.role !== 'admin') {
      parsedQuery.userId = req.user._id;
    }
    
    // Finding resource
    query = Log.find(parsedQuery);
    
    // Populate references
    query = query.populate([
      { path: 'agentId', select: 'name type' },
      { path: 'toolId', select: 'name type' },
      { path: 'userId', select: 'name email' }
    ]);
    
    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }
    
    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-timestamp');
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Log.countDocuments(parsedQuery);
    
    query = query.skip(startIndex).limit(limit);
    
    // Execute query
    const logs = await query;
    
    // Pagination result
    const pagination = {};
    
    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }
    
    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }
    
    res.status(200).json({
      status: 'success',
      count: logs.length,
      pagination,
      total,
      data: logs
    });
  } catch (error) {
    logger.error('Error getting logs:', error);
    next(error);
  }
};

/**
 * @desc    Get logs for a specific agent
 * @route   GET /api/logs/agent/:agentId
 * @access  Private
 */
exports.getAgentLogs = async (req, res, next) => {
  try {
    // Build query
    let query = {
      agentId: req.params.agentId
    };
    
    // Add userId filter for non-admin users
    if (req.user.role !== 'admin') {
      query.userId = req.user._id;
    }
    
    const logs = await Log.find(query)
      .populate([
        { path: 'agentId', select: 'name type' },
        { path: 'toolId', select: 'name type' },
        { path: 'userId', select: 'name email' }
      ])
      .sort('-timestamp')
      .limit(parseInt(req.query.limit, 10) || 20);
    
    res.status(200).json({
      status: 'success',
      count: logs.length,
      data: logs
    });
  } catch (error) {
    logger.error(`Error getting logs for agent ${req.params.agentId}:`, error);
    next(error);
  }
};

/**
 * @desc    Get logs for a specific tool
 * @route   GET /api/logs/tool/:toolId
 * @access  Private
 */
exports.getToolLogs = async (req, res, next) => {
  try {
    // Build query
    let query = {
      toolId: req.params.toolId
    };
    
    // Add userId filter for non-admin users
    if (req.user.role !== 'admin') {
      query.userId = req.user._id;
    }
    
    const logs = await Log.find(query)
      .populate([
        { path: 'agentId', select: 'name type' },
        { path: 'toolId', select: 'name type' },
        { path: 'userId', select: 'name email' }
      ])
      .sort('-timestamp')
      .limit(parseInt(req.query.limit, 10) || 20);
    
    res.status(200).json({
      status: 'success',
      count: logs.length,
      data: logs
    });
  } catch (error) {
    logger.error(`Error getting logs for tool ${req.params.toolId}:`, error);
    next(error);
  }
};

/**
 * @desc    Get single log
 * @route   GET /api/logs/:id
 * @access  Private
 */
exports.getLog = async (req, res, next) => {
  try {
    const log = await Log.findById(req.params.id)
      .populate([
        { path: 'agentId', select: 'name type' },
        { path: 'toolId', select: 'name type' },
        { path: 'userId', select: 'name email' }
      ]);
    
    if (!log) {
      return res.status(404).json({
        status: 'error',
        message: `Log not found with id of ${req.params.id}`
      });
    }
    
    // Check if user owns the log or is admin
    if (log.userId._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this log'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: log
    });
  } catch (error) {
    logger.error(`Error getting log ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * @desc    Delete log
 * @route   DELETE /api/logs/:id
 * @access  Private (Admin only)
 */
exports.deleteLog = async (req, res, next) => {
  try {
    const log = await Log.findById(req.params.id);
    
    if (!log) {
      return res.status(404).json({
        status: 'error',
        message: `Log not found with id of ${req.params.id}`
      });
    }
    
    await log.deleteOne();
    
    res.status(200).json({
      status: 'success',
      data: {}
    });
  } catch (error) {
    logger.error(`Error deleting log ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * @desc    Clear all logs
 * @route   DELETE /api/logs
 * @access  Private (Admin only)
 */
exports.clearLogs = async (req, res, next) => {
  try {
    // Optional: Add confirmation check
    const { confirm } = req.query;
    
    if (confirm !== 'true') {
      return res.status(400).json({
        status: 'error',
        message: 'Please confirm clearing all logs by adding ?confirm=true to the request'
      });
    }
    
    await Log.deleteMany({});
    
    res.status(200).json({
      status: 'success',
      message: 'All logs cleared successfully',
      data: {}
    });
  } catch (error) {
    logger.error('Error clearing logs:', error);
    next(error);
  }
};
