// src/controllers/toolController.js
const { validationResult } = require('express-validator');
const Tool = require('../models/Tool');
const mcpServer = require('../mcp/server');
const { createLogger } = require('../utils/logger');

const logger = createLogger('toolController');

/**
 * @desc    Get all tools
 * @route   GET /api/tools
 * @access  Private
 */
exports.getTools = async (req, res, next) => {
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
    
    // Add createdBy filter for non-admin users
    const parsedQuery = JSON.parse(queryStr);
    if (req.user.role !== 'admin') {
      parsedQuery.createdBy = req.user._id;
    }
    
    // Finding resource
    query = Tool.find(parsedQuery);
    
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
      query = query.sort('-createdAt');
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Tool.countDocuments(parsedQuery);
    
    query = query.skip(startIndex).limit(limit);
    
    // Execute query
    const tools = await query;
    
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
      count: tools.length,
      pagination,
      total,
      data: tools
    });
  } catch (error) {
    logger.error('Error getting tools:', error);
    next(error);
  }
};

/**
 * @desc    Get single tool
 * @route   GET /api/tools/:id
 * @access  Private
 */
exports.getTool = async (req, res, next) => {
  try {
    const tool = await Tool.findById(req.params.id);
    
    if (!tool) {
      return res.status(404).json({
        status: 'error',
        message: `Tool not found with id of ${req.params.id}`
      });
    }
    
    // Check if user owns the tool or is admin
    if (tool.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this tool'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: tool
    });
  } catch (error) {
    logger.error(`Error getting tool ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * @desc    Create new tool
 * @route   POST /api/tools
 * @access  Private
 */
exports.createTool = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }
    
    // Add user to req.body
    req.body.createdBy = req.user.id;
    
    // Create tool
    const tool = await Tool.create(req.body);
    
    res.status(201).json({
      status: 'success',
      data: tool
    });
  } catch (error) {
    logger.error('Error creating tool:', error);
    next(error);
  }
};

/**
 * @desc    Update tool
 * @route   PUT /api/tools/:id
 * @access  Private
 */
exports.updateTool = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }
    
    let tool = await Tool.findById(req.params.id);
    
    if (!tool) {
      return res.status(404).json({
        status: 'error',
        message: `Tool not found with id of ${req.params.id}`
      });
    }
    
    // Check if user owns the tool or is admin
    if (tool.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to update this tool'
      });
    }
    
    // Update tool
    tool = await Tool.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    await loadAndRegisterTool(tool);
    
    res.status(200).json({
      status: 'success',
      data: tool
    });
  } catch (error) {
    logger.error(`Error updating tool ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * @desc    Delete tool
 * @route   DELETE /api/tools/:id
 * @access  Private
 */
exports.deleteTool = async (req, res, next) => {
  try {
    const tool = await Tool.findById(req.params.id);
    
    if (!tool) {
      return res.status(404).json({
        status: 'error',
        message: `Tool not found with id of ${req.params.id}`
      });
    }
    
    // Check if user owns the tool or is admin
    if (tool.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to delete this tool'
      });
    }
    
    // Deregister from MCP server first
    mcpServer.deregisterTool(req.params.id, false);
    
    // Remove from database
    await tool.deleteOne();
    
    res.status(200).json({
      status: 'success',
      data: {}
    });
  } catch (error) {
    logger.error(`Error deleting tool ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * @desc    Execute tool action
 * @route   POST /api/tools/:id/execute
 * @access  Private
 */
exports.executeTool = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }
    
    const { action, params } = req.body;
    
    // Check if tool exists
    const tool = await Tool.findById(req.params.id);
    
    if (!tool) {
      return res.status(404).json({
        status: 'error',
        message: `Tool not found with id of ${req.params.id}`
      });
    }
    
    // Check if tool is active
    if (!tool.isActive) {
      return res.status(400).json({
        status: 'error',
        message: 'Tool is not active. Please register it first.'
      });
    }
    
    // Execute tool action using MCP server
    const result = await mcpServer.executeTool(
      req.params.id,
      action,
      params || {},
      req.user.id
    );
    
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error(`Error executing tool ${req.params.id} action:`, error);
    next(error);
  }
};

/**
 * @desc    Register tool (activate)
 * @route   POST /api/tools/:id/register
 * @access  Private
 */
exports.registerTool = async (req, res, next) => {
  try {
    const tool = await Tool.findById(req.params.id);
    
    if (!tool) {
      return res.status(404).json({
        status: 'error',
        message: `Tool not found with id of ${req.params.id}`
      });
    }
    
    // Check if user owns the tool or is admin
    if (tool.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to register this tool'
      });
    }
    
    // Register tool in MCP server
    const success = await loadAndRegisterTool(tool);
    
    if (!success) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to register tool in MCP server'
      });
    }
    
    // Update tool status
    tool.isActive = true;
    await tool.save();
    
    res.status(200).json({
      status: 'success',
      data: tool
    });
  } catch (error) {
    logger.error(`Error registering tool ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * @desc    Deregister tool (deactivate)
 * @route   POST /api/tools/:id/deregister
 * @access  Private
 */
exports.deregisterTool = async (req, res, next) => {
  try {
    const tool = await Tool.findById(req.params.id);
    
    if (!tool) {
      return res.status(404).json({
        status: 'error',
        message: `Tool not found with id of ${req.params.id}`
      });
    }
    
    // Check if user owns the tool or is admin
    if (tool.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to deregister this tool'
      });
    }
    
    // Deregister tool from MCP server
    const success = mcpServer.deregisterTool(req.params.id);
    
    if (!success) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to deregister tool from MCP server'
      });
    }
    
    // Update tool status
    tool.isActive = false;
    await tool.save();
    
    res.status(200).json({
      status: 'success',
      data: tool
    });
  } catch (error) {
    logger.error(`Error deregistering tool ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Helper function to load tool implementation and register it
 * @param {Object} toolDoc - Tool document from database
 * @returns {Promise<boolean>} - Success status
 */
async function loadAndRegisterTool(toolDoc, isRegister = true) {
  try {

    if (!toolDoc.isActive) {
      logger.warn(`Tool ${toolDoc.name} is not active`);
      return false;
    }

    // Get tool type
    const toolType = toolDoc.type;
    
    // Try to load tool class
    let ToolClass;
    try {
      ToolClass = require(`../mcp/tools/${toolType}Tool`);
    } catch (error) {
      logger.warn(`Tool type ${toolType} not found, using base tool`);
      ToolClass = require('../mcp/tools/baseTool');
    }
    
    // Create tool instance
    const tool = new ToolClass(toolDoc.name, {
      ...toolDoc.toObject(),
      description: toolDoc.description,
      endpoint: toolDoc.endpoint,
      authType: toolDoc.authType,
      authConfig: toolDoc.authConfig,
      config: toolDoc.config
    });
    
    const toolName = toolDoc.name.toString().toLowerCase();

    // Register tool
    if (isRegister) {
      mcpServer.registerTool(toolName, tool);
    } else {
      mcpServer.deregisterTool(toolName);
    }
    
    return true;
  } catch (error) {
    logger.error(`Failed to load and register tool ${toolDoc.name}:`, error);
    return false;
  }
}
