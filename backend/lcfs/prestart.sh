#!/usr/bin/env bash

echo "running prestart.sh from $(pwd)"

# alembic -n lcfs_db upgrade head

# Apply base database migrations
echo "Applying base migrations."
alembic upgrade head

# Check for errors
if [ $? -ne 0 ]; then
    echo "Base database migrations failed."
    exit 1
fi

# Apply common seed migrations
echo "Applying common seed migrations."
alembic -n common_seeds upgrade head

# Check for errors
if [ $? -ne 0 ]; then
    echo "Common seed migrations failed."
    exit 1
fi

# Check if the environment is development
if [ "$APP_ENVIRONMENT" == "dev" ]; then
    # Apply development-specific seed migrations
    echo "Applying development seed migrations."
    alembic -n dev_seeds upgrade head

    if [ $? -ne 0 ]; then
        echo "Development seed migrations failed."
        exit 1
    fi
fi

# Check if the environment is development
if [ "$APP_ENVIRONMENT" == "prod" ]; then
    # Apply development-specific seed migrations
    echo "Applying production seed migrations."
    export ALEMBIC_SCRIPT_LOCATION=lcfs/db/seeds/prod
    alembic -n prod_seeds upgrade head

    if [ $? -ne 0 ]; then
        echo "Production seed migrations failed."
        exit 1
    fi
fi


echo "Migrations completed successfully."


echo "done running prestart.sh from $(pwd)"
