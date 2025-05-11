// src/mcp/tools/githubTool.js
const { Octokit } = require('@octokit/rest');
const BaseTool = require('./baseTool');

class GitHubTool extends BaseTool {
  constructor(name, toolConfig = {}) {
    super(name, toolConfig);
    
    // Initialize GitHub client
    this.octokit = new Octokit({
      auth: toolConfig.githubToken || process.env.GITHUB_API_TOKEN
    });
    
    // Set repository context if provided
    this.repoOwner = toolConfig.config.repoOwner;
    this.repoName = toolConfig.config.repoName;
    
    this.logger.info(`GitHub tool initialized for ${this.repoOwner}/${this.repoName}`);
  }

  /**
   * Get available actions for this tool
   * @returns {Array} - Array of action objects
   */
  getAvailableActions() {
    return [
      {
        name: 'info',
        description: 'Get information about this tool',
        parameters: {}
      },
      {
        name: 'listPRs',
        description: 'List pull requests for the repository',
        parameters: {
          state: {
            type: 'string',
            description: 'State of PRs to fetch (open, closed, all)',
            default: 'open',
            required: false
          },
          limit: {
            type: 'number',
            description: 'Maximum number of PRs to return',
            default: 5,
            required: false
          }
        }
      },
      {
        name: 'getPR',
        description: 'Get details about a specific pull request',
        parameters: {
          number: {
            type: 'number',
            description: 'PR number',
            required: true
          }
        }
      },
      {
        name: 'listIssues',
        description: 'List issues for the repository',
        parameters: {
          state: {
            type: 'string',
            description: 'State of issues to fetch (open, closed, all)',
            default: 'open',
            required: false
          },
          limit: {
            type: 'number',
            description: 'Maximum number of issues to return',
            default: 5,
            required: false
          }
        }
      },
      {
        name: 'getIssue',
        description: 'Get details about a specific issue',
        parameters: {
          number: {
            type: 'number',
            description: 'Issue number',
            required: true
          }
        }
      },
      {
        name: 'createComment',
        description: 'Create a comment on an issue or PR',
        parameters: {
          number: {
            type: 'number',
            description: 'Issue or PR number',
            required: true
          },
          body: {
            type: 'string',
            description: 'Comment text',
            required: true
          }
        }
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
    // Validate repository configuration
    if (!this.repoOwner || !this.repoName) {
      throw new Error('GitHub repository not configured');
    }
    
    // Find the action
    const actionObj = this.actions.find(a => a.name === action);
    if (!actionObj) {
      throw new Error(`Action '${action}' not found for GitHub tool`);
    }
    
    // Validate parameters
    this.validateParams(action, params, actionObj.parameters);
    
    // Execute appropriate method based on action
    switch (action) {
      case 'info':
        return this.getInfo();
      case 'listPRs':
        return this.listPRs(params);
      case 'getPR':
        return this.getPR(params);
      case 'listIssues':
        return this.listIssues(params);
      case 'getIssue':
        return this.getIssue(params);
      case 'createComment':
        return this.createComment(params);
      default:
        throw new Error(`Action '${action}' not implemented for GitHub tool`);
    }
  }

  /**
   * List pull requests
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - List of PRs
   */
  async listPRs(params) {
    const { state = 'open', limit = 5 } = params;
    
    try {
      const prs = await this.octokit.pulls.list({
        owner: this.repoOwner,
        repo: this.repoName,
        state,
        per_page: limit
      });
      
      return {
        success: true,
        data: prs.data.map(pr => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          author: pr.user.login,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          url: pr.html_url
        }))
      };
    } catch (error) {
      this.logger.error('Error listing PRs', error);
      throw new Error(`Failed to list PRs: ${error.message}`);
    }
  }

  /**
   * Get a specific pull request
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - PR details
   */
  async getPR(params) {
    const { number } = params;
    
    try {
      const pr = await this.octokit.pulls.get({
        owner: this.repoOwner,
        repo: this.repoName,
        pull_number: number
      });
      
      // Get PR comments
      const comments = await this.octokit.issues.listComments({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: number
      });
      
      return {
        success: true,
        data: {
          number: pr.data.number,
          title: pr.data.title,
          state: pr.data.state,
          body: pr.data.body,
          author: pr.data.user.login,
          created_at: pr.data.created_at,
          updated_at: pr.data.updated_at,
          merged: pr.data.merged,
          mergeable: pr.data.mergeable,
          comments: comments.data.map(comment => ({
            author: comment.user.login,
            body: comment.body,
            created_at: comment.created_at
          })),
          url: pr.data.html_url
        }
      };
    } catch (error) {
      this.logger.error(`Error getting PR #${number}`, error);
      throw new Error(`Failed to get PR #${number}: ${error.message}`);
    }
  }

  /**
   * List issues
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - List of issues
   */
  async listIssues(params) {
    const { state = 'open', limit = 5 } = params;
    
    try {
      const issues = await this.octokit.issues.listForRepo({
        owner: this.repoOwner,
        repo: this.repoName,
        state,
        per_page: limit
      });
      
      return {
        success: true,
        data: issues.data
          .filter(issue => !issue.pull_request) // Filter out PRs
          .map(issue => ({
            number: issue.number,
            title: issue.title,
            state: issue.state,
            author: issue.user.login,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            url: issue.html_url
          }))
      };
    } catch (error) {
      this.logger.error('Error listing issues', error);
      throw new Error(`Failed to list issues: ${error.message}`);
    }
  }

  /**
   * Get a specific issue
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Issue details
   */
  async getIssue(params) {
    const { number } = params;
    
    try {
      const issue = await this.octokit.issues.get({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: number
      });
      
      // Get issue comments
      const comments = await this.octokit.issues.listComments({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: number
      });
      
      return {
        success: true,
        data: {
          number: issue.data.number,
          title: issue.data.title,
          state: issue.data.state,
          body: issue.data.body,
          author: issue.data.user.login,
          created_at: issue.data.created_at,
          updated_at: issue.data.updated_at,
          comments: comments.data.map(comment => ({
            author: comment.user.login,
            body: comment.body,
            created_at: comment.created_at
          })),
          url: issue.data.html_url
        }
      };
    } catch (error) {
      this.logger.error(`Error getting issue #${number}`, error);
      throw new Error(`Failed to get issue #${number}: ${error.message}`);
    }
  }

  /**
   * Create a comment on an issue or PR
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Comment result
   */
  async createComment(params) {
    const { number, body } = params;
    
    try {
      const comment = await this.octokit.issues.createComment({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: number,
        body
      });
      
      return {
        success: true,
        data: {
          id: comment.data.id,
          body: comment.data.body,
          url: comment.data.html_url
        }
      };
    } catch (error) {
      this.logger.error(`Error creating comment on #${number}`, error);
      throw new Error(`Failed to create comment: ${error.message}`);
    }
  }
}

module.exports = GitHubTool;
