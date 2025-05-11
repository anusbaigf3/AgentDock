const { Octokit } = require("@octokit/rest");
const BaseAgent = require("./baseAgent");
const groqService = require('../../services/groqService');

class GitHubAgent extends BaseAgent {
  constructor(name, config = {}) {
    super(name, config);

    // Initialize GitHub client
    this.octokit = new Octokit({
      auth: config.githubToken || process.env.GITHUB_API_TOKEN,
    });

    // Set repository context if provided
    this.repoOwner = config.repoOwner;
    this.repoName = config.repoName;

    this.logger.info(
      `GitHub agent initialized for ${this.repoOwner}/${this.repoName}`
    );
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
      
      When you need to use a tool to answer the user's query, use the following format:
      [TOOL_ACTION:tool_name:action_name:{"param1": "value1", "param2": "value2"}]
      
      Example: 
      [TOOL_ACTION:githubTool:getPR:{"number": 123}]
      
      Make sure to include ALL required parameters for the tool action. Smartly extract pull request number when necessary
      
      USER QUERY: ${query}

      Provide a helpful response and include the tool action you used in your response
      
      Instructions:
      1. Analyze the GitHub-related query
      2. Use GitHub information to provide a helpful response
      3. If tools are needed to fulfill the request, execute the tool action. You are totally allowed to use tools action which are necessary without any confirmation. Also, make sure to include parameters in params object by name not numbers, like repoOwner, repoName, number (it is mandatory for pull request actions), etc. 
      4. Include [TOOL_ACTION:tool_name:action] in your response which you used to fulfill the request
      5. Provide a helpful and informative response about GitHub
      
      Your response:
      `;

      // Call Groq API with GitHub-specific prompt
      const result = await groqService.generateCompletion(prompt);

      return result;
    } catch (error) {
      this.logger.error("Error generating GitHub completion", error);
      throw new Error(`Failed to generate GitHub response: ${error.message}`);
    }
  }

  /**
   * Get GitHub repository context
   */
  async getGitHubContext() {
    if (!this.repoOwner || !this.repoName) {
      return "No GitHub repository configured.";
    }

    try {
      // Get repo info
      const repoInfo = await this.octokit.repos.get({
        owner: this.repoOwner,
        repo: this.repoName,
      });

      // Get open issues
      const issues = await this.octokit.issues.listForRepo({
        owner: this.repoOwner,
        repo: this.repoName,
        state: "open",
        per_page: 5,
      });

      // Get recent PRs
      const prs = await this.octokit.pulls.list({
        owner: this.repoOwner,
        repo: this.repoName,
        state: "open",
        per_page: 5,
      });

      // Format context
      let context = `Repository: ${repoInfo.data.full_name}\n`;
      context += `Description: ${repoInfo.data.description || "None"}\n`;
      context += `Stars: ${repoInfo.data.stargazers_count}, Forks: ${repoInfo.data.forks_count}\n\n`;

      // Add open issues
      context += `Recent open issues (${issues.data.length}):\n`;
      issues.data.forEach((issue) => {
        context += `- #${issue.number}: ${issue.title}\n`;
      });
      context += "\n";

      // Add open PRs
      context += `Recent open pull requests (${prs.data.length}):\n`;
      prs.data.forEach((pr) => {
        context += `- #${pr.number}: ${pr.title}\n`;
      });

      return context;
    } catch (error) {
      this.logger.error("Error getting GitHub context", error);
      return `Failed to get GitHub context: ${error.message}`;
    }
  }

  /**
   * Process a user query related to GitHub
   * @param {string} query - The user's query text
   * @param {Object} toolParams - Additional parameters
   * @returns {Promise<Object>} - Query result
   */
  async processQuery(query, toolParams = {}) {
    this.logger.info(`Processing GitHub query: ${query}`);

    try {
      // Check for common GitHub-related patterns
      const result = await this.processGitHubPatterns(query);
      if (result) {
        return result;
      }

      // If no direct pattern match, use LLM to process query
      return await super.processQuery(query, toolParams);
    } catch (error) {
      this.logger.error("Error processing GitHub query:", error);
      throw error;
    }
  }

  /**
   * Process common GitHub-related query patterns directly
   * @param {string} query - User query text
   * @returns {Promise<Object|null>} - Result or null if no pattern match
   */
  async processGitHubPatterns(query) {
    // Match pattern for PR summary requests
    const prSummaryPattern =
      /(?:summarize|summarise|show|explain|tell me about) (?:pull request|PR) #?(\d+)/i;
    const prSummaryMatch = query.match(prSummaryPattern);

    if (prSummaryMatch) {
      const prNumber = parseInt(prSummaryMatch[1], 10);

      try {
        // Find the GitHub tool
        const githubTool = Array.from(this.tools.values()).find(
          (tool) => tool.name === "github" || tool.name.includes("github")
        );

        if (!githubTool) {
          return {
            response:
              "I can't access GitHub right now. Please make sure the GitHub tool is registered.",
            toolResults: {},
          };
        }

        // Use the tool to get PR summary
        const summary = await githubTool.execute("summarizePR", {
          owner: this.repoOwner,
          repo: this.repoName,
          number: prNumber,
        });

        // Format a response with the summary info
        let response = `# Pull Request #${prNumber} Summary\n\n`;
        response += `**Title:** ${summary.data.title}\n`;
        response += `**Author:** ${summary.data.author}\n`;
        response += `**Status:** ${summary.data.state} ${
          summary.data.merged ? "(merged)" : ""
        }\n\n`;

        if (summary.data.body) {
          response += `## Description\n${summary.data.body}\n\n`;
        }

        response += `## Changes\n`;
        response += `- Files changed: ${summary.data.stats.files_changed}\n`;
        response += `- Additions: ${summary.data.stats.total_additions} line(s)\n`;
        response += `- Deletions: ${summary.data.stats.total_deletions} line(s)\n`;
        response += `- Total changes: ${summary.data.stats.total_changes} line(s)\n`;
        response += `- Commits: ${summary.data.stats.commit_count}\n\n`;

        response += `## Files Changed\n`;
        summary.data.files.slice(0, 10).forEach((file) => {
          response += `- ${file.filename} (+${file.additions}, -${file.deletions})\n`;
        });

        if (summary.data.files.length > 10) {
          response += `- ... and ${
            summary.data.files.length - 10
          } more files\n`;
        }

        return {
          response,
          toolResults: { summary },
        };
      } catch (error) {
        this.logger.error(
          `Error processing PR summary for #${prNumber}:`,
          error
        );
        return {
          response: `I encountered an error trying to summarize PR #${prNumber}: ${error.message}`,
          toolResults: {},
        };
      }
    }

    // Match pattern for code review requests
    const codeReviewPattern =
      /(?:review|analyze|analyse) (?:code|changes|pull request|PR) #?(\d+)/i;
    const codeReviewMatch = query.match(codeReviewPattern);

    if (codeReviewMatch) {
      const prNumber = parseInt(codeReviewMatch[1], 10);

      try {
        // Find the GitHub tool
        const githubTool = Array.from(this.tools.values()).find(
          (tool) => tool.name === "github" || tool.name.includes("github")
        );

        if (!githubTool) {
          return {
            response:
              "I can't access GitHub right now. Please make sure the GitHub tool is registered.",
            toolResults: {},
          };
        }

        // Use the tool to review code
        const review = await githubTool.execute("reviewCode", {
          owner: this.repoOwner,
          repo: this.repoName,
          number: prNumber,
        });

        // Format a detailed code review response
        let response = `# Code Review: PR #${prNumber}\n\n`;
        response += `**Title:** ${review.data.pull_request.title}\n`;
        response += `**Author:** ${review.data.pull_request.author}\n`;
        response += `**Branch:** ${review.data.pull_request.head_ref} → ${review.data.pull_request.base_ref}\n\n`;

        response += `## Overview\n`;
        response += `- ${review.data.stats.total_files} files changed\n`;
        response += `- ${review.data.stats.total_additions} line additions\n`;
        response += `- ${review.data.stats.total_deletions} line deletions\n`;
        response += `- ${review.data.stats.commit_count} commits\n\n`;

        response += `## Files by Type\n`;
        Object.entries(review.data.changes_by_type).forEach(([ext, info]) => {
          response += `- ${ext}: ${info.count} file(s)\n`;
        });

        response += `\n## Changes By Category\n`;
        response += `- Added: ${review.data.categorized_files.added.length} file(s)\n`;
        response += `- Modified: ${review.data.categorized_files.modified.length} file(s)\n`;
        response += `- Removed: ${review.data.categorized_files.removed.length} file(s)\n`;

        if (review.data.categorized_files.added.length > 0) {
          response += `\n### Added Files\n`;
          review.data.categorized_files.added.slice(0, 5).forEach((file) => {
            response += `- ${file.filename}\n`;
          });
          if (review.data.categorized_files.added.length > 5) {
            response += `- ... and ${
              review.data.categorized_files.added.length - 5
            } more\n`;
          }
        }

        if (review.data.categorized_files.modified.length > 0) {
          response += `\n### Modified Files\n`;
          review.data.categorized_files.modified.slice(0, 5).forEach((file) => {
            response += `- ${file.filename}\n`;
          });
          if (review.data.categorized_files.modified.length > 5) {
            response += `- ... and ${
              review.data.categorized_files.modified.length - 5
            } more\n`;
          }
        }

        response += `\n## Recent Commits\n`;
        review.data.commits.slice(0, 5).forEach((commit) => {
          response += `- ${commit.sha}: ${commit.message.split("\n")[0]}\n`;
        });

        return {
          response,
          toolResults: { review },
        };
      } catch (error) {
        this.logger.error(
          `Error processing code review for PR #${prNumber}:`,
          error
        );
        return {
          response: `I encountered an error trying to review PR #${prNumber}: ${error.message}`,
          toolResults: {},
        };
      }
    }

    // No pattern matched
    return null;
  }

  /**
   * Get PR summary
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} - PR summary
   */
  async getPRSummary(prNumber) {
    try {
      const pr = await this.octokit.pulls.get({
        owner: this.repoOwner,
        repo: this.repoName,
        pull_number: prNumber,
      });

      // Get PR diff
      const diff = await this.octokit.pulls.get({
        owner: this.repoOwner,
        repo: this.repoName,
        pull_number: prNumber,
        mediaType: {
          format: "diff",
        },
      });

      // Get PR comments
      const comments = await this.octokit.pulls.listReviews({
        owner: this.repoOwner,
        repo: this.repoName,
        pull_number: prNumber,
      });

      // Summarize PR using LLM
      const prompt = `
      Summarize the following GitHub pull request:
      
      Title: ${pr.data.title}
      Author: ${pr.data.user.login}
      Description: ${pr.data.body || "No description provided"}
      
      Changes:
      ${diff.data.substring(0, 5000)}
      
      Comments:
      ${comments.data
        .map((c) => `${c.user.login}: ${c.body}`)
        .join("\n")
        .substring(0, 1000)}
      
      Please provide a concise summary of:
      1. What this PR changes
      2. Key files modified
      3. Potential issues or concerns
      `;

      const completion = await groqService.generateCompletion(prompt);

      return {
        title: pr.data.title,
        url: pr.data.html_url,
        author: pr.data.user.login,
        status: pr.data.state,
        summary:
          completion.choices[0]?.message?.content ||
          "Unable to generate summary.",
      };
    } catch (error) {
      this.logger.error(`Error getting PR summary for #${prNumber}`, error);
      throw new Error(`Failed to get PR summary: ${error.message}`);
    }
  }
}

module.exports = GitHubAgent;
