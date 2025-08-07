import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export interface ContainerInfo {
  Id: string;
  Names: string[];
  State: string;
  Status: string;
}

export interface DockerStats {
  running: ContainerInfo[];
  stopped: ContainerInfo[];
  all: ContainerInfo[];
}

export const containerNamesMap = {
  db: "db",
  redis: "redis",
  rabbitmq: "rabbitmq",
  minio: "minio",
  minio_init: "minio_init",
  backend: "backend",
  frontend: "frontend",
  "lcfs-mcp-server": "lcfs-mcp-server",
} as const;

export type ContainerName = keyof typeof containerNamesMap;

export const dockerStartSchema = z.object({
  containers: z.array(z.enum(["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server", "all"])).optional(),
  single: z.enum(["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server"]).optional(),
});

export const dockerStopSchema = z.object({
  containers: z.array(z.enum(["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server", "all"])).optional(),
  single: z.enum(["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server"]).optional(),
});

export const dockerRestartSchema = z.object({
  containers: z.array(z.enum(["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server", "all"])).optional(),
  single: z.enum(["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server"]).optional(),
});

export const dockerStatusSchema = z.object({
  containers: z.array(z.enum(["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server", "all"])).optional(),
  single: z.enum(["db", "redis", "rabbitmq", "minio", "minio_init", "backend", "frontend", "lcfs-mcp-server"]).optional(),
});

export const dockerShutdownSchema = z.object({
  confirm: z.boolean(),
});

export const dockerDiscoverSchema = z.object({
  filter: z.string().optional(),
  status: z.enum(["all", "running", "stopped"]).optional(),
});

export const dockerManageSchema = z.object({
  action: z.enum(["start", "stop", "restart"]),
  containers: z.array(z.string()).optional(),
  filter: z.string().optional(),
  confirm: z.boolean().optional(),
});

export const databaseResetSchema = z.object({
  confirm: z.boolean(),
});

export const migrationCreateSchema = z.object({
  message: z.string(),
});

export const migrationUpgradeSchema = z.object({
  revision: z.string().optional(),
});

export const migrationDowngradeSchema = z.object({
  revision: z.string().optional(),
});

export const migrationDeleteSchema = z.object({
  identifier: z.string(),
  confirm: z.boolean(),
});

export const frontendTestSchema = z.object({
  pattern: z.string().optional(),
  timeout: z.number().optional(),
  watch: z.boolean().optional(),
  coverage: z.boolean().optional(),
});

export const backendTestSchema = z.object({
  pattern: z.string().optional(),
  timeout: z.number().optional(),
  verbose: z.boolean().optional(),
  coverage: z.boolean().optional(),
});

export const echoSchema = z.object({
  message: z.string(),
});

export const githubIssueSchema = z.object({
  issue_number: z.number().positive(),
});

export const dataTransferSchema = z.object({
  application: z.enum(["lcfs"]),
  environment: z.enum(["dev", "test", "prod"]),
  direction: z.enum(["import"]), // Only import allowed (read-only)
  localContainer: z.string(),
  table: z.string().optional(),
  dryRun: z.boolean().optional(),
});

export type CallToolRequest = z.infer<typeof CallToolRequestSchema>;