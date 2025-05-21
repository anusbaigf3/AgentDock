# AgentDock: Multi-Agent MCP Server with UI & Tool Integrations

AgentDock is a Model Context Protocol (MCP) server with a clean UI to register, manage, and interact with intelligent agents. It enables multi-agent orchestration, tool integrations (e.g., GitHub, Slack, Jira), and LLM-powered interactions via Groq.

## 🚀 Features

- **Agent Management**: Register/deregister agents with code, description, and configuration
- **Natural Language Interface**: Ask agents questions using Groq (e.g., "Summarize latest PR")
- **Tool Integrations**: Connect with APIs like GitHub, Slack, Jira, Shopify, and more
- **Monitoring & Logs**: View recent agent actions and outputs
- **Multi-Agent Support**: Create specialized agents for different tasks
- **REST API Tool Registration**: Easily register new tools via REST API
- **Modular & Extensible Architecture**: Add new capabilities with minimal changes
- **Dockerized Deployment**: Quick and easy setup with Docker Compose

## 📋 Requirements

- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) v16+ (for local development only)
- A Groq API key (for LLM capabilities)
- API keys for any tools you want to integrate (GitHub, Slack, etc.)

## 🛠️ Installation

### Using Docker (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/anusbaigf3/AgentDock
   cd AgentDock
   ```

2. Create a `.env` file in the root directory with your configuration:
   ```
   # MongoDB
   MONGO_INITDB_ROOT_USERNAME=admin
   MONGO_INITDB_ROOT_PASSWORD=your_secure_password

   # JWT
   JWT_SECRET=your_secure_jwt_secret
   JWT_EXPIRE=30d

   # LLM
   GROQ_API_KEY=your_groq_api_key

   # Tool API Keys (optional)
   GITHUB_API_TOKEN=your_github_token
   SLACK_BOT_TOKEN=your_slack_bot_token
   SLACK_SIGNING_SECRET=your_slack_signing_secret
   JIRA_HOST=your-jira-instance.atlassian.net
   JIRA_USERNAME=your_jira_email
   JIRA_API_TOKEN=your_jira_api_token
   SHOPIFY_SHOP_NAME=your-shop.myshopify.com
   SHOPIFY_API_KEY=your_shopify_api_key
   SHOPIFY_PASSWORD=your_shopify_password
   SPEECH_API_KEY=your_speech_to_text_api_key
   ```

3. Build and start the containers:
   ```bash
   docker-compose up -d
   ```

4. Access the UI at [http://localhost](http://localhost)

### Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/anusbaigf3/AgentDock
   cd AgentDock
   ```

2. Set up the backend:
   ```bash
   cd agentdock-backend
   cp .env.example .env  # Edit this file with your configuration
   npm install
   npm run dev
   ```

3. Set up the frontend:
   ```bash
   cd agentdock-frontend
   cp .env.example .env  # Edit this file with your configuration
   npm install
   npm start
   ```

