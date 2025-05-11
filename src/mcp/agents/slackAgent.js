const { WebClient } = require('@slack/web-api');
const BaseAgent = require('./baseAgent');
const groqService = require('../../services/groqService');

/**
 * SlackAgent - Specialized agent for Slack operations
 * Handles channel communications, message posting, and team management
 */
class SlackAgent extends BaseAgent {
  /**
   * Create a new Slack agent
   * @param {string} name - Agent name
   * @param {Object} config - Configuration options
   */
  constructor(name, config = {}) {
    super(name, config);
    
    // Initialize Slack client if token is provided
    this.slackToken = config.slackToken || process.env.SLACK_BOT_TOKEN;
    
    if (this.slackToken) {
      this.client = new WebClient(this.slackToken);
      
      // Set default channel if provided
      this.defaultChannel = config.defaultChannel || 'general';
      
      this.logger.info(`Slack agent initialized for default channel: ${this.defaultChannel}`);
    } else {
      this.logger.warn('Slack token not provided. Some functionality may be limited.');
    }
  }

  /**
   * Override generate completion to add Slack-specific context
   * @param {string} query - User query
   * @param {Object} toolParams - Additional parameters
   * @returns {Promise<string>} - LLM response
   */
  async generateCompletion(query, toolParams = {}) {
    try {
      // Get Slack context if credentials are available
      let slackContext = '';
      if (this.client) {
        slackContext = await this.getSlackContext();
      } else {
        slackContext = 'Slack context not available. Please configure Slack credentials.';
      }
      
      // Get available tools as context
      const toolsContext = this.getToolsContext();
      
      // Construct the prompt with Slack context
      const prompt = `
      You are ${this.name}, a Slack assistant that helps users manage communication, channels, and messages.
      
      ${this.description}
      
      Slack context:
      ${slackContext}
      
      Available tools:
      ${toolsContext}
      
      User query: ${query}
      
      Instructions:
      1. Analyze the Slack-related query
      2. Use Slack information to provide a helpful response
      3. If tools are needed to fulfill the request, execute the tool action. You are totally allowed to use tools action which are necessary without any confirmation. Also, make sure to include parameters in params object by name not numbers. 
      3. Include a tool action in this format: [TOOL_ACTION:tool_name:action_name:{"param1":"value1","param2":2}] if you used any tool. 
      4. Make sure to use valid JSON format for parameters, with quotes around both keys and string values
      5. Use numbers without quotes for numeric values
      6. Provide a helpful and informative response
      
      Your response:
      `;
      
      // Call Groq API with Slack-specific prompt
      const result = await groqService.generateCompletion(prompt);
      
      return result;
    } catch (error) {
      this.logger.error('Error generating Slack completion', error);
      throw new Error(`Failed to generate Slack response: ${error.message}`);
    }
  }

  /**
   * Get Slack context information
   * @returns {Promise<string>} - Context information
   */
  async getSlackContext() {
    if (!this.client) {
      return 'No Slack client configured.';
    }
    
    try {
      let context = "Slack Information:\n";
      
      // Get channels
      try {
        const result = await this.client.conversations.list({
          limit: 10,
          exclude_archived: true
        });
        
        context += `\nChannels (${result.channels.length}):\n`;
        result.channels.forEach(channel => {
          context += `- #${channel.name}${channel.is_private ? ' (private)' : ''}\n`;
        });
      } catch (error) {
        context += "\nCouldn't retrieve channels.\n";
      }
      
      // Get recent messages from default channel
      try {
        const result = await this.client.conversations.history({
          channel: this.defaultChannel,
          limit: 5
        });
        
        context += `\nRecent messages in #${this.defaultChannel} (${result.messages.length}):\n`;
        result.messages.forEach(msg => {
          context += `- ${msg.text.substring(0, 50)}${msg.text.length > 50 ? '...' : ''}\n`;
        });
      } catch (error) {
        context += `\nCouldn't retrieve messages from #${this.defaultChannel}.\n`;
      }
      
      return context;
    } catch (error) {
      this.logger.error('Error getting Slack context', error);
      return 'Failed to get Slack context.';
    }
  }

  /**
   * Send a message to a Slack channel
   * @param {string} channel - Channel name or ID
   * @param {string} text - Message text
   * @param {Array} blocks - Message blocks
   * @returns {Promise<Object>} - Message result
   */
  async sendMessage(channel, text, blocks = null) {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }
    
