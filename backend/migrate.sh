#!/usr/bin/env bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
export PYTHONPATH=$SCRIPT_DIR:$PYTHONPATH

echo '   __   _____________  ___  ___    __  ____               __  _         '
echo '  / /  / ___/ __/ __/ / _ \/ _ )  /  |/  (_)__ ________ _/ /_(_)__  ___ '
echo ' / /__/ /__/ _/_\ \  / // / _  | / /|_/ / / _ `/ __/ _ `/ __/ / _ \/ _ \'
echo '/____/\___/_/ /___/ /____/____/ /_/  /_/_/\_, /_/  \_,_/\__/_/\___/_//_/'
echo '                                         /___/                          '
echo -e

# Function to seed the database
seed_database() {
    echo "🌱  Seeding the database..."

    # Note: Calling seed_database will default to using 'dev' seeds for the development environment.
    if poetry run python /app/lcfs/db/seeders/seed_database.py; then
        echo "✅  Database successfully seeded."
    else
        echo "❌  Seeding failed. Attempting to revert changes..."
        downgrade_database
        exit 1
    fi
}

# Function for generating new migrations
generate_migration() {
    if [ "$#" -ne 1 ]; then
        echo "Usage: $0 -g <Description of changes>"
        exit 1
    fi
    echo "🛠  Generating new migration: $1"
    poetry run alembic revision --autogenerate -m "$1"
    echo "✅  New migration created."
}

# Function for upgrading the database
upgrade_database() {
    local revision=${1:-head}
    echo "📈  Upgrading the database to revision: $revision"
    poetry run alembic upgrade $revision
    echo "✅  Database upgraded to $revision."
}

# Function for downgrading the database
downgrade_database() {
    local revision=${1:-base}
    echo "📉  Downgrading the database to revision: $revision"
    poetry run alembic downgrade $revision
    echo "✅  Database downgraded to $revision."
}

# Function for resetting and seeding the database
reset_and_seed_database() {
    echo "🔄  Resetting and seeding the database..."
    downgrade_database
    upgrade_database
    seed_database
    echo "✅  Database reset and seeded. Ready for fresh start. 🌱"
}

# Function for displaying help manual
display_help() {
    echo "Usage: $0 [option]"
    echo "Options:"
    echo "  -g <message>  Generate new migration with a description."
    echo "  -u [revision] Upgrade the database to a specific revision or to the latest ('head'). Optional argument."
    echo "  -d [revision] Downgrade the database to a specific revision or to the base. Optional argument."
    echo "  -s            Reset and seed the database."
    echo "  -h            Display this help manual."
}

# Installing dependencies using Poetry
echo "📚  Installing dependencies with Poetry..."
poetry install
echo "✅  Dependencies installed."
echo "====================================================="

# Check if no arguments were provided
if [ $# -eq 0 ]; then
    display_help
    exit 0
fi

# Command line options
while getopts ":g:u::d::sh" opt; do
    case $opt in
        g) generate_migration "$OPTARG" ;;
        u) upgrade_database "$OPTARG" ;;
        d) downgrade_database "$OPTARG" ;;
        s) reset_and_seed_database ;;
        h) display_help; exit 0 ;;
        \?) echo "❌  Invalid option -$OPTARG" >&2; exit 1 ;;
        :) case $OPTARG in
                u) upgrade_database ;;
                d) downgrade_database ;;
                *) echo "❌  Option -$OPTARG requires an argument." >&2; exit 1 ;;
           esac ;;
    esac
done
