const { WebClient } = require('@slack/web-api');
const BaseTool = require('./baseTool');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('SlackTool');

/**
 * SlackTool - Tool for interacting with Slack API
 * Provides functionality for sending messages, managing channels, and retrieving workspace info
 */
class SlackTool extends BaseTool {
  constructor(name, config = {}) {
    super(name, config);
    
    // Initialize Slack client
    this.slackToken = config.authConfig?.token || process.env.SLACK_BOT_TOKEN;
    
    if (this.slackToken) {
      this.client = new WebClient(this.slackToken);
      
      // Set default channel
      this.defaultChannel = config.defaultChannel || 'general';
      
      logger.info(`Slack tool initialized with token: ${this.slackToken ? '✓' : '✗'}`);
    } else {
      logger.warn('Slack token not provided. Tool will not be functional.');
    }
  }

  /**
   * Execute a specific action with the provided parameters
   * @param {string} action - The action to execute
   * @param {Object} params - Parameters for the action
   * @returns {Promise<any>} Result of the action
   */
  async execute(action, params = {}) {
    // Validate Slack client
    if (!this.client) {
      throw new Error('Slack client not initialized. Please check your API token.');
    }

    switch (action) {
      case 'info':
        return this.getInfo();
      case 'sendMessage':
        return this.sendMessage(params);
      case 'getChannels':
        return this.getChannels(params);
      case 'getChannelHistory':
        return this.getChannelHistory(params);
      case 'findUser':
        return this.findUser(params);
      case 'createChannel':
        return this.createChannel(params);
      case 'joinChannel':
        return this.joinChannel(params);
      case 'leaveChannel':
        return this.leaveChannel(params);
      case 'inviteToChannel':
        return this.inviteToChannel(params);
      case 'addReaction':
        return this.addReaction(params);
      case 'searchMessages':
        return this.searchMessages(params);
      default:
        throw new Error(`Action '${action}' not implemented for Slack tool`);
    }
  }

  /**
   * Get information about the Slack tool
   * @returns {Object} Tool information
   */
  async getInfo() {
    try {
      // Get authenticated bot info
      const auth = await this.client.auth.test();
      
      return {
        success: true,
        data: {
          name: this.name,
          description: this.description,
          bot_id: auth.bot_id,
          bot_name: auth.user,
          team: auth.team,
          authenticated: true,
          actions: this.getAvailableActions().map(action => action.name)
        }
      };
    } catch (error) {
      logger.error('Error getting Slack info:', error);
      throw new Error(`Failed to get Slack info: ${error.message}`);
    }
  }

  /**
   * Send a message to a Slack channel
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} Message result
   */
  async sendMessage(params) {
    try {
      const { channel = this.defaultChannel, text, blocks } = params;
      
      const messageParams = {
        channel,
        text
      };
      
      // Add blocks if provided
      if (blocks) {
        messageParams.blocks = blocks;
      }
      
      const result = await this.client.chat.postMessage(messageParams);
      
      return {
        success: true,
        data: {
          channel: result.channel,
          ts: result.ts,
          message: {
            text: result.message.text
          }
        }
      };
    } catch (error) {
      logger.error('Error sending Slack message:', error);
      throw new Error(`Failed to send Slack message: ${error.message}`);
    }
  }

  /**
   * Get a list of Slack channels
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} Channels list
   */
  async getChannels(params) {
    try {
      const { limit = 100 } = params;
      
      // Get public channels
      const result = await this.client.conversations.list({
        limit,
        exclude_archived: true
      });
      
      return {
        success: true,
        data: result.channels.map(channel => ({
          id: channel.id,
          name: channel.name,
          is_private: channel.is_private,
          num_members: channel.num_members,
          topic: channel.topic?.value || '',
          purpose: channel.purpose?.value || ''
        }))
      };
    } catch (error) {
      logger.error('Error getting Slack channels:', error);
      throw new Error(`Failed to get Slack channels: ${error.message}`);
    }
  }

