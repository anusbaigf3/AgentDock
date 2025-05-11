// src/mcp/tools/githubTool.js
const { Octokit } = require("@octokit/rest");
const BaseTool = require("./baseTool");

class GitHubTool extends BaseTool {
  constructor(name, toolConfig = {}) {
    super(name, toolConfig);

    // Initialize GitHub client
    this.octokit = new Octokit({
      auth: toolConfig.githubToken || process.env.GITHUB_API_TOKEN,
    });

    // Set repository context if provided
    this.repoOwner = toolConfig.config.repoOwner;
    this.repoName = toolConfig.config.repoName;

    this.logger.info(
      `GitHub tool initialized for ${this.repoOwner}/${this.repoName}`
    );
  }

  /**
   * Get available actions for this tool
   * @returns {Array} - Array of action objects
   */
  getAvailableActions() {
    return [
      {
        name: "info",
        description: "Get information about this tool",
        parameters: {},
      },
      {
        name: "listPRs",
        description: "List pull requests for the repository",
        parameters: {
          state: {
            type: "string",
            description: "State of PRs to fetch (open, closed, all)",
            default: "open",
            required: false,
          },
          limit: {
            type: "number",
            description: "Maximum number of PRs to return",
            default: 5,
            required: false,
          },
        },
      },
      {
        name: "getPR",
        description: "Get details about a specific pull request",
        parameters: {
          number: {
            type: "number",
            description: "PR number",
            required: true,
          },
        },
      },
      {
        name: "listIssues",
        description: "List issues for the repository",
        parameters: {
          state: {
            type: "string",
            description: "State of issues to fetch (open, closed, all)",
            default: "open",
            required: false,
          },
          limit: {
            type: "number",
            description: "Maximum number of issues to return",
            default: 5,
            required: false,
          },
        },
      },
      {
        name: "getIssue",
        description: "Get details about a specific issue",
        parameters: {
          number: {
            type: "number",
            description: "Issue number",
            required: true,
          },
        },
      },
      {
        name: "reviewCode",
        description: "Perform a detailed code review of a pull request",
        parameters: {
          number: {
            type: "number",
            description: "Pull request number",
            required: true,
          },
        },
      },
      {
        name: "summarizePR",
        description: "Get a detailed summary of a pull request",
        parameters: {
          number: {
            type: "number",
            description: "Pull request number",
            required: true,
          },
        },
      },
      {
        name: "getChangedFiles",
        description:
          "Get detailed information about files changed in a pull request",
        parameters: {
          number: {
            type: "number",
            description: "Pull request number",
            required: true,
          },
        },
      },
      {
        name: "reviewCode",
        description: "Perform a detailed code review of a pull request",
        parameters: {
          number: {
            type: "number",
            description: "Pull request number",
            required: true,
          },
        },
      },
      {
        name: "createComment",
        description: "Create a comment on an issue or PR",
        parameters: {
          number: {
            type: "number",
            description: "Issue or PR number",
            required: true,
          },
          body: {
            type: "string",
            description: "Comment text",
            required: true,
          },
        },
      },
      {
        name: "mergePullRequest",
        description: "Merge a pull request",
        parameters: [
          { name: "owner", type: "string", description: "Repository owner" },
          { name: "repo", type: "string", description: "Repository name" },
          {
            name: "pullNumber",
            type: "number",
            description: "Pull request number",
          },
          {
            name: "commitMessage",
            type: "string",
            description: "Custom commit message",
            optional: true,
          },
          {
            name: "mergeMethod",
            type: "string",
            description: "Merge method (merge, squash, rebase)",
            optional: true,
          },
        ],
      },
      {
        name: "declinePullRequest",
        description: "Decline (close) a pull request without merging",
        parameters: [
          { name: "owner", type: "string", description: "Repository owner" },
          { name: "repo", type: "string", description: "Repository name" },
          {
            name: "pullNumber",
            type: "number",
            description: "Pull request number",
          },
          {
            name: "reason",
            type: "string",
            description: "Reason for declining the pull request",
            optional: true,
          },
        ],
      },
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
      throw new Error("GitHub repository not configured");
    }

    // Find the action
    const actionObj = this.actions.find((a) => a.name === action);
    if (!actionObj) {
      throw new Error(`Action '${action}' not found for GitHub tool`);
    }

    // Validate parameters
    this.validateParams(action, params, actionObj.parameters);

    // Execute appropriate method based on action
    switch (action) {
      case "info":
        return this.getInfo();
      case "listRepositories":
      case "getRepositories":
        return this.getRepositories();
      case "listRepositories":
      case "getRepositories":
        return this.getRepositories();
      case "listPRs":
      case "getPullRequests":
        return this.getPullRequests(params);
      case "getPR":
      case "getPullRequestDetails":
        return this.getPR(params);
      case "listIssues":
        return this.listIssues(params);
      case "getIssue":
        return this.getIssue(params);
      case "summarizePR":
      case "summarizePullRequest":
        return this.summarizePR(params);
      case "getChangedFiles":
        return this.getChangedFiles(params);
      case "reviewPR":
      case "reviewCode":
      case "codeReview":
        return this.reviewCode(params);
      case "addComment":
      case "addNewComment":
      case "createComment":
        return this.createComment(params);
      case "mergePR":
      case "mergePullRequest":
        return this.mergePullRequest(params);
      case "declinePR":
      case "declinePullRequest":
        return this.declinePullRequest(params);
      default:
        throw new Error(`Action '${action}' not implemented for GitHub tool`);
    }
  }

