const { Groq } = require('groq-sdk');
const { createLogger } = require('../../utils/logger');

class BaseAgent {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.tools = new Map();
    this.logger = createLogger(`Agent:${name}`);
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
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
      // Generate response using Groq
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
   * Generate completion using Groq
   * @param {string} query - The user's query
   * @param {Object} toolParams - Additional parameters
   * @returns {Promise<string>} - The LLM response
   */
  async generateCompletion(query, toolParams = {}) {
    try {
      // Get available tools as context
      const toolsContext = this.getToolsContext();
      
      // Construct the prompt with tools context
      const prompt = `
      You are ${this.name}, a helpful AI assistant that can use tools to accomplish tasks.
      
      Available tools:
      ${toolsContext}
      
      User query: ${query}
      
      Instructions:
      1. Analyze the user query
      2. Determine if any tools are needed to fulfill the request
      3. If tools are needed, include [TOOL_ACTION:tool_name:action:parameters] in your response
      4. Provide a helpful and informative response
      
      Your response:
      `;
      
      // Call Groq API
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama3-70b-8192',
        temperature: 0.5,
        max_tokens: 1024
      });
      
      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error('Error generating completion', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  /**
   * Process any tool actions in the response
   * @param {string} response - The response from LLM
   * @param {Object} toolParams - Additional parameters
   * @returns {Promise<Object>} - The processed response
   */
  async processToolActions(response, toolParams = {}) {
    const toolActionRegex = /\[TOOL_ACTION:([^:]+):([^:]+):([^\]]+)\]/g;
    let match;
    let processedResponse = response;
    const toolResults = {};
    
    // Find all tool actions in the response
    while ((match = toolActionRegex.exec(response)) !== null) {
      const [fullMatch, toolName, action, paramsStr] = match;
      
      try {
        // Parse parameters
        const params = JSON.parse(paramsStr);
        
        // Execute tool action
        if (this.tools.has(toolName)) {
          const tool = this.tools.get(toolName);
          const result = await tool.execute(action, params);
          
          // Store tool result
          toolResults[`${toolName}_${action}`] = result;
          
          // Replace tool action with result summary
          processedResponse = processedResponse.replace(
            fullMatch, 
            `[${toolName} ${action} result: Success]`
          );
        } else {
          // Tool not found
          processedResponse = processedResponse.replace(
            fullMatch, 
            `[${toolName} ${action} result: Tool not found]`
          );
        }
      } catch (error) {
        this.logger.error(`Error executing tool action: ${toolName}.${action}`, error);
        
        // Replace tool action with error
        processedResponse = processedResponse.replace(
          fullMatch, 
          `[${toolName} ${action} result: Error - ${error.message}]`
        );
      }
    }
    
    return {
      response: processedResponse,
      toolResults
    };
  }

  /**
   * Get context about available tools
   * @returns {string} - Tools context for LLM
   */
  getToolsContext() {
    if (this.tools.size === 0) {
      return 'No tools available.';
    }
    
    let toolsContext = '';
    
    this.tools.forEach((tool, name) => {
      toolsContext += `- ${name}: ${tool.description}\n`;
      toolsContext += `  Actions:\n`;
      
      // Add tool actions
      tool.actions.forEach(action => {
        toolsContext += `  - ${action.name}: ${action.description}\n`;
        toolsContext += `    Parameters: ${JSON.stringify(action.parameters)}\n`;
      });
      
      toolsContext += '\n';
    });
    
    return toolsContext;
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
