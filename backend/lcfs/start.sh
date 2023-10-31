#!/bin/bash

# Wait for the database to be ready
./wait-for-it.sh db:5432 --timeout=30

# Load migrations or other prestart tasks
./lcfs/prestart.sh

# Start the FastAPI application
/usr/local/bin/python -m lcfs