  /**
   * Get list of repositories for the authenticated user
   * @returns {Promise<Object>} List of repositories
   */
  async getRepositories() {
    try {
      const { data: repos } = await this.octokit.repos.listForAuthenticatedUser(
        {
          sort: "updated",
          per_page: 100,
        }
      );

      return {
        success: true,
        data: repos.map((repo) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          private: repo.private,
          url: repo.html_url,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
        })),
      };
    } catch (error) {
      logger.error("Error getting repositories:", error);
      throw new Error(`Failed to get repositories: ${error.message}`);
    }
  }

  /**
   * List pull requests
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - List of PRs
   */
  async getPullRequests(params) {
    const { state = "open", limit = 5 } = params;

    try {
      const prs = await this.octokit.pulls.list({
        owner: this.repoOwner,
        repo: this.repoName,
        state,
        per_page: limit,
      });

      return {
        success: true,
        data: prs.data.map((pr) => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          author: pr.user.login,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          url: pr.html_url,
        })),
      };
    } catch (error) {
      this.logger.error("Error listing PRs", error);
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
        pull_number: number,
      });

      // Get PR comments
      const comments = await this.octokit.issues.listComments({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: number,
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
          comments: comments.data.map((comment) => ({
            author: comment.user.login,
            body: comment.body,
            created_at: comment.created_at,
          })),
          url: pr.data.html_url,
        },
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
    const { state = "open", limit = 5 } = params;

    try {
      const issues = await this.octokit.issues.listForRepo({
        owner: this.repoOwner,
        repo: this.repoName,
        state,
        per_page: limit,
      });

      return {
        success: true,
        data: issues.data
          .filter((issue) => !issue.pull_request) // Filter out PRs
          .map((issue) => ({
            number: issue.number,
            title: issue.title,
            state: issue.state,
            author: issue.user.login,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            url: issue.html_url,
          })),
      };
    } catch (error) {
      this.logger.error("Error listing issues", error);
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
        issue_number: number,
      });

      // Get issue comments
      const comments = await this.octokit.issues.listComments({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: number,
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
          comments: comments.data.map((comment) => ({
            author: comment.user.login,
            body: comment.body,
            created_at: comment.created_at,
          })),
          url: issue.data.html_url,
        },
      };
    } catch (error) {
      this.logger.error(`Error getting issue #${number}`, error);
      throw new Error(`Failed to get issue #${number}: ${error.message}`);
    }
  }

  /**
   * Create a summarized report of a pull request
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} PR summary
   */
  async summarizePR(params) {
    const { owner = this.repoOwner, repo = this.repoName, number } = params;

    if (!owner || !repo) {
      throw new Error("Repository owner and name are required");
    }

    if (!number) {
      throw new Error("Pull request number is required");
    }

    try {
      // Get PR details
      const prResult = await this.getPR({ owner, repo, number });
      const pr = prResult.data;

      // Get PR files
      const { data: files } = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: number,
        per_page: 100, // Increase to get more files
      });

      // Get PR commits
      const { data: commits } = await this.octokit.pulls.listCommits({
        owner,
        repo,
        pull_number: number,
        per_page: 100,
      });

      // Build summary
      return {
        success: true,
        data: {
          ...pr,
          files: files.map((file) => ({
            filename: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: file.patch || null, // Include the diff patch
            blob_url: file.blob_url,
            raw_url: file.raw_url,
          })),
          commits: commits.map((commit) => ({
            sha: commit.sha,
            message: commit.commit.message,
            author: commit.author
              ? commit.author.login
              : commit.commit.author.name,
            date: commit.commit.author.date,
          })),
          stats: {
            files_changed: files.length,
            total_additions: files.reduce(
              (sum, file) => sum + file.additions,
              0
            ),
            total_deletions: files.reduce(
              (sum, file) => sum + file.deletions,
              0
            ),
            total_changes: files.reduce((sum, file) => sum + file.changes, 0),
            commit_count: commits.length,
          },
        },
      };
    } catch (error) {
      logger.error(`Error summarizing PR #${number}:`, error);
      throw new Error(`Failed to summarize PR #${number}: ${error.message}`);
    }
  }

  /**
   * Get the changed files in a pull request with detailed line changes
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} File changes details
   */
  async getChangedFiles(params) {
    const { owner = this.repoOwner, repo = this.repoName, number } = params;

    if (!owner || !repo) {
      throw new Error("Repository owner and name are required");
    }

    if (!number) {
      throw new Error("Pull request number is required");
    }

    try {
      // Get files changed in the PR
      const { data: files } = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: number,
        per_page: 100, // Increase to get more files
      });

      // Calculate totals
      const totalAdditions = files.reduce(
        (sum, file) => sum + file.additions,
        0
      );
      const totalDeletions = files.reduce(
        (sum, file) => sum + file.deletions,
        0
      );
      const totalChanges = files.reduce((sum, file) => sum + file.changes, 0);

      // Format each file with detailed changes
      const fileDetails = files.map((file) => {
        // Parse the patch to extract line changes if patch exists
        let lineChanges = [];
        if (file.patch) {
          // Split patch into chunks
          const chunks = file.patch.split("@@ ");
          for (let i = 1; i < chunks.length; i++) {
            const chunk = chunks[i];
            // Extract the line numbers information
            const lineInfo = chunk.split(" @@")[0];
            const changes = chunk.split(" @@")[1];

            if (changes) {
              // Split changes into lines
              const lines = changes
                .split("\n")
                .filter((line) => line.trim() !== "");

              // Process each line
              const chunkChanges = lines.map((line) => {
                const prefix = line.charAt(0);
                let type = "context";
                if (prefix === "+") type = "addition";
                if (prefix === "-") type = "deletion";

                return {
                  type,
                  content: line,
                };
              });

              lineChanges.push({
                lineInfo,
                changes: chunkChanges,
              });
            }
          }
        }

        return {
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch || null,
          blob_url: file.blob_url,
          raw_url: file.raw_url,
          lineChanges: lineChanges.length > 0 ? lineChanges : null,
        };
      });

      return {
        success: true,
        data: {
          files: fileDetails,
          stats: {
            total_files: files.length,
            total_additions: totalAdditions,
            total_deletions: totalDeletions,
            total_changes: totalChanges,
          },
        },
      };
    } catch (error) {
      logger.error(`Error getting changed files for PR #${number}:`, error);
      throw new Error(`Failed to get changed files: ${error.message}`);
    }
  }

  /**
   * Perform a detailed code review on a pull request
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} Code review results
   */
  async reviewCode(params) {
    const { owner = this.repoOwner, repo = this.repoName, number } = params;

    if (!owner || !repo) {
      throw new Error("Repository owner and name are required");
    }

    if (!number) {
      throw new Error("Pull request number is required");
    }

    try {
      // Get PR details
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: number,
      });

      // Get changed files with patches
      const fileChanges = await this.getChangedFiles({ owner, repo, number });

      // Get PR review comments (line-specific comments)
      const { data: reviewComments } =
        await this.octokit.pulls.listReviewComments({
          owner,
          repo,
          pull_number: number,
        });

      // Get commit data
      const { data: commits } = await this.octokit.pulls.listCommits({
        owner,
        repo,
        pull_number: number,
      });

      // Group files by type for better analysis
      const filesByExtension = {};
      fileChanges.data.files.forEach((file) => {
        const extension = file.filename.split(".").pop() || "unknown";
        if (!filesByExtension[extension]) {
          filesByExtension[extension] = [];
        }
        filesByExtension[extension].push(file);
      });

      // Categorize changes (e.g., new files, modified, deleted)
      const categorizedFiles = {
        added: fileChanges.data.files.filter((f) => f.status === "added"),
        modified: fileChanges.data.files.filter((f) => f.status === "modified"),
        removed: fileChanges.data.files.filter((f) => f.status === "removed"),
        renamed: fileChanges.data.files.filter((f) => f.status === "renamed"),
      };

      // Structure the review data
      const review = {
        pull_request: {
          number: pr.number,
          title: pr.title,
          author: pr.user.login,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          status: pr.state,
          base_ref: pr.base.ref,
          head_ref: pr.head.ref,
        },
        stats: {
          ...fileChanges.data.stats,
          commit_count: commits.length,
        },
        changes_by_type: {
          ...Object.keys(filesByExtension).reduce((acc, ext) => {
            acc[ext] = {
              count: filesByExtension[ext].length,
              files: filesByExtension[ext].map((f) => f.filename),
            };
            return acc;
          }, {}),
        },
        categorized_files: {
          added: categorizedFiles.added.map((f) => ({
            filename: f.filename,
            changes: f.changes,
          })),
          modified: categorizedFiles.modified.map((f) => ({
            filename: f.filename,
            changes: f.changes,
          })),
          removed: categorizedFiles.removed.map((f) => ({
            filename: f.filename,
          })),
          renamed: categorizedFiles.renamed.map((f) => ({
            filename: f.filename,
          })),
        },
        file_details: fileChanges.data.files.map((file) => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          has_detailed_changes:
            file.lineChanges !== null && file.lineChanges.length > 0,
        })),
        review_comments: reviewComments.map((comment) => ({
          id: comment.id,
          path: comment.path,
          position: comment.position,
          body: comment.body,
          author: comment.user.login,
          created_at: comment.created_at,
        })),
        commits: commits.map((commit) => ({
          sha: commit.sha.substring(0, 7),
          message: commit.commit.message,
          author: commit.author
            ? commit.author.login
            : commit.commit.author.name,
          date: commit.commit.author.date,
        })),
      };

      return {
        success: true,
        data: review,
      };
    } catch (error) {
      logger.error(`Error performing code review for PR #${number}:`, error);
      throw new Error(`Failed to review code: ${error.message}`);
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
        body,
      });

      return {
        success: true,
        data: {
          id: comment.data.id,
          body: comment.data.body,
          url: comment.data.html_url,
        },
      };
    } catch (error) {
      this.logger.error(`Error creating comment on #${number}`, error);
      throw new Error(`Failed to create comment: ${error.message}`);
    }
  }

  /**
   * Merge a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - Pull request number
   * @param {string} commitMessage - Optional custom commit message for the merge
   * @param {string} mergeMethod - Merge method (merge, squash, rebase) - defaults to merge
   * @returns {Promise<Object>} Merge result
   */
  /**
   * Merge a pull request
   * @param {Object} params - Parameters for the action
   * @returns {Promise<Object>} Merge result
   */
  async mergePullRequest(params) {
    const {
      owner = this.repoOwner,
      repo = this.repoName,
      number,
      commit_message,
      merge_method = "merge",
      commit_title,
    } = params;

    if (!owner || !repo) {
      throw new Error("Repository owner and name are required");
    }

    if (!number) {
      throw new Error("Pull request number is required");
    }

    try {
      // First check if PR is mergeable
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: number,
      });

      if (pr.merged) {
        return {
          success: false,
          data: {
            message: `Pull request #${number} has already been merged`,
          },
        };
      }

      if (pr.mergeable === false) {
        return {
          success: false,
          data: {
            message: `Pull request #${number} has conflicts that must be resolved before merging`,
          },
        };
      }

      // Prepare merge parameters
      const mergeParams = {
        owner,
        repo,
        pull_number: number,
        merge_method,
      };

      if (commit_message) {
        mergeParams.commit_message = commit_message;
      }

      if (commit_title) {
        mergeParams.commit_title = commit_title;
      }

      // Perform the merge
      const { data: result } = await this.octokit.pulls.merge(mergeParams);

      return {
        success: true,
        data: {
          message: `Pull request #${number} merged successfully`,
          merged: result.merged,
          sha: result.sha,
        },
      };
    } catch (error) {
      this.logger.error(`Error merging PR #${number}:`, error);
      throw new Error(`Failed to merge PR #${number}: ${error.message}`);
    }
  }

  /**
   * Decline (close) a pull request without merging
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - Pull request number
   * @param {string} reason - Reason for declining the pull request
   * @returns {Promise<Object>} Decline result
   */
  async declinePullRequest(params) {
    const {
      owner = this.repoOwner,
      repo = this.repoName,
      number,
      reason,
    } = params;

    if (!owner || !repo) {
      throw new Error("Repository owner and name are required");
    }

    if (!number) {
      throw new Error("Pull request number is required");
    }

    try {
      // First check if PR is already closed
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: number,
      });

      if (pr.state !== "open") {
        return {
          success: false,
          data: {
            message: `Pull request #${number} is already ${pr.state}`,
          },
        };
      }

      // Add a comment with reason if provided
      if (reason) {
        await this.octokit.issues.createComment({
          owner,
          repo,
          issue_number: number,
          body: `Declining this pull request: ${reason}`,
        });
      }

      // Close the pull request
      const { data: result } = await this.octokit.pulls.update({
        owner,
        repo,
        pull_number: number,
        state: "closed",
      });

      return {
        success: true,
        data: {
          message: `Pull request #${number} declined successfully`,
          state: result.state,
        },
      };
    } catch (error) {
      logger.error(`Error declining PR #${number}:`, error);
      throw new Error(`Failed to decline PR #${number}: ${error.message}`);
    }
  }
}

module.exports = GitHubTool;
