import { CallToolRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { execAsync } from "../utils/index.js";
import { echoSchema } from "../types/index.js";

export const systemTools: Tool[] = [
  {
    name: "health",
    description: "Check if the MCP server is running properly",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "echo",
    description: "Echo back the provided message",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Message to echo back",
        },
      },
      required: ["message"],
      additionalProperties: false,
    },
  },
  {
    name: "environment-info",
    description: "Get current environment and system information",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "database-status",
    description: "Check database connection status (read-only)",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

export async function handleSystemTool(name: string, args: unknown) {
  const request = CallToolRequestSchema.parse({ method: "tools/call", params: { name, arguments: args } });
  
  switch (name) {
    case "health":
      return {
        content: [
          {
            type: "text" as const,
            text: "MCP Server is running and healthy ✅",
          },
        ],
      };

    case "echo":
      const echoArgs = echoSchema.parse(args);
      return {
        content: [
          {
            type: "text" as const,
            text: `Echo: ${echoArgs.message}`,
          },
        ],
      };

    case "environment-info":
      const envInfo = {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd(),
        appEnvironment: process.env.APP_ENVIRONMENT || 'not set',
        dockerHost: process.env.DOCKER_HOST || 'default',
        timestamp: new Date().toISOString(),
      };
      
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(envInfo, null, 2),
          },
        ],
      };

    case "database-status":
      try {
        const result = await execAsync("docker exec db pg_isready -U lcfs -d lcfs", { timeout: 10000 });
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Database Status: ✅ Connected\n${result.stdout.trim()}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Database Status: ❌ Connection failed\nError: ${error.message}`,
            },
          ],
        };
      }

    default:
      throw new Error(`Unknown system tool: ${name}`);
  }
}