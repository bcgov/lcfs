# Base stage for common setup
FROM python:3.11-slim-bullseye as base

# Install build dependencies and Poetry in one step to minimize layers
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && pip install --no-cache-dir poetry==1.6.1 \
    && poetry config virtualenvs.create false \
    && apt-get purge -y gcc \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy only dependency files first (to leverage caching)
COPY pyproject.toml poetry.lock /app/

# Install only main dependencies
RUN poetry install --only main --no-root

# Copy the rest of the application files
COPY . /app/

# Make necessary scripts executable
RUN chmod +x /app/wait-for-it.sh /app/lcfs/prestart.sh /app/lcfs/start.sh

# Default startup command
CMD ["/bin/bash", "/app/lcfs/start.sh"]

# Production stage
FROM base as prod
# Set the APP_ENVIRONMENT variable to 'production'
ENV APP_ENVIRONMENT=prod

# Development stage
FROM base as dev
# Set the APP_ENVIRONMENT variable to 'development'
ENV APP_ENVIRONMENT=dev

# Install additional dependencies for development
RUN poetry install --no-root
