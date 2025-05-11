const groqService = require('../../services/groqService');
const { createLogger } = require('../../utils/logger');

class BaseAgent {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.tools = new Map();
    this.logger = createLogger(`Agent:${name}`);
  }

  /**
   * Process a user query
   * @param {string} query - The user's query
   * @param {Object} toolParams - Additional parameters for tools
   * @returns {Promise<Object>} - The result of processing the query
   */
  async processQuery(query, toolParams = {}) {
    this.logger.info(`Processing query: ${query}`);
    
    try {
      // Generate response using Groq with tool information in the context
      const completion = await this.generateCompletion(query, toolParams);
      
      // Process any tool actions in the response
      const processedResponse = await this.processToolActions(completion, toolParams);
      
      return processedResponse;
    } catch (error) {
      this.logger.error('Error processing query', error);
      throw error;
    }
  }

  /**
   * Generate completion using Groq with enhanced tool context
   * @param {string} query - The user's query
   * @param {Object} toolParams - Additional parameters
   * @returns {Promise<string>} - The LLM response
   */
  async generateCompletion(query, toolParams = {}) {
    try {
      // Get detailed tool descriptions for the LLM
      const toolsContext = this.getToolsContext();
      
      // Construct the prompt with tools context and clear instructions
      const prompt = `
      You are ${this.name}, an AI assistant equipped with tools to accomplish tasks.
      
      AVAILABLE TOOLS:
      ${toolsContext}
      
      When you need to use a tool to answer the user's query, use the following format:
      [TOOL_ACTION:tool_name:action_name:{"param1": "value1", "param2": "value2"}]
      
      Example: 
      [TOOL_ACTION:githubTool:getPR:{"number": 123}]
      
      Make sure to include ALL required parameters for the tool action. Smartly extract pull request number when necessary
      
      USER QUERY: ${query}
      
      If you need to use a tool to fulfill the request, execute the tool action. You are totally allowed to use tools action which are necessary without any confirmation.

      Provide a helpful response and include the tool action you used in your response.
      `;
      
      // Call Groq API
      return await groqService.generateChatCompletion(prompt);
    } catch (error) {
      this.logger.error('Error generating completion', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  /**
   * Generate detailed context for available tools and their parameters
   * @returns {string} - Formatted tools context for the LLM
   */
  getToolsContext() {
    if (this.tools.size === 0) {
      return 'No tools available.';
    }
    
    let toolsContext = '';
    
    this.tools.forEach((tool, name) => {
      toolsContext += `--- TOOL: ${name} ---\n`;
      toolsContext += `Description: ${tool.description || 'No description available'}\n\n`;
      
      // If tool has getAvailableActions method, use it to get detailed action info
      if (typeof tool.getAvailableActions === 'function') {
        const actions = tool.getAvailableActions();
        
        toolsContext += `Available actions:\n`;
        actions.forEach(action => {
          toolsContext += `* ${action.name}: ${action.description || 'No description'}\n`;
          
          // List required and optional parameters
          if (action.parameters && Object.keys(action.parameters).length > 0) {
            toolsContext += `  Parameters:\n`;
            
            Object.entries(action.parameters).forEach(([paramName, paramInfo]) => {
              const requiredTag = paramInfo.required ? '[REQUIRED]' : '[OPTIONAL]';
              const defaultValue = paramInfo.default ? ` (default: ${paramInfo.default})` : '';
              toolsContext += `  - ${paramName} ${requiredTag}: ${paramInfo.description || 'No description'}${defaultValue}\n`;
            });
          }
          
          toolsContext += `\n`;
        });
      } else {
        // Fallback for tools without getAvailableActions
        toolsContext += `This tool does not provide detailed action information.\n`;
      }
      
      toolsContext += `\n`;
    });
    
    return toolsContext;
  }

  /**
   * Process tool actions in the LLM response
   * @param {string} response - The LLM response text
   * @param {Object} toolParams - Additional parameters
   * @returns {Promise<Object>} - Processed response with tool results
   */
  async processToolActions(response, toolParams = {}) {
    const toolActionRegex = /\[TOOL_ACTION:([^:]+?)(?:[Tt]ool)?:([^:]+):([^\]]+)\]/g;
    let processedResponse = response;
    const toolResults = {};
    
    let match;
    // Find all tool actions in the response
    while ((match = toolActionRegex.exec(response)) !== null) {
      const [fullMatch, toolName, actionName, paramsStr] = match;
      
      try {
        // Parse parameters
        let params;
        try {
          params = JSON.parse(paramsStr);
        } catch (error) {
          this.logger.error(`Failed to parse parameters for ${toolName}.${actionName}:`, error);
          processedResponse = processedResponse.replace(
            fullMatch,
            `[Error: Invalid parameter format for ${toolName}.${actionName}]`
          );
          continue;
        }
        
        // Execute tool action

        const hasMatchingTool = Array.from(this.tools.values()).some(t => t.config.name.toLowerCase() == toolName.toLowerCase());

        if (hasMatchingTool) {
          const tool = this.tools.get(toolName);
          
          // Validate required parameters before executing
          const actionInfo = this.getActionInfo(tool, actionName);
          const missingParams = this.checkRequiredParameters(actionInfo, params);
          
          if (missingParams.length > 0) {
            throw new Error(`Missing required parameters for ${actionName}: ${missingParams.join(', ')}`);
          }
          
          // Enhance parameters with tool-specific defaults if needed
          const enhancedParams = this.enhanceToolParameters(tool, actionName, params, toolParams);
          
          // Execute the action with enhanced parameters
          const result = await tool.execute(actionName, enhancedParams);
          
          // Store result for this tool action
          const resultKey = `${toolName}_${actionName}`;
          toolResults[resultKey] = result;
          
          // Replace tool action with result summary
          processedResponse = processedResponse.replace(
            fullMatch,
            `[${resultKey} completed successfully]`
          );
        } else {
          // Tool not found
          processedResponse = processedResponse.replace(
            fullMatch,
            `[${toolName} ${actionName} result: Tool not found]`
          );
        }
      } catch (error) {
        this.logger.error(`Error executing tool action: ${toolName}.${actionName}:`, error);
        
        // Replace tool action with error
        processedResponse = processedResponse.replace(
          fullMatch, 
          `[${toolName} ${actionName} result: Error - ${error.message}]`
        );
      }
    }
    
    return {
      response: processedResponse,
      toolResults
    };
  }

  /**
   * Get action information from a tool
   * @param {Object} tool - The tool object
   * @param {string} actionName - Name of the action
   * @returns {Object|null} - Action information or null if not found
   */
  getActionInfo(tool, actionName) {
    if (typeof tool.getAvailableActions !== 'function') {
      return null;
    }
    
    const actions = tool.getAvailableActions();
    return actions.find(action => action.name === actionName) || null;
  }

  /**
   * Check if all required parameters are provided
   * @param {Object} actionInfo - Action information
   * @param {Object} params - Provided parameters
   * @returns {Array} - List of missing required parameters
   */
  checkRequiredParameters(actionInfo, params) {
    if (!actionInfo || !actionInfo.parameters) {
      return [];
    }
    
    const missingParams = [];
    
    Object.entries(actionInfo.parameters).forEach(([paramName, paramInfo]) => {
      if (paramInfo.required && (params[paramName] === undefined || params[paramName] === null)) {
        missingParams.push(paramName);
      }
    });
    
    return missingParams;
  }

  /**
   * Enhance parameters with defaults and context
   * @param {Object} tool - The tool object
   * @param {string} actionName - Name of the action
   * @param {Object} params - Original parameters
   * @param {Object} toolParams - Additional context parameters
   * @returns {Object} - Enhanced parameters
   */
  enhanceToolParameters(tool, actionName, params, toolParams) {
    const enhancedParams = { ...params };
    
    // Add tool-specific default parameters
    // For example, for GitHub tools, add owner and repo if not specified
    if (tool.constructor.name === 'GitHubTool') {
      if (!enhancedParams.owner && tool.repoOwner) {
        enhancedParams.owner = tool.repoOwner;
      }
      
      if (!enhancedParams.repo && tool.repoName) {
        enhancedParams.repo = tool.repoName;
      }
    }
    
    // Add any additional context parameters from toolParams
    if (toolParams && typeof toolParams === 'object') {
      Object.entries(toolParams).forEach(([key, value]) => {
        if (enhancedParams[key] === undefined) {
          enhancedParams[key] = value;
        }
      });
    }
    
    return enhancedParams;
  }

  /**
   * Register a tool for this agent
   * @param {string} name - Tool name
   * @param {Object} tool - Tool implementation
   */
  registerTool(name, tool) {
    this.tools.set(name, tool);
    this.logger.info(`Tool registered: ${name}`);
  }

  /**
   * Deregister a tool
   * @param {string} name - Tool name
   */
  deregisterTool(name) {
    if (this.tools.has(name)) {
      this.tools.delete(name);
      this.logger.info(`Tool deregistered: ${name}`);
      return true;
    }
    
    this.logger.warn(`Tool not found: ${name}`);
    return false;
  }

  /**
   * Clean up resources when agent is deregistered
   */
  cleanup() {
    this.logger.info(`Cleaning up agent: ${this.name}`);
    // Implement any cleanup logic here
  }
}

module.exports = BaseAgent;