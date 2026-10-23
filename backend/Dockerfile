# Python version is generated from .python-version; run scripts/sync-python-version.py --write.
# Base stage for common setup
FROM python:3.13-slim-trixie as base

RUN apt-get update && apt-get install -y \
  gcc \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libcairo2 \
  libgdk-pixbuf-2.0-0 \
  tzdata \
  && rm -rf /var/lib/apt/lists/*

RUN pip install poetry==2.5.1

# Configuring poetry
RUN poetry config virtualenvs.create false

# Copying requirements of a project
COPY pyproject.toml poetry.lock .python-version /app/
WORKDIR /app

# Catch version drift even when building outside CI.
RUN python -c 'import pathlib, sys; expected = pathlib.Path(".python-version").read_text().strip(); actual = ".".join(map(str, sys.version_info[:2])); assert actual == expected, f"Python {actual} does not match .python-version ({expected})"'

# Installing requirements
RUN poetry install --only main --no-root

# Removing gcc
RUN apt-get purge -y \
  gcc \
  && rm -rf /var/lib/apt/lists/*

# Copying the actual application, wait-for-it script, and prestart script
COPY . /app/

# Note: We mount the local directory using docker-compose so ensure these scripts also have execute permissions
# by running the following command on your host machine from the root of this project:
# chmod +x ./backend/wait-for-it.sh ./backend/lcfs/prestart.sh ./backend/lcfs/start.sh ./backend/lcfs/start-reload.sh

# Make all startup scripts executable
RUN chmod +x /app/wait-for-it.sh /app/lcfs/prestart.sh /app/lcfs/start.sh

# Fail the build if the time zone data predates BC's permanent UTC-7 (IANA tzdb 2026b)
RUN poetry run python -m lcfs.scripts.check_tzdata

CMD /bin/bash /app/lcfs/start.sh

# Production stage
FROM base as prod
# Set the APP_ENVIRONMENT variable to 'production'
ENV APP_ENVIRONMENT=prod

# Development stage
FROM base as dev
# Set the APP_ENVIRONMENT variable to 'development'
ENV APP_ENVIRONMENT=dev
# Install additional dependencies for development
RUN poetry install
