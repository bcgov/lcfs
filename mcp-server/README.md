# LCFS MCP Server

A Model Context Protocol (MCP) server for the LCFS (Low Carbon Fuel Standard) system, designed to provide development and testing capabilities for AI-assisted development workflows.

## Overview

The LCFS MCP Server is a specialized development tool that integrates with AI coding assistants like Claude Code to provide context-aware development support for the LCFS application. It exposes system information, Docker container management, database operations, and testing capabilities through the standardized MCP protocol.

## Features

### Health & System Monitoring

- Health check endpoints for server status verification
- Environment and system information reporting
- Database connection status monitoring

### Docker Container Management

- Start, stop, and restart individual or multiple containers
- Container status monitoring and discovery
- Support for development profiles and service dependencies
- Graceful shutdown capabilities

### Database Operations

- Database connection health checks (read-only)
- Migration management (create, upgrade, downgrade, status)
- Database reset workflows with safety confirmations
- Integration with existing LCFS migration scripts

### Testing Integration

- Frontend test execution with failure-focused reporting
- Backend Python test execution with detailed error output
- Coverage reporting and test pattern filtering
- Memory-optimized test configurations for CI/CD

### GitHub Integration

- Issue lookup from the LCFS repository
- Integration with GitHub API for development context

### Data Transfer (Read-Only)

- Import data from OpenShift environments for local development
- Support for dev/test/prod environment data synchronization
- Table-specific transfer capabilities

## Security & Access Control

- **Development Only**: Requires `APP_ENVIRONMENT=dev` - will not run in production
- **Stdio Transport**: Uses standard input/output, no network ports exposed
- **Read-Only Database**: Database operations are limited to safe, read-only queries
- **Confirmation Required**: Destructive operations require explicit confirmation
- **Container Isolation**: Runs in non-root Docker container with restricted permissions

## Installation & Setup

### Prerequisites

- Node.js 18.0.0 or higher
- Docker and Docker Compose
- Access to LCFS development environment

### Local Development

```bash
# Install dependencies
npm install

# Build the server
npm run build

# Run in development mode
npm run dev

# Or run the built version
npm start
```

### Docker Integration

The MCP server is integrated with the LCFS Docker Compose setup:

```bash
# Start with development profile (includes MCP server)
docker-compose --profile dev up

# Start just the MCP server
docker-compose up lcfs-mcp-server

# View logs
docker-compose logs -f lcfs-mcp-server
```

## Configuration

### Environment Variables

- `APP_ENVIRONMENT=dev` - **Required** - Restricts server to development use only
- Standard LCFS environment variables for database and service connections

### MCP Client Configuration

For Claude Code integration, add to your MCP settings:

```json
{
  "mcpServers": {
    "lcfs-mcp-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["./mcp-server"],
      "env": {
        "APP_ENVIRONMENT": "dev",
        "NODE_ENV": "development"
      }
    }
  }
}
```

## Available Tools

### System Tools

- `health` - Server health check
- `echo` - Message echo for connectivity testing
- `environment-info` - System environment details
- `database-status` - Database connection status

### Docker Tools

- `docker-start` - Start containers
- `docker-stop` - Stop containers
- `docker-restart` - Restart containers
- `docker-status` - Container status
- `docker-discover` - Find running/stopped containers
- `docker-manage` - Bulk container operations
- `docker-shutdown` - Graceful server shutdown

### Database Tools

- `database-reset` - Reset database with confirmation
- `db-reset` - Complete database reset workflow
- `migration-create` - Generate new migrations
- `migration-upgrade` - Apply migrations
- `migration-downgrade` - Rollback migrations
- `migration-status` - Migration history
- `migration-delete` - Remove migration files
- `data-transfer` - Import data from environments

### Testing Tools

- `frontend-test` - Run frontend tests with failure reporting
- `backend-test` - Run backend Python tests

### GitHub Tools

- `github-issue-lookup` - Fetch issue details by number

## Resources

The server provides informational resources accessible through MCP clients:

- `lcfs://info` - Comprehensive system information and capabilities
- `lcfs://greeting` - Welcome message and usage guidance

## Architecture

### Modular Design

```
src/
├── index.ts           # Main server entry point
├── tools/             # Tool implementations by category
│   ├── system.ts      # Health and system info
│   ├── docker.ts      # Container management
│   ├── database.ts    # Database operations
│   ├── testing.ts     # Test execution
│   └── github.ts      # GitHub integration
├── types/             # TypeScript type definitions
└── utils/             # Shared utilities
```

### Error Handling

- Comprehensive error catching and reporting
- User-friendly error messages
- Graceful degradation for failed operations
- Detailed logging for debugging

## Development Workflows

### Common Use Cases

1. **Development Environment Setup**

   ```bash
   # Use health check to verify server
   # Start required containers
   # Check database status
   ```

2. **Testing & Validation**

   ```bash
   # Run targeted tests with failure details
   # Check test coverage
   # Validate database migrations
   ```

3. **Container Management**

   ```bash
   # Discover running containers
   # Restart services after code changes
   # Clean up development environment
   ```

4. **Issue Investigation**
   ```bash
   # Look up GitHub issues for context
   # Check system status
   # Review database state
   ```

## Troubleshooting

### Common Issues

**Server Won't Start**

- Verify `APP_ENVIRONMENT=dev` is set
- Check Node.js version (18.0.0+)
- Ensure Docker services are accessible

**Container Operations Fail**

- Verify Docker daemon is running
- Check container names and Docker Compose setup
- Review Docker permissions

**Database Operations Fail**

- Confirm database container is running
- Verify database connection settings
- Check migration state

**Test Execution Issues**

- Ensure frontend/backend dependencies are installed
- Check memory limits and shard configurations
- Verify test file patterns and paths

### Debug Mode

Enable detailed logging by examining server stdout/stderr when running in development mode.

## Contributing

When modifying the MCP server:

1. Follow the existing modular tool structure
2. Add comprehensive error handling
3. Include confirmation prompts for destructive operations
4. Update tool documentation and schemas
5. Test with actual MCP clients
6. Maintain development-only security restrictions

## License

This project is part of the LCFS system and follows the same licensing terms.

## Related Documentation

- [LCFS Main Documentation](../CLAUDE.md)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Docker Compose Configuration](../docker-compose.yml)
- [Development Workflows](../wiki/)
