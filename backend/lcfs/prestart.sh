#!/usr/bin/env bash

echo "running prestart.sh from $(pwd)"

echo "running alembic upgrade head on lcfs_db from prestart.sh"
alembic -n lcfs_db upgrade head
echo "done running alembic upgrade head on lcfs_db from prestart.sh"

echo "done running prestart.sh from $(pwd)"
