const { createLogger } = require('../../utils/logger');

class BaseTool {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.logger = createLogger(`Tool:${name}`);
    this.description = config.description || `${name} tool`;
    this.actions = this.getAvailableActions();
  }

  /**
   * Get available actions for this tool
   * Override in subclasses
   * @returns {Array} - Array of action objects
   */
  getAvailableActions() {
    return [
      {
        name: 'info',
        description: 'Get information about this tool',
        parameters: {}
      }
    ];
  }

  /**
   * Execute a tool action
   * @param {string} action - Action name
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Result of the action
   */
  async execute(action, params = {}) {
    this.logger.info(`Executing action: ${action}`);
    
    // Check if action exists
    const actionObj = this.actions.find(a => a.name === action);
    if (!actionObj) {
      throw new Error(`Action '${action}' not found for tool ${this.name}`);
    }
    
    // Validate parameters
    this.validateParams(action, params, actionObj.parameters);
    
    // Execute appropriate method based on action
    switch (action) {
      case 'info':
        return this.getInfo(params);
      default:
        throw new Error(`Action '${action}' not implemented for tool ${this.name}`);
    }
  }

  /**
   * Validate action parameters
   * @param {string} action - Action name
   * @param {Object} params - Provided parameters
   * @param {Object} requiredParams - Required parameters schema
   */
  validateParams(action, params, requiredParams) {
    // Check for required parameters
    for (const [paramName, paramSchema] of Object.entries(requiredParams)) {
      if (paramSchema.required && !params.hasOwnProperty(paramName)) {
        throw new Error(`Missing required parameter '${paramName}' for action '${action}'`);
      }
    }
  }

  /**
   * Get tool info (default action)
   * @returns {Object} - Tool info
   */
  getInfo() {
    return {
      name: this.name,
      description: this.description,
      actions: this.actions.map(action => ({
        name: action.name,
        description: action.description
      }))
    };
  }

  /**
   * Clean up resources when tool is deregistered
   */
  cleanup() {
    this.logger.info(`Cleaning up tool: ${this.name}`);
    // Implement any cleanup logic here
  }
}

module.exports = BaseTool;
