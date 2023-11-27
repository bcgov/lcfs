#!/usr/bin/env bash

echo "running prestart.sh from $(pwd)"

# Apply base database migrations
echo "Applying base migrations."
poetry run alembic upgrade head

# Check for errors in migrations
if [ $? -ne 0 ]; then
    echo "Base database migrations failed."
    exit 1
fi

# Run Python seed script using Poetry
echo "Running Python seed script."
poetry run python /app/lcfs/db/seeders/seed_database.py $APP_ENVIRONMENT

# Check for errors in the seed script
if [ $? -ne 0 ]; then
    echo "Python seed script failed."
    exit 1
fi

echo "Migrations and seeding completed successfully."

echo "done running prestart.sh from $(pwd)"
