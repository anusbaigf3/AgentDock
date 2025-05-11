// src/mcp/agents/githubAgent.js
const { Octokit } = require('@octokit/rest');
const BaseAgent = require('./baseAgent');

class GitHubAgent extends BaseAgent {
  constructor(name, config = {}) {
    super(name, config);
    
    // Initialize GitHub client
    this.octokit = new Octokit({
      auth: config.githubToken || process.env.GITHUB_API_TOKEN
    });
    
    // Set repository context if provided
    this.repoOwner = config.repoOwner;
    this.repoName = config.repoName;
    
    this.logger.info(`GitHub agent initialized for ${this.repoOwner}/${this.repoName}`);
  }

  /**
   * Override generate completion to add GitHub-specific context
   */
  async generateCompletion(query, toolParams = {}) {
    try {
      // Get GitHub context
      const githubContext = await this.getGitHubContext();
      
      // Get available tools as context
      const toolsContext = this.getToolsContext();
      
      // Construct the prompt with GitHub context
      const prompt = `
      You are ${this.name}, a GitHub assistant working with the repository ${this.repoOwner}/${this.repoName}.
      
      GitHub context:
      ${githubContext}
      
      Available tools:
      ${toolsContext}
      
      User query: ${query}
      
      Instructions:
      1. Analyze the GitHub-related query
      2. Use GitHub information to provide a helpful response
      3. If tools are needed, include [TOOL_ACTION:tool_name:action:parameters] in your response
      4. Provide a helpful and informative response about GitHub
      
      Your response:
      `;
      
      // Call Groq API with GitHub-specific prompt
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama3-70b-8192',
        temperature: 0.3,
        max_tokens: 1024
      });
      
      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error('Error generating GitHub completion', error);
      throw new Error(`Failed to generate GitHub response: ${error.message}`);
    }
  }

  /**
   * Get GitHub repository context
   */
  async getGitHubContext() {
    if (!this.repoOwner || !this.repoName) {
      return 'No GitHub repository configured.';
    }
    
    try {
      // Get repo info
      const repoInfo = await this.octokit.repos.get({
        owner: this.repoOwner,
        repo: this.repoName
      });
      
      // Get open issues
      const issues = await this.octokit.issues.listForRepo({
        owner: this.repoOwner,
        repo: this.repoName,
        state: 'open',
        per_page: 5
      });
      
      // Get recent PRs
      const prs = await this.octokit.pulls.list({
        owner: this.repoOwner,
        repo: this.repoName,
        state: 'open',
        per_page: 5
      });
      
      // Format context
      let context = `Repository: ${repoInfo.data.full_name}\n`;
      context += `Description: ${repoInfo.data.description || 'None'}\n`;
      context += `Stars: ${repoInfo.data.stargazers_count}, Forks: ${repoInfo.data.forks_count}\n\n`;
      
      // Add open issues
      context += `Recent open issues (${issues.data.length}):\n`;
      issues.data.forEach(issue => {
        context += `- #${issue.number}: ${issue.title}\n`;
      });
      context += '\n';
      
      // Add open PRs
      context += `Recent open pull requests (${prs.data.length}):\n`;
      prs.data.forEach(pr => {
        context += `- #${pr.number}: ${pr.title}\n`;
      });
      
      return context;
    } catch (error) {
      this.logger.error('Error getting GitHub context', error);
      return `Failed to get GitHub context: ${error.message}`;
    }
  }

  /**
   * Get PR summary
   */
  async getPRSummary(prNumber) {
    try {
      const pr = await this.octokit.pulls.get({
        owner: this.repoOwner,
        repo: this.repoName,
        pull_number: prNumber
      });
      
      // Get PR diff
      const diff = await this.octokit.pulls.get({
        owner: this.repoOwner,
        repo: this.repoName,
        pull_number: prNumber,
        mediaType: {
          format: 'diff'
        }
      });
      
      // Get PR comments
      const comments = await this.octokit.pulls.listReviews({
        owner: this.repoOwner,
        repo: this.repoName,
        pull_number: prNumber
      });
      
      // Summarize PR using LLM
      const prompt = `
      Summarize the following GitHub pull request:
      
      Title: ${pr.data.title}
      Author: ${pr.data.user.login}
      Description: ${pr.data.body || 'No description provided'}
      
      Changes:
      ${diff.data.substring(0, 5000)}
      
      Comments:
      ${comments.data.map(c => `${c.user.login}: ${c.body}`).join('\n').substring(0, 1000)}
      
      Please provide a concise summary of:
      1. What this PR changes
      2. Key files modified
      3. Potential issues or concerns
      `;
      
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama3-70b-8192',
        temperature: 0.3,
        max_tokens: 512
      });
      
      return {
        title: pr.data.title,
        url: pr.data.html_url,
        author: pr.data.user.login,
        status: pr.data.state,
        summary: completion.choices[0]?.message?.content || 'Unable to generate summary.'
      };
    } catch (error) {
      this.logger.error(`Error getting PR summary for #${prNumber}`, error);
      throw new Error(`Failed to get PR summary: ${error.message}`);
    }
  }
}

module.exports = GitHubAgent;
