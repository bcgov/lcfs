#!/usr/bin/env bash

echo "Running prestart.sh from $(pwd)"

# Check for Alembic head conflicts
HEAD_COUNT=$(poetry run alembic heads | wc -l)
if [ "$HEAD_COUNT" -gt 1 ]; then
    echo "Alembic head conflict detected: Multiple migration heads present."
    exit 1
fi

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
echo "Running Python views creation script."
poetry run python /app/lcfs/db/sql/manage_views.py $APP_ENVIRONMENT

# Check for errors in the seed script
if [ $? -ne 0 ]; then
    echo "Python seed script failed."
    exit 1
fi

echo "Migrations and seeding completed successfully."
echo "Done running prestart.sh from $(pwd)"
