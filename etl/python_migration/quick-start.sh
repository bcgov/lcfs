#!/bin/bash

# Quick start script for TFRS to LCFS migration with automatic Docker setup

set -e

echo "🚀 TFRS to LCFS Migration - Quick Start"
echo "======================================"
echo

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: Please run this script from the python_migration directory"
    exit 1
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Parse command line arguments
ENV="dev"
SKIP_VALIDATION=""
ONLY_SETUP=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENV="$2"
            shift 2
            ;;
        --skip-validation)
            SKIP_VALIDATION="--skip-validation"
            shift
            ;;
        --setup-only)
            ONLY_SETUP="true"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--env dev|test|prod] [--skip-validation] [--setup-only]"
            echo
            echo "Options:"
            echo "  --env ENV           Environment to use (dev, test, prod) [default: dev]"
            echo "  --skip-validation   Skip validation after migration"
            echo "  --setup-only        Only setup Docker environment, don't run migration"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

echo "Environment: $ENV"
if [ -n "$SKIP_VALIDATION" ]; then
    echo "Validation: Skipped"
else
    echo "Validation: Enabled"
fi

if [ -n "$ONLY_SETUP" ]; then
    echo "Mode: Setup only"
else
    echo "Mode: Complete migration"
fi

echo

# Security check - only import operations allowed
echo "🔒 SECURITY: This script only performs IMPORT operations from OpenShift"
echo "🔒 SECURITY: NO EXPORT to production databases is allowed"
echo

# Check OpenShift login if not using dev
if [ "$ENV" != "dev" ]; then
    echo "🔐 Checking OpenShift login..."
    if ! oc whoami >/dev/null 2>&1; then
        echo "❌ Error: Not logged into OpenShift. Please run 'oc login' first."
        exit 1
    fi
    echo "✅ OpenShift login verified"
    echo
fi

if [ -n "$ONLY_SETUP" ]; then
    echo "🐳 Setting up Docker environment automatically..."
    python setup/migration_orchestrator.py auto-setup --env "$ENV"
    
    if [ $? -eq 0 ]; then
        echo
        echo "✅ Docker environment setup completed!"
        echo "You can now run migrations manually with:"
        echo "  python setup/migration_orchestrator.py migrate"
        echo "  python setup/migration_orchestrator.py validate"
    else
        echo "❌ Docker environment setup failed"
        exit 1
    fi
else
    echo "🚀 Running complete migration with automatic Docker setup..."
    python setup/migration_orchestrator.py auto-complete --env "$ENV" $SKIP_VALIDATION
    
    if [ $? -eq 0 ]; then
        echo
        echo "🎉 Complete migration process successful!"
        echo
        echo "📊 What happened:"
        echo "  1. Started TFRS Docker container automatically"
        echo "  2. Started LCFS environment (if available)"
        echo "  3. Imported $ENV data from OpenShift"
        echo "  4. Ran all migration scripts"
        if [ -z "$SKIP_VALIDATION" ]; then
            echo "  5. Ran comprehensive validation"
        fi
        echo
        echo "🔍 Check the logs above for detailed results"
        echo "📁 Validation reports saved in setup/ directory"
    else
        echo "❌ Migration process failed"
        exit 1
    fi
fi

echo
echo "🐳 Running containers:"
docker ps --format "table {{.ID}}\\t{{.Names}}\\t{{.Status}}" | grep -E "(tfrs|lcfs|postgres)"

echo
echo "✨ Migration complete! You can now access:"
echo "  - TFRS data in the tfrs-migration container"
echo "  - LCFS application at http://localhost:3000 (if running)"
echo "  - LCFS database in the LCFS environment"