  /**
   * Get message history for a channel
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} Channel history
   */
  async getChannelHistory(params) {
    try {
      const { channel, limit = 20 } = params;
      
      const result = await this.client.conversations.history({
        channel,
        limit
      });
      
      return {
        success: true,
        data: {
          messages: result.messages.map(msg => ({
            text: msg.text,
            user: msg.user,
            ts: msg.ts,
            thread_ts: msg.thread_ts,
            reply_count: msg.reply_count || 0,
            reactions: msg.reactions || []
          })),
          has_more: result.has_more
        }
      };
    } catch (error) {
      logger.error('Error getting channel history:', error);
      throw new Error(`Failed to get channel history: ${error.message}`);
    }
  }

  /**
   * Find a user by email or name
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} User search results
   */
  async findUser(params) {
    try {
      const { query } = params;
      
      // Try to find by email first
      let user;
      if (query.includes('@')) {
        try {
          const result = await this.client.users.lookupByEmail({
            email: query
          });
          user = result.user;
        } catch (error) {
          // Email not found, continue to search by name
          logger.info(`User not found by email '${query}', trying name search`);
        }
      }
      
      // If not found by email, search by name
      if (!user) {
        const result = await this.client.users.list();
        user = result.members.find(member => 
          member.name.toLowerCase().includes(query.toLowerCase()) || 
          (member.profile.real_name && member.profile.real_name.toLowerCase().includes(query.toLowerCase()))
        );
      }
      
      if (!user) {
        return {
          success: false,
          data: {
            message: `No user found matching '${query}'`
          }
        };
      }
      
      return {
        success: true,
        data: {
          id: user.id,
          name: user.name,
          real_name: user.profile.real_name,
          email: user.profile.email,
          avatar: user.profile.image_72,
          is_bot: user.is_bot
        }
      };
    } catch (error) {
      logger.error('Error finding Slack user:', error);
      throw new Error(`Failed to find Slack user: ${error.message}`);
    }
  }

  /**
   * Create a new Slack channel
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} New channel result
   */
  async createChannel(params) {
    try {
      const { name, is_private = false, description = '' } = params;
      
      // Slack channel names must be lowercase, without spaces/periods, and shorter than 80 chars
      const formattedName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').substring(0, 79);
      
      const result = await this.client.conversations.create({
        name: formattedName,
        is_private
      });
      
      // Set channel topic/description if provided
      if (description) {
        await this.client.conversations.setTopic({
          channel: result.channel.id,
          topic: description
        });
      }
      
      return {
        success: true,
        data: {
          id: result.channel.id,
          name: result.channel.name,
          is_private: result.channel.is_private,
          creator: result.channel.creator
        }
      };
    } catch (error) {
      logger.error('Error creating Slack channel:', error);
      throw new Error(`Failed to create Slack channel: ${error.message}`);
    }
  }

  /**
   * Join a Slack channel
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} Join result
   */
  async joinChannel(params) {
    try {
      const { channel } = params;
      
      const result = await this.client.conversations.join({
        channel
      });
      
      return {
        success: true,
        data: {
          id: result.channel.id,
          name: result.channel.name,
          is_private: result.channel.is_private
        }
      };
    } catch (error) {
      logger.error('Error joining Slack channel:', error);
      throw new Error(`Failed to join Slack channel: ${error.message}`);
    }
  }

  /**
   * Leave a Slack channel
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} Leave result
   */
  async leaveChannel(params) {
    try {
      const { channel } = params;
      
      const result = await this.client.conversations.leave({
        channel
      });
      
      return {
        success: true,
        data: {
          ok: result.ok
        }
      };
    } catch (error) {
      logger.error('Error leaving Slack channel:', error);
      throw new Error(`Failed to leave Slack channel: ${error.message}`);
    }
  }

  /**
   * Invite a user to a channel
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} Invite result
   */
  async inviteToChannel(params) {
    try {
      const { channel, users } = params;
      
      // Make sure users is an array
      const userArray = Array.isArray(users) ? users : [users];
      
      const result = await this.client.conversations.invite({
        channel,
        users: userArray.join(',')
      });
      
      return {
        success: true,
        data: {
          channel: {
            id: result.channel.id,
            name: result.channel.name
          }
        }
      };
    } catch (error) {
      logger.error('Error inviting users to Slack channel:', error);
      throw new Error(`Failed to invite users to Slack channel: ${error.message}`);
    }
  }

