# TFRS to LCFS Migration Makefile
#
# Prerequisites:
# - Docker and Docker Compose installed
# - OpenShift CLI (oc) installed
# - Python 3.8+ with requirements installed
# - User must be logged into OpenShift: oc login
#
# SECURITY NOTE: This Makefile only supports IMPORT operations.
# NO EXPORT to production databases is allowed.

.PHONY: help setup setup-prod setup-dev quick-start migrate validate check clean stop status docker-start docker-stop

# Default target
help:
	@echo "TFRS to LCFS Migration Commands"
	@echo "==============================="
	@echo ""
	@echo "🚀 Quick Start:"
	@echo "  make quick-start     - Complete migration with auto Docker setup (dev data)"
	@echo "  make setup-prod      - Setup databases with PRODUCTION data (requires oc login)"
	@echo "  make setup-dev       - Setup databases with DEV data (requires oc login)"
	@echo ""
	@echo "🐳 Docker Management:"
	@echo "  make docker-start    - Start TFRS container and LCFS environment"
	@echo "  make docker-stop     - Stop TFRS container"
	@echo "  make status          - Show running containers and database status"
	@echo ""
	@echo "🔧 Migration Operations:"
	@echo "  make migrate         - Run migrations only (assumes databases ready)"
	@echo "  make validate        - Run validation only (assumes migration complete)"
	@echo "  make check           - Check if databases are ready for migration"
	@echo ""
	@echo "🔄 Database Reset:"
	@echo "  make reset           - Reset LCFS database from existing .tar file"
	@echo "  make reset-lcfs      - Reset LCFS database from existing .tar file"
	@echo "  make reset-tfrs      - Reset TFRS database from existing .tar file"
	@echo "  make reset-all       - Reset both TFRS and LCFS databases"
	@echo ""
	@echo "🧹 Cleanup:"
	@echo "  make clean           - Stop containers and clean up volumes"
	@echo "  make stop            - Stop all migration containers"
	@echo ""
	@echo "📋 Prerequisites:"
	@echo "  - Correct project structure: ./setup-paths.sh"
	@echo "  - Docker running"
	@echo "  - OpenShift login: oc login (for data import)"
	@echo "  - Python requirements: pip install -r requirements.txt"

# Quick start - complete migration with dev data
quick-start:
	@echo "🚀 Starting complete migration with automatic setup..."
	@echo "📋 Using DEV environment data"
	@./quick-start.sh --env dev

# Setup databases with production data (IMPORT ONLY)
setup-prod:
	@echo "⚠️  Setting up databases with PRODUCTION data"
	@echo "🔒 SECURITY: Only IMPORT from production is allowed"
	@echo "📋 Checking OpenShift login..."
	@oc whoami || (echo "❌ Please login to OpenShift first: oc login" && exit 1)
	@echo "🐳 Starting Docker containers and importing PRODUCTION data..."
	python3 setup/migration_orchestrator.py auto-setup --env prod

# Setup databases with dev data
setup-dev:
	@echo "🔧 Setting up databases with DEV data"
	@echo "📋 Checking OpenShift login..."
	@oc whoami || (echo "❌ Please login to OpenShift first: oc login" && exit 1)
	@echo "🐳 Starting Docker containers and importing DEV data..."
	python3 setup/migration_orchestrator.py auto-setup --env dev

# Setup databases with test data
setup-test:
	@echo "🧪 Setting up databases with TEST data"
	@echo "📋 Checking OpenShift login..."
	@oc whoami || (echo "❌ Please login to OpenShift first: oc login" && exit 1)
	@echo "🐳 Starting Docker containers and importing TEST data..."
	python3 setup/migration_orchestrator.py auto-setup --env test

# Start Docker containers without data import
docker-start:
	@echo "🐳 Starting Docker containers..."
	@docker compose up -d tfrs
	@echo "🔄 Starting LCFS environment..."
	@if [ -f "../../docker-compose.yml" ]; then \
		cd ../../ && docker compose up -d; \
	else \
		echo "⚠️  LCFS docker-compose.yml not found at ../../docker-compose.yml"; \
		echo "Please start LCFS environment manually"; \
	fi
	@echo "✅ Docker containers started"
	@make status

# Stop TFRS container
docker-stop:
	@echo "🛑 Stopping TFRS container..."
	@docker compose down tfrs
	@echo "✅ TFRS container stopped"

# Run migrations only (assumes setup complete)
migrate:
	@echo "🚀 Running data migrations..."
	@echo "📋 Checking migration readiness..."
	python3 setup/migration_orchestrator.py check || (echo "❌ Databases not ready for migration" && exit 1)
	@echo "▶️  Running all migration scripts..."
	python3 setup/migration_orchestrator.py migrate

# Run validation only (assumes migration complete)
validate:
	@echo "🔎 Running migration validation..."
	python3 setup/migration_orchestrator.py validate

