#!/bin/bash

VENV_DIR="./venv"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Creating or activating the virtual environment
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment with Python 3.9+"
    python3.9 -m venv $VENV_DIR
fi
source $VENV_DIR/bin/activate
export PYTHONPATH=$SCRIPT_DIR:$PYTHONPATH

# Installing dependencies using Poetry
echo "Installing dependencies with Poetry..."
poetry install

# Function for generating new migrations
generate_migration() {
    if [ "$#" -ne 1 ]; then
        echo "Usage: $0 -g <Description of changes>"
        exit 1
    fi
    alembic revision --autogenerate -m "$1"
}

# Function for upgrading the database
upgrade_database() {
    revision=${1:-head}
    alembic upgrade $revision
}

# Function for downgrading the database
downgrade_database() {
    revision=${1:-base}
    alembic downgrade $revision
}

# Function for displaying help manual
display_help() {
    echo "Usage: $0 [option]"
    echo "Options:"
    echo "  -g <message>  Generate new migration with a description."
    echo "  -u [revision] Upgrade the database to a specific revision or to the latest ('head')."
    echo "  -d [revision] Downgrade the database to a specific revision or to the base."
    echo "  -h            Display this help manual."
}

# Command line options
while getopts ":g:u::d::h" opt; do
    case $opt in
        g) generate_migration "$OPTARG" ;;
        u) upgrade_database "$OPTARG" ;;
        d) downgrade_database "$OPTARG" ;;
        h) display_help; exit 0 ;;
        \?) echo "Invalid option -$OPTARG" >&2; exit 1 ;;
        :) if [ "$OPTARG" = "u" ]; then
              upgrade_database
           elif [ "$OPTARG" = "d" ]; then
              downgrade_database
           else
              echo "Option -$OPTARG requires an argument." >&2
              exit 1
           fi ;;
    esac
done

# Deactivating the virtual environment
deactivate