    try {
      const messageParams = {
        channel: channel || this.defaultChannel,
        text
      };
      
      // Add blocks if provided
      if (blocks) {
        messageParams.blocks = blocks;
      }
      
      const result = await this.client.chat.postMessage(messageParams);
      
      this.logger.info(`Message sent to channel ${channel}`);
      return result;
    } catch (error) {
      this.logger.error(`Error sending message to channel ${channel}`, error);
      throw error;
    }
  }

  /**
   * Create a new Slack channel
   * @param {string} name - Channel name
   * @param {boolean} isPrivate - Whether the channel is private
   * @returns {Promise<Object>} - Channel result
   */
  async createChannel(name, isPrivate = false) {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }
    
    try {
      // Slack channel names must be lowercase, without spaces/periods, and shorter than 80 chars
      const formattedName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').substring(0, 79);
      
      const result = await this.client.conversations.create({
        name: formattedName,
        is_private: isPrivate
      });
      
      this.logger.info(`Channel created: ${formattedName}`);
      return result;
    } catch (error) {
      this.logger.error(`Error creating channel ${name}`, error);
      throw error;
    }
  }

  /**
   * Override processQuery to handle Slack-specific queries
   * @param {string} query - User query
   * @param {Object} toolParams - Additional parameters
   * @returns {Promise<Object>} - Query result
   */
  async processQuery(query, toolParams = {}) {
    try {
      // First, try to handle common Slack patterns directly
      const directResult = await this.processSlackQuery(query);
      if (directResult) {
        return directResult;
      }
      
      // If no direct handling, use the standard LLM approach
      return await super.processQuery(query, toolParams);
    } catch (error) {
      this.logger.error('Error processing Slack query', error);
      throw error;
    }
  }

  /**
   * Process a query specifically for Slack operations
   * @param {string} query - User query text
   * @returns {Promise<Object|null>} - Direct response or null if LLM should handle
   */
  async processSlackQuery(query) {
    // Common Slack-related patterns
    const sendMessagePattern = /send (?:a )?message to (?:channel )?(?:#)?(\w+) saying (.+)/i;
    const getChannelInfoPattern = /(?:get|show|tell me about) (?:channel|conversation) (?:#)?(\w+)/i;
    const createChannelPattern = /create (?:a )?(?:new )?channel (?:called )?(?:#)?(\w+)/i;
    
    try {
      // Check for send message pattern
      const sendMessageMatch = query.match(sendMessagePattern);
      if (sendMessageMatch) {
        const channel = sendMessageMatch[1];
        const message = sendMessageMatch[2];
        
        // Send the message
        if (this.client) {
          const result = await this.sendMessage(channel, message);
          
          return {
            response: `Message sent to #${channel}: "${message}"`,
            toolResults: { slack_sendMessage: result }
          };
        } else {
          return {
            response: 'Cannot send message: Slack client not initialized',
            toolResults: {}
          };
        }
      }
      
      // Check for channel info pattern
      const channelInfoMatch = query.match(getChannelInfoPattern);
      if (channelInfoMatch && channelInfoMatch[1]) {
        const channel = channelInfoMatch[1];
        
        // Get channel info and history
        if (this.client) {
          try {
            const channelInfo = await this.client.conversations.info({
              channel
            });
            
            const history = await this.client.conversations.history({
              channel,
              limit: 5
            });
            
            // Format channel info
            let response = `Channel #${channelInfo.channel.name}:\n`;
            response += `Members: ${channelInfo.channel.num_members}\n`;
            response += `Created: ${new Date(channelInfo.channel.created * 1000).toLocaleString()}\n`;
            response += `Private: ${channelInfo.channel.is_private ? 'Yes' : 'No'}\n\n`;
            
            // Add recent messages
            if (history.messages && history.messages.length > 0) {
              response += 'Recent messages:\n';
              history.messages.forEach(msg => {
                const time = new Date(msg.ts * 1000).toLocaleTimeString();
                response += `[${time}] ${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}\n`;
              });
            } else {
              response += 'No recent messages found.\n';
            }
            
            return {
              response,
              toolResults: {
                channelInfo: channelInfo.channel,
                history: history.messages
              }
            };
          } catch (error) {
            return {
              response: `Couldn't get information for channel #${channel}: ${error.message}`,
              toolResults: { error: error.message }
            };
          }
        } else {
          return {
            response: 'Cannot get channel info: Slack client not initialized',
            toolResults: {}
          };
        }
      }
      
      // Check for create channel pattern
      const createChannelMatch = query.match(createChannelPattern);
      if (createChannelMatch && createChannelMatch[1]) {
        const channelName = createChannelMatch[1].toLowerCase();
        
        // Create the channel
        if (this.client) {
          try {
            const result = await this.createChannel(channelName);
            
            return {
              response: `Channel #${result.channel.name} has been created successfully!`,
              toolResults: { slack_createChannel: result }
            };
          } catch (error) {
            return {
              response: `Failed to create channel #${channelName}: ${error.message}`,
              toolResults: { error: error.message }
            };
          }
        } else {
          return {
            response: 'Cannot create channel: Slack client not initialized',
            toolResults: {}
          };
        }
      }
      
      // Return null if no pattern matches
      return null;
      
    } catch (error) {
      this.logger.error('Error processing Slack query directly', error);
      return null; // Fall back to LLM if direct processing fails
    }
  }
}

module.exports = SlackAgent;