#!/usr/bin/env bash

echo "running prestart.sh from $(pwd)"

alembic -n lcfs_db upgrade head

echo "done running prestart.sh from $(pwd)"
