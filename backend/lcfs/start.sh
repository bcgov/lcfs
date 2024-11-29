#!/usr/bin/env bash

# Wait for the database to be ready
./wait-for-it.sh $LCFS_DB_HOST:5432 --timeout=30

# Load migrations or other prestart tasks
./lcfs/prestart.sh

# Start the FastAPI application
if [ "$APP_ENVIRONMENT" = "prod" ]; then
  echo "Prod build"
  uvicorn main:lcfs --host 0.0.0.0 --port 8000 --workers 2
else
  echo "Non-prod build"
  poetry run python -m lcfs
