import { CallToolRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { 
  docker, 
  getDockerStats, 
  findContainersByFilter, 
  performContainerAction,
  discoverLcfsContainers,
  findContainersByNames,
} from "../utils/index.js";
import {
  dockerStartSchema,
  dockerStopSchema,
  dockerRestartSchema,
  dockerStatusSchema,
  dockerShutdownSchema,
  dockerDiscoverSchema,
  dockerManageSchema,
  ContainerInfo,
} from "../types/index.js";


export const dockerTools: Tool[] = [
  {
    name: "docker-start",
    description: "Start one or more LCFS Docker containers",
    inputSchema: {
      type: "object",
      properties: {
        containers: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Container names to start (e.g., ['db', 'redis', 'backend'])",
        },
        single: {
          type: "string",
          description: "Single container to start (e.g., 'db', 'backend')",
        },
        all: {
          type: "boolean",
          description: "Start all LCFS containers (excludes lcfs-mcp-server)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "docker-stop",
    description: "Stop one or more LCFS Docker containers",
    inputSchema: {
      type: "object",
      properties: {
        containers: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Container names to stop (e.g., ['db', 'redis', 'backend'])",
        },
        single: {
          type: "string",
          description: "Single container to stop (e.g., 'db', 'backend')",
        },
        all: {
          type: "boolean",
          description: "Stop all LCFS containers (excludes lcfs-mcp-server)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "docker-restart",
    description: "Restart one or more LCFS Docker containers",
    inputSchema: {
      type: "object",
      properties: {
        containers: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Container names to restart (e.g., ['db', 'redis', 'backend'])",
        },
        single: {
          type: "string",
          description: "Single container to restart (e.g., 'db', 'backend')",
        },
        all: {
          type: "boolean",
          description: "Restart all LCFS containers (excludes lcfs-mcp-server)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "docker-status",
    description: "Get status of LCFS Docker containers",
    inputSchema: {
      type: "object",
      properties: {
        containers: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Container names to check (e.g., ['db', 'redis', 'backend'])",
        },
        single: {
          type: "string",
          description: "Single container to check (e.g., 'db', 'backend')",
        },
        all: {
          type: "boolean",
          description: "Check all LCFS containers (includes lcfs-mcp-server)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "docker-shutdown",
    description: "Gracefully shut down the MCP server container (exits the process)",
    inputSchema: {
      type: "object",
      properties: {
        confirm: {
          type: "boolean",
          description: "Must be true to confirm shutdown",
        },
      },
      required: ["confirm"],
      additionalProperties: false,
    },
  },
  {
    name: "docker-discover",
    description: "Discover running and stopped containers with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description: "Filter containers by name pattern (e.g., 'lcfs', 'supabase')",
        },
        status: {
          type: "string",
          enum: ["all", "running", "stopped"],
          description: "Filter by container status (default: all)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "docker-manage",
    description: "Start, stop, or restart containers by name or filter pattern",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["start", "stop", "restart"],
          description: "Action to perform",
        },
        containers: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Specific container names to manage",
        },
        filter: {
          type: "string",
          description: "Filter pattern to match container names (e.g., 'lcfs')",
        },
        confirm: {
          type: "boolean",
          description: "Required for stop/restart operations with filters",
        },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
];

async function getTargetContainers(args: { containers?: string[], single?: string, all?: boolean }): Promise<ContainerInfo[]> {
  if (args.all) {
    // Get all LCFS containers except MCP server
    const allLcfsContainers = await discoverLcfsContainers();
    return allLcfsContainers.filter(container => 
      !container.Names.some(name => name.includes('lcfs-mcp-server'))
    );
  }
  
  if (args.single) {
    const allLcfsContainers = await discoverLcfsContainers();
    return findContainersByNames(allLcfsContainers, [args.single]);
  }
  
  if (args.containers && args.containers.length > 0) {
    const allLcfsContainers = await discoverLcfsContainers();
    return findContainersByNames(allLcfsContainers, args.containers);
  }
  
  // Default: return all LCFS containers except MCP server
  const allLcfsContainers = await discoverLcfsContainers();
  return allLcfsContainers.filter(container => 
    !container.Names.some(name => name.includes('lcfs-mcp-server'))
  );
}

async function getStatusContainers(args: { containers?: string[], single?: string, all?: boolean }): Promise<ContainerInfo[]> {
  if (args.all) {
    // Get all LCFS containers including MCP server
    return await discoverLcfsContainers();
  }
  
  if (args.single) {
    const allLcfsContainers = await discoverLcfsContainers();
    return findContainersByNames(allLcfsContainers, [args.single]);
  }
  
  if (args.containers && args.containers.length > 0) {
    const allLcfsContainers = await discoverLcfsContainers();
    return findContainersByNames(allLcfsContainers, args.containers);
  }
  
  // Default: return all LCFS containers including MCP server
  return await discoverLcfsContainers();
}

export async function handleDockerTool(name: string, args: unknown) {
  const request = CallToolRequestSchema.parse({ method: "tools/call", params: { name, arguments: args } });
  
  switch (name) {
    case "docker-start": {
      const dockerArgs = dockerStartSchema.parse(args);
      
      try {
        const containers = await getTargetContainers(dockerArgs);
        
        if (containers.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No LCFS containers found matching the criteria" }],
          };
        }
        
        const results = await performContainerAction(containers, 'start');
        
        return {
          content: [{ type: "text" as const, text: results.join('\n') }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error discovering containers: ${error.message}` }],
        };
      }
    }

    case "docker-stop": {
      const dockerArgs = dockerStopSchema.parse(args);
      
      try {
        const containers = await getTargetContainers(dockerArgs);
        
        if (containers.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No LCFS containers found matching the criteria" }],
          };
        }
        
        const results = await performContainerAction(containers, 'stop');
        
        return {
          content: [{ type: "text" as const, text: results.join('\n') }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error discovering containers: ${error.message}` }],
        };
      }
    }

    case "docker-restart": {
      const dockerArgs = dockerRestartSchema.parse(args);
      
      try {
        const containers = await getTargetContainers(dockerArgs);
        
        if (containers.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No LCFS containers found matching the criteria" }],
          };
        }
        
        const results = await performContainerAction(containers, 'restart');
        
        return {
          content: [{ type: "text" as const, text: results.join('\n') }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error discovering containers: ${error.message}` }],
        };
      }
    }

    case "docker-status": {
      const dockerArgs = dockerStatusSchema.parse(args);
      
      try {
        const containers = await getStatusContainers(dockerArgs);
        
        if (containers.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No LCFS containers found matching the criteria" }],
          };
        }
        
        const status = containers.map(c => `${c.Names[0]}: ${c.State} (${c.Status})`);
        
        return {
          content: [{ type: "text" as const, text: status.join('\n') }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error discovering containers: ${error.message}` }],
        };
      }
    }

    case "docker-shutdown": {
      const dockerArgs = dockerShutdownSchema.parse(args);
      
      if (!dockerArgs.confirm) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Shutdown cancelled. Set 'confirm: true' to shutdown the MCP server.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: "Shutting down MCP server...",
          },
        ],
      };
    }

    case "docker-discover": {
      const dockerArgs = dockerDiscoverSchema.parse(args);
      const stats = await getDockerStats();
      
      let containersToShow = stats.all;
      
      if (dockerArgs.status === 'running') {
        containersToShow = stats.running;
      } else if (dockerArgs.status === 'stopped') {
        containersToShow = stats.stopped;
      }
      
      if (dockerArgs.filter) {
        containersToShow = findContainersByFilter(containersToShow, dockerArgs.filter);
      }
      
      const output = containersToShow.map(c => 
        `${c.Names[0]} (${c.Id.substring(0, 12)}) - ${c.State} - ${c.Status}`
      );
      
      return {
        content: [
          {
            type: "text" as const,
            text: output.length > 0 ? output.join('\n') : 'No containers found matching criteria',
          },
        ],
      };
    }

    case "docker-manage": {
      const dockerArgs = dockerManageSchema.parse(args);
      const stats = await getDockerStats();
      
      let targetContainers: ContainerInfo[] = [];
      
      if (dockerArgs.containers && dockerArgs.containers.length > 0) {
        targetContainers = stats.all.filter(c => 
          dockerArgs.containers!.some(name => 
            c.Names.some(containerName => containerName.includes(name))
          )
        );
      } else if (dockerArgs.filter) {
        targetContainers = findContainersByFilter(stats.all, dockerArgs.filter);
        
        if ((dockerArgs.action === 'stop' || dockerArgs.action === 'restart') && !dockerArgs.confirm) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Found ${targetContainers.length} containers matching filter '${dockerArgs.filter}':\n${targetContainers.map(c => c.Names[0]).join('\n')}\n\nSet 'confirm: true' to proceed with ${dockerArgs.action} action.`,
              },
            ],
          };
        }
      } else {
        return {
          content: [
            {
              type: "text" as const,
              text: "Either 'containers' array or 'filter' must be provided",
            },
          ],
        };
      }
      
      if (targetContainers.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No containers found matching the specified criteria",
            },
          ],
        };
      }
      
      const results = await performContainerAction(targetContainers, dockerArgs.action);
      
      return {
        content: [
          {
            type: "text" as const,
            text: results.join('\n'),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown docker tool: ${name}`);
  }
}