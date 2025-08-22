# LCFS MCP Server - Development Only
# This Dockerfile creates a container for the LCFS Model Context Protocol server
# WARNING: This is for local development only and should not be used in production

FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user for security
RUN addgroup -g 1001 -S mcpuser && \
    adduser -S mcpuser -u 1001

# Change ownership of app directory
RUN chown -R mcpuser:mcpuser /app

# Switch to non-root user
USER mcpuser

# Environment variables
ENV NODE_ENV=development
ENV APP_ENVIRONMENT=dev

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('MCP Server Health Check - OK')" || exit 1

# Expose no ports (stdio transport)
# Note: MCP server uses stdio, no network ports needed

# Add labels for documentation
LABEL maintainer="LCFS Development Team"
LABEL description="LCFS Model Context Protocol Server for Local Development"
LABEL version="1.0.0"
LABEL environment="development-only"

# Start the MCP server
CMD ["npm", "start"]