const { validationResult } = require('express-validator');
const Agent = require('../models/Agent');
const mcpServer = require('../mcp/server');
const { createLogger } = require('../utils/logger');

const logger = createLogger('agentController');

/**
 * @desc    Get all agents
 * @route   GET /api/agents
 * @access  Private
 */
exports.getAgents = async (req, res, next) => {
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
    query = Agent.find(parsedQuery);
    
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
    const total = await Agent.countDocuments(parsedQuery);
    
    query = query.skip(startIndex).limit(limit);
    
    // Execute query
    const agents = await query;
    
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
      count: agents.length,
      pagination,
      total,
      data: agents
    });
  } catch (error) {
    logger.error('Error getting agents:', error);
    next(error);
  }
};

/**
 * @desc    Get single agent
 * @route   GET /api/agents/:id
 * @access  Private
 */
exports.getAgent = async (req, res, next) => {
  try {
    const agent = await Agent.findById(req.params.id);
    
    if (!agent) {
      return res.status(404).json({
        status: 'error',
        message: `Agent not found with id of ${req.params.id}`
      });
    }
    
    // Check if user owns the agent or is admin
    if (agent.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this agent'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: agent
    });
  } catch (error) {
    logger.error(`Error getting agent ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * @desc    Create new agent
 * @route   POST /api/agents
 * @access  Private
 */
exports.createAgent = async (req, res, next) => {
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
    
    // Create agent
    const agent = await Agent.create(req.body);
    
    res.status(201).json({
      status: 'success',
      data: agent
    });
  } catch (error) {
    logger.error('Error creating agent:', error);
    next(error);
  }
};

/**
 * @desc    Update agent
 * @route   PUT /api/agents/:id
 * @access  Private
 */
exports.updateAgent = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }
    
    let agent = await Agent.findById(req.params.id);
    
    if (!agent) {
      return res.status(404).json({
        status: 'error',
        message: `Agent not found with id of ${req.params.id}`
      });
    }
    
    // Check if user owns the agent or is admin
    if (agent.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to update this agent'
      });
    }
    
    // Update agent
    agent = await Agent.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    // If agent is active, update it in MCP server
    if (agent.isActive) {
      // Deregister first to ensure clean state
      mcpServer.deregisterAgent(req.params.id);
      
      // Register with updated config
      await mcpServer.registerAgentFromDocument(agent);
    }
    
    res.status(200).json({
      status: 'success',
      data: agent
    });
  } catch (error) {
    logger.error(`Error updating agent ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * @desc    Delete agent
 * @route   DELETE /api/agents/:id
 * @access  Private
 */
exports.deleteAgent = async (req, res, next) => {
  try {
    const agent = await Agent.findById(req.params.id);
    
    if (!agent) {
      return res.status(404).json({
        status: 'error',
        message: `Agent not found with id of ${req.params.id}`
      });
    }
    
    // Check if user owns the agent or is admin
    if (agent.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to delete this agent'
      });
    }
    
    // Deregister from MCP server first
    mcpServer.deregisterAgent(req.params.id);
    
    // Remove from database
    await agent.deleteOne();
    
    res.status(200).json({
      status: 'success',
      data: {}
    });
  } catch (error) {
    logger.error(`Error deleting agent ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * @desc    Process query with agent
 * @route   POST /api/agents/:id/query
 * @access  Private
 */
exports.processQuery = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }
    
    const { query, toolParams } = req.body;
    
    // Check if agent exists
    const agent = await Agent.findById(req.params.id);
    
    if (!agent) {
      return res.status(404).json({
        status: 'error',
        message: `Agent not found with id of ${req.params.id}`
      });
    }
    
    // Check if agent is active
    if (!agent.isActive) {
      return res.status(400).json({
        status: 'error',
        message: 'Agent is not active. Please register it first.'
      });
    }
    
    // Process query using MCP server
    const result = await mcpServer.processQuery(
      req.params.id,
      req.user.id,
      query,
      toolParams || {}
    );
    
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error(`Error processing query for agent ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * @desc    Register agent (activate)
 * @route   POST /api/agents/:id/register
 * @access  Private
 */
exports.registerAgent = async (req, res, next) => {
  try {
    const agent = await Agent.findById(req.params.id);
    
    if (!agent) {
      return res.status(404).json({
        status: 'error',
        message: `Agent not found with id of ${req.params.id}`
      });
    }
    
    // Check if user owns the agent or is admin
    if (agent.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to register this agent'
      });
    }
    
    // Register agent in MCP server
    const success = await mcpServer.registerAgentFromDocument(agent);
    
    if (!success) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to register agent in MCP server'
      });
    }
    
    // Update agent status
    agent.isActive = true;
    await agent.save();
    
    res.status(200).json({
      status: 'success',
      data: agent
    });
  } catch (error) {
    logger.error(`Error registering agent ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * @desc    Deregister agent (deactivate)
 * @route   POST /api/agents/:id/deregister
 * @access  Private
 */
exports.deregisterAgent = async (req, res, next) => {
  try {
    const agent = await Agent.findById(req.params.id);
    
    if (!agent) {
      return res.status(404).json({
        status: 'error',
        message: `Agent not found with id of ${req.params.id}`
      });
    }
    
    // Check if user owns the agent or is admin
    if (agent.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to deregister this agent'
      });
    }
    
    // Deregister agent from MCP server
    const success = mcpServer.deregisterAgent(req.params.id);
    
    if (!success) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to deregister agent from MCP server'
      });
    }
    
    // Update agent status
    agent.isActive = false;
    await agent.save();
    
    res.status(200).json({
      status: 'success',
      data: agent
    });
  } catch (error) {
    logger.error(`Error deregistering agent ${req.params.id}:`, error);
    next(error);
  }
};