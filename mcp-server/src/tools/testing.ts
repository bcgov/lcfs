import { CallToolRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { execAsync, parseViTestFailures, parsePytestFailures } from "../utils/index.js";
import { frontendTestSchema, backendTestSchema } from "../types/index.js";

export const testingTools: Tool[] = [
  {
    name: "frontend-test",
    description: "Run frontend tests and return only failed tests with their reasons",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Test file pattern to run (optional, runs all tests by default)",
        },
        timeout: {
          type: "number",
          description: "Test timeout in milliseconds (default: 30000)",
        },
        watch: {
          type: "boolean",
          description: "Run in watch mode (default: false)",
        },
        coverage: {
          type: "boolean",
          description: "Include coverage report (default: false)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "backend-test",
    description: "Run backend Python tests and return only failed tests with their reasons",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Test file or pattern to run (optional, runs all tests by default)",
        },
        timeout: {
          type: "number",
          description: "Test timeout in seconds (default: 300)",
        },
        verbose: {
          type: "boolean",
          description: "Run in verbose mode (default: false)",
        },
        coverage: {
          type: "boolean",
          description: "Include coverage report (default: false)",
        },
      },
      additionalProperties: false,
    },
  },
];

export async function handleTestingTool(name: string, args: unknown) {
  const request = CallToolRequestSchema.parse({ method: "tools/call", params: { name, arguments: args } });
  
  switch (name) {
    case "frontend-test": {
      const testArgs = frontendTestSchema.parse(args);
      
      let command = 'docker exec frontend npm run';
      
      if (testArgs.watch) {
        command += ' test';
      } else {
        command += ' test:run';
      }
      
      if (testArgs.pattern) {
        command += ` ${testArgs.pattern}`;
      }
      
      if (testArgs.coverage) {
        command += ' --coverage';
      }
      
      const timeout = testArgs.timeout || 30000;
      const maxBuffer = 50 * 1024 * 1024;
      
      try {
        let stdout = '';
        let stderr = '';
        
        try {
          const result = await execAsync(command, { timeout, maxBuffer });
          stdout = result.stdout;
          stderr = result.stderr;
        } catch (error: any) {
          if (error.stdout || error.stderr) {
            stdout = error.stdout || '';
            stderr = error.stderr || '';
          } else {
            throw error;
          }
        }
        
        const output = stdout + stderr;
        const failureReport = parseViTestFailures(output);
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Frontend Test Results:\n\n${failureReport}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `❌ Frontend test execution failed: ${error.message}`,
            },
          ],
        };
      }
    }

    case "backend-test": {
      const testArgs = backendTestSchema.parse(args);
      
      let command = 'docker exec backend poetry run pytest';
      
      if (testArgs.pattern) {
        command += ` ${testArgs.pattern}`;
      }
      
      if (testArgs.verbose) {
        command += ' -v';
      }
      
      if (testArgs.coverage) {
        command += ' --cov=lcfs';
      }
      
      const timeout = (testArgs.timeout || 300) * 1000;
      const maxBuffer = 50 * 1024 * 1024;
      
      try {
        let stdout = '';
        let stderr = '';
        
        try {
          const result = await execAsync(command, { timeout, maxBuffer });
          stdout = result.stdout;
          stderr = result.stderr;
        } catch (error: any) {
          if (error.stdout || error.stderr) {
            stdout = error.stdout || '';
            stderr = error.stderr || '';
          } else {
            throw error;
          }
        }
        
        const output = stdout + stderr;
        const failureReport = parsePytestFailures(output);
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Backend Test Results:\n\n${failureReport}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `❌ Backend test execution failed: ${error.message}`,
            },
          ],
        };
      }
    }

    default:
      throw new Error(`Unknown testing tool: ${name}`);
  }
}