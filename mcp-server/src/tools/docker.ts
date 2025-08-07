import { CallToolRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { docker, getDockerStats, findContainersByFilter, performContainerAction } from "../utils/index.js";
import {
  containerNamesMap,
  ContainerName,
  dockerStartSchema,
  dockerStopSchema,
  dockerRestartSchema,
  dockerStatusSchema,
  dockerShutdownSchema,
  dockerDiscoverSchema,
  dockerManageSchema,
  ContainerInfo,
} from "../types/index.js";

// Container dependency mapping based on docker-compose.yml
const CONTAINER_DEPENDENCIES: Record<string, string[]> = {
  // Infrastructure containers (no dependencies)
  'db': [],
  'redis': [],
  'rabbitmq': [],
  'minio': [],
  
  // MinIO initialization depends on MinIO
  'minio_init': ['minio'],
  
  // Application containers depend on infrastructure
  'backend': ['db', 'redis', 'rabbitmq', 'minio_init'],
  'frontend': [], // Frontend doesn't have strict dependencies on other containers
  'lcfs-mcp-server': ['db', 'redis'],
};

// Reverse dependency mapping (what depends on each container)
const REVERSE_DEPENDENCIES: Record<string, string[]> = {};
Object.entries(CONTAINER_DEPENDENCIES).forEach(([container, deps]) => {
  deps.forEach(dep => {
    if (!REVERSE_DEPENDENCIES[dep]) {
      REVERSE_DEPENDENCIES[dep] = [];
    }
    REVERSE_DEPENDENCIES[dep].push(container);
  });
});

// Volume usage mapping for containers
const CONTAINER_VOLUMES: Record<string, string[]> = {
  'db': ['lcfs_postgres_data'],
  'redis': ['lcfs_redis_data'],
  'minio': ['lcfs_s3_data'],
  'frontend': ['lcfs_node_data'],
  // Other containers don't use persistent volumes or use bind mounts only
};

export const dockerTools: Tool[] = [
  {
    name: "docker-start",
    description: "Start one or more Docker containers",
    inputSchema: {
      type: "object",
      properties: {
        containers: {
          type: "array",
          items: {
            type: "string",
            enum: ["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server", "all"],
          },
          description: "Container names to start, or 'all' for all containers",
        },
        single: {
          type: "string",
          enum: ["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server"],
          description: "Single container to start (alternative to containers array)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "docker-stop",
    description: "Stop one or more Docker containers",
    inputSchema: {
      type: "object",
      properties: {
        containers: {
          type: "array",
          items: {
            type: "string",
            enum: ["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server", "all"],
          },
          description: "Container names to stop, or 'all' for all containers",
        },
        single: {
          type: "string",
          enum: ["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server"],
          description: "Single container to stop (alternative to containers array)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "docker-restart",
    description: "Restart one or more Docker containers",
    inputSchema: {
      type: "object",
      properties: {
        containers: {
          type: "array",
          items: {
            type: "string",
            enum: ["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server", "all"],
          },
          description: "Container names to restart, or 'all' for all containers",
        },
        single: {
          type: "string",
          enum: ["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server"],
          description: "Single container to restart (alternative to containers array)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "docker-status",
    description: "Get status of Docker containers",
    inputSchema: {
      type: "object",
      properties: {
        containers: {
          type: "array",
          items: {
            type: "string",
            enum: ["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server", "all"],
          },
          description: "Container names to check, or 'all' for all containers",
        },
        single: {
          type: "string",
          enum: ["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server"],
          description: "Single container to check (alternative to containers array)",
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

// Get containers in dependency order for starting (dependencies first)
function getStartOrder(containerNames: string[]): string[] {
  const visited = new Set<string>();
  const result: string[] = [];
  
  function visit(containerName: string) {
    if (visited.has(containerName)) return;
    visited.add(containerName);
    
    // Visit dependencies first
    const deps = CONTAINER_DEPENDENCIES[containerName] || [];
    for (const dep of deps) {
      if (containerNames.includes(dep)) {
        visit(dep);
      }
    }
    
    result.push(containerName);
  }
  
  for (const containerName of containerNames) {
    visit(containerName);
  }
  
  return result;
}

// Get containers in reverse dependency order for stopping (dependents first)
function getStopOrder(containerNames: string[]): string[] {
  const visited = new Set<string>();
  const result: string[] = [];
  
  function visit(containerName: string) {
    if (visited.has(containerName)) return;
    visited.add(containerName);
    
    // Visit dependents first
    const dependents = REVERSE_DEPENDENCIES[containerName] || [];
    for (const dependent of dependents) {
      if (containerNames.includes(dependent)) {
        visit(dependent);
      }
    }
    
    result.push(containerName);
  }
  
  for (const containerName of containerNames) {
    visit(containerName);
  }
  
  return result;
}

// Get all containers that use volumes that would be affected by a database reset
function getVolumeAffectedContainers(): string[] {
  const affected: string[] = [];
  for (const [container, volumes] of Object.entries(CONTAINER_VOLUMES)) {
    // Any container using persistent volumes needs to be stopped for reset
    if (volumes.length > 0) {
      affected.push(container);
    }
  }
  return affected;
}

async function getContainersByNames(containerNames: string[]): Promise<ContainerInfo[]> {
  const allContainers = await docker.listContainers({ all: true });
  const foundContainers: ContainerInfo[] = [];

  for (const containerName of containerNames) {
    const actualName = containerNamesMap[containerName as ContainerName] || containerName;
    
    const container = allContainers.find(c => 
      c.Names.some(name => name.includes(actualName))
    );
    
    if (container) {
      foundContainers.push({
        Id: container.Id,
        Names: container.Names,
        State: container.State,
        Status: container.Status,
      });
    }
  }
  
  return foundContainers;
}

async function performDockerAction(containers: ContainerInfo[], action: 'start' | 'stop' | 'restart'): Promise<string[]> {
  const results: string[] = [];
  
  for (const container of containers) {
    try {
      const dockerContainer = docker.getContainer(container.Id);
      
      switch (action) {
        case 'start':
          await dockerContainer.start();
          break;
        case 'stop':
          await dockerContainer.stop();
          break;
        case 'restart':
          await dockerContainer.restart();
          break;
      }
      
      results.push(`✓ ${action}ed ${container.Names[0]}`);
    } catch (error: any) {
      results.push(`✗ Failed to ${action} ${container.Names[0]}: ${error.message}`);
    }
  }
  
  return results;
}

export async function handleDockerTool(name: string, args: unknown) {
  const request = CallToolRequestSchema.parse({ method: "tools/call", params: { name, arguments: args } });
  
  switch (name) {
    case "docker-start": {
      const dockerArgs = dockerStartSchema.parse(args);
      let containerNames: string[] = [];
      
      if (dockerArgs.single) {
        containerNames = [dockerArgs.single];
      } else if (dockerArgs.containers) {
        if (dockerArgs.containers.includes('all')) {
          containerNames = Object.keys(containerNamesMap).filter(name => name !== 'lcfs-mcp-server');
        } else {
          containerNames = dockerArgs.containers;
        }
      } else {
        containerNames = Object.keys(containerNamesMap).filter(name => name !== 'lcfs-mcp-server');
      }

      const containers = await getContainersByNames(containerNames);
      const results = await performDockerAction(containers, 'start');
      
      return {
        content: [{ type: "text" as const, text: results.join('\n') }],
      };
    }

    case "docker-stop": {
      const dockerArgs = dockerStopSchema.parse(args);
      let containerNames: string[] = [];
      
      if (dockerArgs.single) {
        containerNames = [dockerArgs.single];
      } else if (dockerArgs.containers) {
        if (dockerArgs.containers.includes('all')) {
          containerNames = Object.keys(containerNamesMap).filter(name => name !== 'lcfs-mcp-server');
        } else {
          containerNames = dockerArgs.containers;
        }
      } else {
        containerNames = Object.keys(containerNamesMap).filter(name => name !== 'lcfs-mcp-server');
      }

      const containers = await getContainersByNames(containerNames);
      const results = await performDockerAction(containers, 'stop');
      
      return {
        content: [{ type: "text" as const, text: results.join('\n') }],
      };
    }

    case "docker-restart": {
      const dockerArgs = dockerRestartSchema.parse(args);
      let containerNames: string[] = [];
      
      if (dockerArgs.single) {
        containerNames = [dockerArgs.single];
      } else if (dockerArgs.containers) {
        if (dockerArgs.containers.includes('all')) {
          containerNames = Object.keys(containerNamesMap).filter(name => name !== 'lcfs-mcp-server');
        } else {
          containerNames = dockerArgs.containers;
        }
      } else {
        containerNames = Object.keys(containerNamesMap).filter(name => name !== 'lcfs-mcp-server');
      }

      const containers = await getContainersByNames(containerNames);
      const results = await performDockerAction(containers, 'restart');
      
      return {
        content: [{ type: "text" as const, text: results.join('\n') }],
      };
    }

    case "docker-status": {
      const dockerArgs = dockerStatusSchema.parse(args);
      let containerNames: string[] = [];
      
      if (dockerArgs.single) {
        containerNames = [dockerArgs.single];
      } else if (dockerArgs.containers) {
        if (dockerArgs.containers.includes('all')) {
          containerNames = Object.keys(containerNamesMap);
        } else {
          containerNames = dockerArgs.containers;
        }
      } else {
        containerNames = Object.keys(containerNamesMap);
      }

      const containers = await getContainersByNames(containerNames);
      const status = containers.map(c => `${c.Names[0]}: ${c.State} (${c.Status})`);
      
      return {
        content: [{ type: "text" as const, text: status.join('\n') }],
      };
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