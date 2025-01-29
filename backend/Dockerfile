# Base stage for common setup
FROM python:3.11-slim-bullseye as base

RUN apt-get update && apt-get install -y \
  gcc \
  && rm -rf /var/lib/apt/lists/*

RUN pip install poetry==1.6.1

# Configuring poetry
RUN poetry config virtualenvs.create false

# Copying requirements of a project
COPY pyproject.toml poetry.lock /app/
WORKDIR /app

# Installing requirements
RUN poetry install --only main

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
