#!/usr/bin/env bash

# Wait for the database to be ready
./wait-for-it.sh $LCFS_DB_HOST:5432 --timeout=30

# Load migrations or other prestart tasks
./lcfs/prestart.sh

# Start the FastAPI application
poetry run python -m lcfs
