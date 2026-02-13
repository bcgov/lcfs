#!/bin/bash

# Script to help users set up correct paths for their environment

echo "🔧 TFRS to LCFS Migration Path Setup"
echo "====================================="
echo

# Check current directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: Please run this script from the python_migration directory"
    echo "Current directory: $(pwd)"
    exit 1
fi

echo "✅ Running from correct directory: $(pwd)"
echo

# Look for LCFS docker-compose.yml in common locations
echo "🔍 Looking for LCFS docker-compose.yml..."

LCFS_PATHS=(
    "../../../docker-compose.yml"
    "../../docker-compose.yml" 
    "../lcfs/docker-compose.yml"
    "../../../../lcfs/docker-compose.yml"
)

FOUND_LCFS=""

for path in "${LCFS_PATHS[@]}"; do
    if [ -f "$path" ]; then
        echo "✅ Found LCFS docker-compose.yml at: $path"
        FOUND_LCFS="$path"
        break
    else
        echo "❌ Not found at: $path"
    fi
done

echo

if [ -n "$FOUND_LCFS" ]; then
    echo "🎉 Setup complete!"
    echo "LCFS docker-compose.yml found at: $FOUND_LCFS"
    echo
    echo "You can now use:"
    echo "  make setup-prod     # Setup with production data"
    echo "  make setup-dev      # Setup with dev data"
    echo "  make quick-start    # Complete migration with dev data"
else
    echo "⚠️  LCFS docker-compose.yml not found in expected locations"
    echo
    echo "Please either:"
    echo "1. Move this migration project to be relative to the main LCFS project"
    echo "2. Update the paths in Makefile and setup/docker_manager.py"
    echo "3. Start LCFS environment manually before running migrations"
    echo
    echo "Expected structure:"
    echo "  lcfs/"
    echo "  ├── docker-compose.yml  (main LCFS)"
    echo "  └── etl/"
    echo "      └── python_migration/"
    echo "          ├── docker-compose.yml  (TFRS only)"
    echo "          └── Makefile"
fi

echo
echo "📋 Current Docker containers:"
docker ps --format "table {{.Names}}\\t{{.Status}}" 2>/dev/null || echo "Docker not running"

echo
echo "🔧 Environment setup:"
echo "  Python: $(python --version 2>&1)"
echo "  Docker: $(docker --version 2>/dev/null || echo 'Not found')"
echo "  OpenShift CLI: $(oc version --client --short 2>/dev/null || echo 'Not found')"
echo "  OpenShift User: $(oc whoami 2>/dev/null || echo 'Not logged in')"