  /**
   * Add a reaction to a message
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} Reaction result
   */
  async addReaction(params) {
    try {
      const { channel, timestamp, name } = params;
      
      const result = await this.client.reactions.add({
        channel,
        timestamp,
        name
      });
      
      return {
        success: true,
        data: {
          ok: result.ok
        }
      };
    } catch (error) {
      logger.error('Error adding reaction to Slack message:', error);
      throw new Error(`Failed to add reaction to Slack message: ${error.message}`);
    }
  }

  /**
   * Search for messages
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} Search result
   */
  async searchMessages(params) {
    try {
      const { query, count = 20 } = params;
      
      const result = await this.client.search.messages({
        query,
        count
      });
      
      return {
        success: true,
        data: {
          total: result.messages.total,
          matches: result.messages.matches.map(match => ({
            text: match.text,
            user: match.user,
            ts: match.ts,
            channel: {
              id: match.channel.id,
              name: match.channel.name
            },
            permalink: match.permalink
          }))
        }
      };
    } catch (error) {
      logger.error('Error searching Slack messages:', error);
      throw new Error(`Failed to search Slack messages: ${error.message}`);
    }
  }

  /**
   * Get available actions for this tool
   * @returns {Array} List of available actions
   */
  getAvailableActions() {
    return [
      {
        name: 'info',
        description: 'Get information about this tool',
        parameters: {}
      },
      {
        name: 'sendMessage',
        description: 'Send a message to a Slack channel',
        parameters: {
          channel: {
            type: 'string',
            description: 'Channel name or ID',
            required: true
          },
          text: {
            type: 'string',
            description: 'Message text',
            required: true
          },
          blocks: {
            type: 'array',
            description: 'Message blocks (formatted content)',
            required: false
          }
        }
      },
      {
        name: 'getChannels',
        description: 'List all accessible channels',
        parameters: {
          limit: {
            type: 'number',
            description: 'Maximum number of channels to return',
            required: false
          }
        }
      },
      {
        name: 'getChannelHistory',
        description: 'Get message history for a channel',
        parameters: {
          channel: {
            type: 'string',
            description: 'Channel name or ID',
            required: true
          },
          limit: {
            type: 'number',
            description: 'Maximum number of messages to return',
            required: false
          }
        }
      },
      {
        name: 'findUser',
        description: 'Find a user by email or name',
        parameters: {
          query: {
            type: 'string',
            description: 'Email or display name to search for',
            required: true
          }
        }
      },
      {
        name: 'createChannel',
        description: 'Create a new Slack channel',
        parameters: {
          name: {
            type: 'string',
            description: 'Channel name',
            required: true
          },
          is_private: {
            type: 'boolean',
            description: 'Whether the channel should be private',
            required: false
          },
          description: {
            type: 'string',
            description: 'Channel description',
            required: false
          }
        }
      },
      {
        name: 'joinChannel',
        description: 'Join a Slack channel',
        parameters: {
          channel: {
            type: 'string',
            description: 'Channel name or ID',
            required: true
          }
        }
      },
      {
        name: 'leaveChannel',
        description: 'Leave a Slack channel',
        parameters: {
          channel: {
            type: 'string',
            description: 'Channel name or ID',
            required: true
          }
        }
      },
      {
        name: 'inviteToChannel',
        description: 'Invite users to a channel',
        parameters: {
          channel: {
            type: 'string',
            description: 'Channel name or ID',
            required: true
          },
          users: {
            type: 'string|array',
            description: 'User IDs to invite (single ID or array of IDs)',
            required: true
          }
        }
      },
      {
        name: 'addReaction',
        description: 'Add a reaction to a message',
        parameters: {
          channel: {
            type: 'string',
            description: 'Channel name or ID',
            required: true
          },
          timestamp: {
            type: 'string',
            description: 'Message timestamp',
            required: true
          },
          name: {
            type: 'string',
            description: 'Reaction emoji name',
            required: true
          }
        }
      },
      {
        name: 'searchMessages',
        description: 'Search for messages',
        parameters: {
          query: {
            type: 'string',
            description: 'Search query',
            required: true
          },
          count: {
            type: 'number',
            description: 'Maximum number of results to return',
            required: false
          }
        }
      }
    ];
  }
}

module.exports = SlackTool;