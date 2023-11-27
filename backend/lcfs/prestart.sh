#!/usr/bin/env bash

echo "running prestart.sh from $(pwd)"

# Apply base database migrations
echo "Applying base migrations."
alembic upgrade head

# Check for errors in migrations
if [ $? -ne 0 ]; then
    echo "Base database migrations failed."
    exit 1
fi

# Run Python seed script
echo "Running Python seed script."
python /app/db/seeders/seed_manager.py $APP_ENVIRONMENT

# Check for errors in seed script
if [ $? -ne 0 ]; then
    echo "Python seed script failed."
    exit 1
fi

echo "Migrations and seeding completed successfully."

echo "done running prestart.sh from $(pwd)"
