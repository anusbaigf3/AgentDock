const EventEmitter = require('events');
const Agent = require('../models/Agent');
const Log = require('../models/Log');
const { createLogger } = require('../utils/logger');

const logger = createLogger('MCPServer');

class MCPServer extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map();
    this.tools = new Map();
    this.logger = logger;
  }

  /**
   * Initialize the MCP server
   */
  async initialize() {
    this.logger.info('Initializing MCP server');
    await this.loadAgentsFromDatabase();
    this.setupEventListeners();
    this.logger.info('MCP server initialized successfully');
  }

  /**
   * Load all active agents from the database
   */
  async loadAgentsFromDatabase() {
    try {
      const agents = await Agent.find({ isActive: true });
      this.logger.info(`Found ${agents.length} active agents in database`);
      
      for (const agentDoc of agents) {
        await this.registerAgentFromDocument(agentDoc);
      }
    } catch (error) {
      this.logger.error('Failed to load agents from database', error);
      throw error;
    }
  }

  /**
   * Register a new agent from database document
   */
  async registerAgentFromDocument(agentDoc) {
    try {
      // Dynamic import of agent implementation
      const AgentClass = await this.loadAgentClass(agentDoc.type);
      
      // Instantiate the agent
      const agent = new AgentClass(agentDoc.name, agentDoc.config);
      
      // Register the agent
      this.registerAgent(agentDoc._id.toString(), agent);
      
      this.logger.info(`Agent ${agentDoc.name} (${agentDoc.type}) registered successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to register agent ${agentDoc.name}`, error);
      return false;
    }
  }

  /**
   * Load agent class based on type
   */
  async loadAgentClass(type) {
    try {
      // Default to custom if type is not found
      const agentPath = `./agents/${type}Agent.js`;
      const AgentClass = require(agentPath);
      return AgentClass;
    } catch (error) {
      this.logger.warn(`Agent type ${type} not found, using base agent`);
      return require('./agents/baseAgent');
    }
  }

  /**
   * Register a new agent
   */
  registerAgent(id, agent) {
    if (this.agents.has(id)) {
      this.logger.warn(`Agent with ID ${id} already exists, replacing`);
    }
    
    this.agents.set(id, agent);
    this.emit('agent:registered', { id, agent });
    return true;
  }

  /**
   * Deregister an agent
   */
  deregisterAgent(id) {
    if (!this.agents.has(id)) {
      this.logger.warn(`Agent with ID ${id} not found, cannot deregister`);
      return false;
    }
    
    const agent = this.agents.get(id);
    
    // Clean up any resources
    if (typeof agent.cleanup === 'function') {
      agent.cleanup();
    }
    
    this.agents.delete(id);
    this.emit('agent:deregistered', { id });
    return true;
  }

  /**
   * Register a new tool
   */
  registerTool(id, tool) {
    if (this.tools.has(id)) {
      this.logger.warn(`Tool with ID ${id} already exists, replacing`);
    }
    
    this.tools.set(id, tool);
    this.emit('tool:registered', { id, tool });
    
    // Make tool available to all agents
    this.agents.forEach(agent => {
      if (typeof agent.registerTool === 'function') {
        agent.registerTool(id, tool);
      }
    });
    
    return true;
  }

  /**
   * Deregister a tool
   */
  deregisterTool(id) {
    if (!this.tools.has(id)) {
      this.logger.warn(`Tool with ID ${id} not found, cannot deregister`);
      return false;
    }
    
    const tool = this.tools.get(id);
    
    // Clean up any resources
    if (typeof tool.cleanup === 'function') {
      tool.cleanup();
    }
    
    // Remove tool from all agents
    this.agents.forEach(agent => {
      if (typeof agent.deregisterTool === 'function') {
        agent.deregisterTool(id);
      }
    });
    
    this.tools.delete(id);
    this.emit('tool:deregistered', { id });
    return true;
  }

  /**
   * Process a user query with an agent
   */
  async processQuery(agentId, userId, query, toolParams = {}) {
    if (!this.agents.has(agentId)) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    
    const agent = this.agents.get(agentId);
    const startTime = Date.now();
    
    // Create a log entry for this query
    const logEntry = new Log({
      agentId,
      userId,
      action: 'process_query',
      input: { query, toolParams },
      status: 'started'
    });
    
    await logEntry.save();
    
    try {
      // Process the query with the agent
      this.logger.info(`Processing query with agent ${agentId}: ${query}`);
      const result = await agent.processQuery(query, toolParams);
      
      // Update log entry with success result
      logEntry.status = 'completed';
      logEntry.output = result;
      logEntry.duration = Date.now() - startTime;
      await logEntry.save();
      
      return result;
    } catch (error) {
      // Update log entry with error
      logEntry.status = 'failed';
      logEntry.output = { error: error.message };
      logEntry.type = 'error';
      logEntry.duration = Date.now() - startTime;
      await logEntry.save();
      
      this.logger.error(`Error processing query with agent ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Execute a tool action
   */
  async executeTool(toolId, action, params = {}, userId) {
    if (!this.tools.has(toolId)) {
      throw new Error(`Tool with ID ${toolId} not found`);
    }
    
    const tool = this.tools.get(toolId);
    const startTime = Date.now();
    
    // Create a log entry for this tool execution
    const logEntry = new Log({
      toolId,
      userId,
      action: `execute_tool_${action}`,
      input: params,
      status: 'started'
    });
    
    await logEntry.save();
    
    try {
      // Execute the tool action
      this.logger.info(`Executing tool ${toolId} action ${action}`);
      const result = await tool.execute(action, params);
      
      // Update log entry with success result
      logEntry.status = 'completed';
      logEntry.output = result;
      logEntry.duration = Date.now() - startTime;
      await logEntry.save();
      
      return result;
    } catch (error) {
      // Update log entry with error
      logEntry.status = 'failed';
      logEntry.output = { error: error.message };
      logEntry.type = 'error';
      logEntry.duration = Date.now() - startTime;
      await logEntry.save();
      
      this.logger.error(`Error executing tool ${toolId} action ${action}`, error);
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.on('agent:registered', ({ id, agent }) => {
      this.logger.info(`Agent [${agent?.code}] registered: ${id}`);
    });
    
    this.on('agent:deregistered', ({ id }) => {
      this.logger.info(`Agent deregistered: ${id}`);
    });
    
    this.on('tool:registered', ({ id, tool }) => {
      this.logger.info(`Tool [${tool?.code}] registered: ${id}`);
    });
    
    this.on('tool:deregistered', ({ id }) => {
      this.logger.info(`Tool deregistered: ${id}`);
    });
  }
}

// Create singleton instance
const mcpServer = new MCPServer();

module.exports = mcpServer;