4. Access the frontend at [http://localhost:3000](http://localhost:3000) and the backend at [http://localhost:3001](http://localhost:3001)

## 📚 Project Structure

```
agentdock/
├── agentdock-backend/     # Backend MCP server
│   ├── src/              # Source code
│   │   ├── config/       # Configuration files
│   │   ├── controllers/  # API controllers
│   │   ├── middleware/   # Express middleware
│   │   ├── models/       # MongoDB models
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   ├── utils/        # Utilities
│   │   └── mcp/          # MCP implementation
│   │       ├── server.js # MCP server
│   │       ├── agents/   # Agent implementations
│   │       └── tools/    # Tool implementations
│   ├── Dockerfile        # Backend Docker configuration
│   └── package.json      # Dependencies
├── agentdock-frontend/    # Frontend UI
│   ├── src/              # Source code
│   │   ├── assets/       # Static assets
│   │   ├── components/   # React components
│   │   ├── context/      # Context providers
│   │   ├── pages/        # Page components
│   │   └── utils/        # Utilities
│   ├── Dockerfile        # Frontend Docker configuration
│   └── package.json      # Dependencies
├── docker-compose.yml    # Docker compose configuration
└── README.md             # Project documentation
```

## 🔧 Usage

### Creating an Agent

1. Log in to the AgentDock UI
2. Navigate to "Agents" and click "Create Agent"
3. Fill in the agent details:
   - Name: A descriptive name for your agent
   - Description: What the agent does
   - Type: Choose from predefined types or custom
   - Code: Implement your agent logic in JavaScript
   - Configuration: JSON configuration for your agent

### Registering a Tool

1. Navigate to "Tools" and click "Register Tool"
2. Fill in the tool details:
   - Name: A descriptive name for your tool
   - Description: What the tool does
   - Type: Choose from predefined types or custom
   - Endpoint: The API endpoint for your tool
   - Authentication: Configure how to authenticate with the API
   - Parameters: Define the parameters your tool accepts

### Using the Agent Console

1. Navigate to "Agents" and click on an agent
2. Click "Chat" to open the agent console
3. Type your query and the agent will respond
4. The agent can use registered tools to fulfill your requests

## 📖 Architecture Overview

AgentDock implements the Model Context Protocol (MCP) to enable seamless interactions between different agents and tools. The system is built on a modular architecture that allows easy extension with new capabilities.

### MCP Server

The MCP server is the core of AgentDock, handling the orchestration of agents and tools. It:

1. Manages agent lifecycles (registration, execution, deregistration)
2. Routes queries to appropriate agents
3. Facilitates tool discovery and execution
4. Logs all interactions and operations

### Agents

Agents in AgentDock are intelligent entities that can:

1. Process natural language queries
2. Utilize available tools to accomplish tasks
3. Generate coherent responses
4. Maintain context throughout conversations

Predefined agent types include:

- **GitHub Agents**: Interact with GitHub repositories
- **Slack Agents**: Manage Slack communications
- **Jira Agents**: Handle Jira ticket operations
- **Shopify Agents**: Manage Shopify inventory and orders
- **Custom Agents**: Implement specialized functionalities

### Tools

Tools are reusable components that agents can leverage to perform specific tasks:

1. GitHub Tool: PR summaries, repo sync, CI/CD triggers
2. Jira Tool: List, update, or create tickets
3. Slack Tool: Send messages, channel updates
4. Shopify Tool: Inventory updates via natural language
5. Speech Tool: Transcribe commands into actions

### LLM Integration

AgentDock integrates with Groq's large language models to:

1. Understand natural language queries
2. Generate coherent responses
3. Extract structured information from unstructured text
4. Facilitate reasoning and decision-making

## 🔄 API Reference

### Agent Endpoints

- `GET /api/agents` - List all agents
- `GET /api/agents/:id` - Get agent details
- `POST /api/agents` - Create a new agent
- `PUT /api/agents/:id` - Update an agent
- `DELETE /api/agents/:id` - Delete an agent
- `POST /api/agents/:id/register` - Register (activate) an agent
- `POST /api/agents/:id/deregister` - Deregister (deactivate) an agent
- `POST /api/agents/:id/query` - Process a query with an agent

### Tool Endpoints

- `GET /api/tools` - List all tools
- `GET /api/tools/:id` - Get tool details
- `POST /api/tools` - Register a new tool
- `PUT /api/tools/:id` - Update a tool
- `DELETE /api/tools/:id` - Delete a tool
- `POST /api/tools/:id/register` - Register (activate) a tool
- `POST /api/tools/:id/deregister` - Deregister (deactivate) a tool
- `POST /api/tools/:id/execute` - Execute a tool action

### Log Endpoints

- `GET /api/logs` - List all logs
- `GET /api/logs/:id` - Get log details
- `GET /api/logs/agent/:agentId` - Get logs for a specific agent
- `GET /api/logs/tool/:toolId` - Get logs for a specific tool
- `DELETE /api/logs/:id` - Delete a log (admin only)
- `DELETE /api/logs` - Clear all logs (admin only)

### Authentication Endpoints

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/updatedetails` - Update user details
- `PUT /api/auth/updatepassword` - Update user password

## 🛡️ Security Considerations

AgentDock implements several security measures:

1. **JWT Authentication**: All API endpoints are protected with JWT tokens
2. **HTTPS Support**: Production deployments should use HTTPS
3. **Input Validation**: All user inputs are validated before processing
4. **Environment Variables**: Sensitive information is stored in environment variables
5. **Role-Based Access Control**: Different user roles have different permissions

## 🚀 Advanced Features

### Agent Chaining

Agents can collaborate to solve complex tasks:

```javascript
// Example of agent chaining
const githubAgent = await mcpServer.getAgent('github-agent');
const slackAgent = await mcpServer.getAgent('slack-agent');

// GitHub agent summarizes PR
const prSummary = await githubAgent.processQuery(`Summarize PR #123`);

// Slack agent shares the summary
await slackAgent.processQuery(`Share this summary in the #dev channel: ${prSummary}`);
```

### Speech-to-Text Integration

Enable voice commands for your agents:

```javascript
// Example of speech-to-text integration
const speechTool = mcpServer.getTool('speech-tool');
const githubAgent = await mcpServer.getAgent('github-agent');

// Transcribe audio
const transcription = await speechTool.execute('transcribe', { audioData });

// Process the transcription with an agent
const response = await githubAgent.processQuery(transcription);
```

### Custom Tool Creation

Create your own tools to extend the system's capabilities:

```javascript
// Example of custom tool creation
class WeatherTool extends BaseTool {
  constructor(name, config) {
    super(name, config);
  }

  getAvailableActions() {
    return [
      {
        name: 'getCurrentWeather',
        description: 'Get current weather for a location',
        parameters: {
          location: {
            type: 'string',
            description: 'City name or coordinates',
            required: true
          }
        }
      }
    ];
  }

  async getCurrentWeather(params) {
    // Implementation
  }
}
```

## Agent Executions
# Slack
1. Create Channel
![Slack Create Channel Action](https://github.com/user-attachments/assets/f434b6f9-44b4-4b28-9327-b37e9c5e0e38)

2. Find User
![Slack Find User](https://github.com/user-attachments/assets/b07420a4-ca62-40ec-9ffb-22a790ff582e)

3. Send Message to User
![Slack send message](https://github.com/user-attachments/assets/6060c888-17f1-4751-ae2a-0b53f3e59354)
![Slack message screen](https://github.com/user-attachments/assets/aaaa42ae-c8c0-4c11-932e-b99c21cffd76)

# Github
1. Merge Pull Request
![Github PR Merge](https://github.com/user-attachments/assets/d8e99a8d-fbc5-4991-895c-b285f28cd921)
![Screenshot 2025-05-12 121717](https://github.com/user-attachments/assets/b94836ab-4a37-449b-bce1-bb29074bf20c)

2. Decline Pull Request
![PR Declined Action](https://github.com/user-attachments/assets/e6feeb1e-effe-4511-b6ff-af03707440c1)
![Screenshot 2025-05-12 121757](https://github.com/user-attachments/assets/54b19b3e-3a93-46b8-8f80-693818d0cfa9)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📧 Contact

For questions or support, please open an issue on the GitHub repository or contact the maintainers.

## 🙏 Acknowledgements

- [Groq](https://groq.com/) for providing the LLM API
- [Model Context Protocol](https://github.com/microsoft/model-context-protocol/blob/main/spec/protocol.md) for the MCP specification
- All the open-source libraries and tools that made this project possible