# Check if databases are ready for migration
check:
	@echo "🔍 Checking migration readiness..."
	python3 setup/migration_orchestrator.py check

# Show status of containers and databases
status:
	@echo "🐳 Docker Container Status:"
	@echo "=========================="
	@docker ps --format "table {{.ID}}\\t{{.Names}}\\t{{.Status}}\\t{{.Ports}}" | grep -E "(CONTAINER|tfrs|lcfs|postgres)" || echo "No migration containers running"
	@echo ""
	@echo "💾 Database Status:"
	@echo "=================="
	@python3 setup/database_manager.py verify-tfrs 2>/dev/null || echo "TFRS: Not accessible"
	@python3 setup/database_manager.py verify-lcfs 2>/dev/null || echo "LCFS: Not accessible"
	@echo ""
	@echo "📊 Migration Readiness:"
	@echo "======================"
	@python3 setup/migration_orchestrator.py check 2>/dev/null && echo "✅ Ready for migration" || echo "❌ Not ready for migration"

# Stop all containers
stop:
	@echo "🛑 Stopping all migration containers..."
	@docker compose down
	@echo "ℹ️  Note: LCFS environment containers are left running"
	@echo "   To stop LCFS: cd ../../ && docker compose down"

# Clean up everything
clean: stop
	@echo "🧹 Cleaning up Docker volumes..."
	@docker compose down -v
	@docker volume prune -f
	@echo "✅ Cleanup complete"

# Development helpers
install:
	@echo "📦 Installing Python requirements..."
	pip install -r requirements.txt

lint:
	@echo "🔍 Running Python linting..."
	@python3 -m flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics || echo "⚠️  Linting issues found (not blocking)"

test-docker:
	@echo "🐳 Testing Docker setup..."
	@docker --version
	@docker compose version
	@echo "✅ Docker is ready"

test-openshift:
	@echo "🔐 Testing OpenShift connection..."
	@oc whoami && echo "✅ OpenShift connection ready" || echo "❌ Please login: oc login"

# Production data import with extra confirmation
import-prod: 
	@echo "⚠️  WARNING: This will import PRODUCTION data to local containers!"
	@echo "🔒 SECURITY: This is a READ-ONLY operation from production"
	@echo "📋 Production data will OVERWRITE existing local data"
	@read -p "Are you sure you want to proceed? (yes/no): " answer && \
	if [ "$$answer" = "yes" ]; then \
		make setup-prod; \
	else \
		echo "❌ Production import cancelled"; \
	fi

# Show environment info
info:
	@echo "🔧 Environment Information:"
	@echo "=========================="
	@echo "Python: $$(python3 --version 2>&1)"
	@echo "Docker: $$(docker --version)"
	@echo "Docker Compose: $$(docker compose version --short 2>/dev/null || docker-compose --version)"
	@echo "OpenShift CLI: $$(oc version --client --short 2>/dev/null || echo 'Not installed')"
	@echo "OpenShift User: $$(oc whoami 2>/dev/null || echo 'Not logged in')"
	@echo ""
	@echo "📁 Project Structure:"
	@echo "===================="
	@ls -la | grep -E "(core|migrations|setup|validation|docker-compose)"

# Complete workflow examples
workflow-dev:
	@echo "🔄 Complete DEV workflow..."
	@make setup-dev
	@make migrate  
	@make validate

workflow-prod:
	@echo "🔄 Complete PRODUCTION workflow..."
	@make import-prod
	@make migrate
	@make validate

# Individual container operations
start-tfrs:
	@echo "🐳 Starting TFRS container only..."
	@docker compose up -d tfrs
	@echo "✅ TFRS container started"

start-lcfs:
	@echo "🐳 Starting LCFS environment..."
	@if [ -f "../../docker-compose.yml" ]; then \
		cd ../../ && docker compose up -d; \
		echo "✅ LCFS environment started"; \
	else \
		echo "❌ LCFS docker-compose.yml not found at ../../docker-compose.yml"; \
	fi

# Database operations
reset-tfrs:
	@echo "🔄 Resetting TFRS database from existing .tar file..."
	@python3 setup/database_manager.py reset tfrs tfrs_migration

reset-lcfs:
	@echo "🔄 Resetting LCFS database from existing .tar file..."
	@python3 setup/database_manager.py reset lcfs db
	@echo "🔧 Running Alembic database migrations..."
	@cd ../../backend && $$(command -v poetry || echo /opt/homebrew/bin/poetry) run alembic upgrade head
	@echo "✅ Database schema updated to latest version"

reset: reset-lcfs
	@echo "✅ LCFS database has been reset from the existing dump file"

reset-all: reset-tfrs reset-lcfs
	@echo "✅ Both TFRS and LCFS databases have been reset from existing dump files"

# Logs
logs-tfrs:
	@echo "📋 TFRS container logs:"
	@docker compose logs tfrs

logs-all:
	@echo "📋 All container logs:"
	@docker compose logs