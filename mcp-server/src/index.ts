#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import modular components
import { systemTools, handleSystemTool } from "./tools/system.js";
import { dockerTools, handleDockerTool } from "./tools/docker.js";
import { databaseTools, handleDatabaseTool } from "./tools/database.js";
import { testingTools, handleTestingTool } from "./tools/testing.js";

// Environment validation
const APP_ENVIRONMENT = process.env.APP_ENVIRONMENT;
if (APP_ENVIRONMENT !== 'dev') {
  console.error('LCFS MCP Server can only run in development environment (APP_ENVIRONMENT=dev)');
  process.exit(1);
}

const server = new Server(
  {
    name: "lcfs-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// Combine all tools
const allTools = [
  ...systemTools,
  ...dockerTools,
  ...databaseTools,
  ...testingTools,
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: allTools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Route to appropriate handler based on tool category
    if (systemTools.some(tool => tool.name === name)) {
      return await handleSystemTool(name, args);
    }
    
    if (dockerTools.some(tool => tool.name === name)) {
      const result = await handleDockerTool(name, args);
      
      // Special handling for shutdown
      if (name === "docker-shutdown" && args && typeof args === 'object' && 'confirm' in args && args.confirm) {
        setTimeout(() => {
          console.log("Shutting down MCP server...");
          process.exit(0);
        }, 1000);
      }
      
      return result;
    }
    
    if (databaseTools.some(tool => tool.name === name)) {
      return await handleDatabaseTool(name, args);
    }
    
    if (testingTools.some(tool => tool.name === name)) {
      return await handleTestingTool(name, args);
    }
    

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    console.error(`Error in tool ${name}:`, error);
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
});

// Resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "lcfs://info",
        mimeType: "text/plain",
        name: "LCFS System Information",
        description: "General information about the LCFS system and MCP server capabilities",
      },
      {
        uri: "lcfs://greeting",
        mimeType: "text/plain",
        name: "Welcome Message",
        description: "A friendly greeting message for new users",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case "lcfs://info":
      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: `
# LCFS (Low Carbon Fuel Standard) MCP Server

This is a Model Context Protocol server for the LCFS system, providing development and testing capabilities.

## Available Tools:
- Health check and system information
- Docker container management (start, stop, restart, status)
- Database operations (reset, migration management)
- Test execution (frontend and backend with failure-focused output)
- Dynamic container discovery and management

## Environment:
- Node.js version: ${process.version}
- Platform: ${process.platform}
- Architecture: ${process.arch}
- Working directory: ${process.cwd()}
- App environment: ${process.env.APP_ENVIRONMENT}

## Security:
- Development environment only (APP_ENVIRONMENT=dev required)
- Stdio transport (no network exposure)
- Read-only database operations
- Confirmation required for destructive operations

## Usage:
This server is designed to work with Claude Code and other MCP-compatible clients for AI-assisted development of the LCFS system.
            `.trim(),
          },
        ],
      };

    case "lcfs://greeting":
      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: "👋 Welcome to the LCFS MCP Server! I'm here to help you develop and test the Low Carbon Fuel Standard system. Use the health tool to verify I'm working correctly, or try listing available tools to see what I can do for you!",
          },
        ],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LCFS MCP server running on stdio (development environment only)");
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});