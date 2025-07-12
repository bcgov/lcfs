# Subsystems and Responsibilities

This document outlines the major subsystems of the LCFS application, their primary responsibilities, and key technologies. It draws information from the system's `docker-compose.yml` files, backend (`pyproject.toml`), frontend (`package.json`), and ETL (`etl/`) configurations.

## 1. Backend (`backend` service)

*   **Description**: The central application server responsible for business logic, API provision, and coordination between other services.
*   **Primary Technologies**: Python, FastAPI, SQLAlchemy, Pydantic.
*   **Build**: Custom Docker image built from `backend/Dockerfile` (dev target) and `backend/Dockerfile.openshift` (OpenShift target).
*   **Responsibilities**:
    *   Exposing RESTful APIs (FastAPI auto-generates OpenAPI spec) for the frontend and potentially other clients.
    *   Implementing core business rules and workflows of the LCFS.
    *   Interacting with the `db` (PostgreSQL) for data persistence using SQLAlchemy ORM.
    *   Utilizing `redis` for caching (via `fastapi-cache2`) and potentially session management.
    *   Communicating with `rabbitmq` for asynchronous task processing (using `aio-pika`).
    *   Interacting with `minio` object storage for file uploads/downloads (using `boto3`).
    *   Validating incoming data using Pydantic.
    *   Handling API security with JWTs (issued by Keycloak, validated with `pyjwt`).
*   **Key Configuration (from root `docker-compose.yml` environment variables & `pyproject.toml` analysis)**:
    *   Connects to PostgreSQL (`LCFS_DB_HOST: db`, `LCFS_DB_PORT: 5432`).
    *   Connects to Redis (`LCFS_REDIS_HOST: redis`, `LCFS_REDIS_PORT: 6379`).
    *   Application Port: `8000` (local dev).
    *   Debugger Port: `5678` (local dev).
*   **Directory Structure Snippet (from `02. Code Guidelines Conventions`):**
    ```
    backend
    └── lcfs
        ├── db          # module contains db configurations
        │   ├── migrations # Alembic migrations
        │   ├── models    # SQLAlchemy ORM models
        │   └── seeders   # Alembic seeders
        ├── services    # Package for different external services (e.g., rabbit, redis)
        ├── tests       # Pytest tests
        ├── utils       # Utility functions
        └── web         # Package contains web server (FastAPI)
            ├── api       # API route handlers
            │   └── router.py # Main FastAPI router
            ├── core      # Core application logic
            ├── exception # Custom exception handlers
            ├── application.py # FastAPI application setup
            └── lifetime.py  # Startup/shutdown event handlers
        ├── __main__.py # Startup script (runs uvicorn)
        ├── settings.py # Main configuration settings
        └── ... (other config files like alembic.ini, pyproject.toml)
    ```

## 2. Frontend (`frontend` service)

*   **Description**: The user interface for the LCFS application, built as a Single Page Application (SPA).
*   **Primary Technologies**: React, Vite, Material-UI, Zustand, React Query.
*   **Build**: Custom Docker image built from `frontend/Dockerfile.dev` (dev target) and `frontend/Dockerfile.openshift` (OpenShift target), using Vite.
*   **Responsibilities**:
    *   Providing a dynamic and responsive web-based interface.
    *   Making API calls to the `backend` service (using `axios`) to fetch, submit, and manage data.
    *   Client-side routing (`react-router-dom`).
    *   Managing client-side application state (`zustand` for global state, `@tanstack/react-query` for server state).
    *   Rendering UI components (Material-UI, AG Grid for tables).
    *   Handling user authentication/authorization via Keycloak (`@react-keycloak/web`).
    *   Internationalization (`i18next`).
    *   Displaying maps (`react-leaflet`).
    *   Rich text editing (`react-quill`).
*   **Key Configuration (from root `docker-compose.yml` & `package.json` analysis)**:
    *   Development server port: `3000`.
    *   Build tool: Vite.
    *   Component library: Material-UI.
*   **Directory Structure Snippet (from `02. Code Guidelines Conventions`):**
    ```
    frontend
    ├── public      # Static assets
    ├── src
    │   ├── assets
    │   ├── components # Reusable UI components
    │   ├── constants
    │   ├── hooks      # Custom React hooks
    │   ├── layouts
    │   ├── services   # API service integrations (e.g., useApiService)
    │   ├── stores     # Zustand stores
    │   ├── themes
    │   ├── utils
    │   ├── pages/views # Page-level components
    │   ├── App.jsx
    │   └── main.jsx
    ├── .storybook  # Storybook configuration
    ├── cypress     # Cypress E2E tests
    └── ... (config files like vite.config.js, package.json)
    ```

## 3. Database (`db` service - LCFS Main)

*   **Description**: The primary relational database for LCFS application data.
*   **Technology**: PostgreSQL (`postgres:14.2` image).
*   **Responsibilities**: Storing transactional and relational data, ensuring data integrity.
*   **Configuration (from root `docker-compose.yml`)**:
    *   Database Name: `lcfs`, User: `lcfs`.
    *   Port: `5432`.
    *   Data Volume: `postgres_data`.
*   **Schema Management**: Alembic (see [Database Schema Overview](Database-Schema-Overview.md)).

## 4. Cache (`redis` service)

*   **Description**: In-memory data store for caching.
*   **Technology**: Redis (`bitnami/redis:7.4.2` image).
*   **Responsibilities**: Storing frequently accessed data to reduce database load and improve API response times.
*   **Integration**: Used by the `backend` via `fastapi-cache2`.
*   **Configuration (from root `docker-compose.yml`)**: Port `6379`, Data Volume `redis_data`.

## 5. Message Queue (`rabbitmq` service)

*   **Description**: Message broker for asynchronous communication.
*   **Technology**: RabbitMQ (`rabbitmq:3-management` image).
*   **Responsibilities**: Managing queues for asynchronous tasks (e.g., report generation, notifications).
*   **Integration**: Used by the `backend` via `aio-pika`.
*   **Configuration (from root `docker-compose.yml`)**: AMQP Port `5672`, Management UI `15672`.

## 6. Object Storage (`minio` service)

*   **Description**: S3-compatible object storage.
*   **Technology**: MinIO (`minio/minio:latest` image).
*   **Responsibilities**: Storing user-uploaded files, generated reports, etc.
*   **Integration**: Used by the `backend` via `boto3`.
*   **Configuration (from root `docker-compose.yml`)**: API Port `9000`, Console `9001`, Bucket `lcfs`.

## 7. ETL Subsystem (Extract, Transform, Load - in `etl/` directory)

*   **Description**: Responsible for data integration, primarily migrating/synchronizing data from an external TFRS database to the LCFS database.
*   **Core Technology**: Apache NiFi (`apache/nifi:1.27.0` image).
    *   Manages data flow pipelines defined in templates (`etl/templates/`).
    *   Uses PostgreSQL JDBC driver for database connections.
    *   Depends on Zookeeper for configuration management.
*   **Flow Version Control**: Apache NiFi Registry (`apache/nifi-registry:1.27.0` image).
*   **Source Database (ETL context)**: `tfrs` (PostgreSQL `14.2` image, runs on port `5435` locally).
*   **Responsibilities**:
    *   Extracting data from the TFRS database.
    *   Transforming data according to LCFS requirements.
    *   Loading data into the LCFS application database.
    *   Error logging for failed records (`etl/nifi_output/`).
*   **Orchestration/Utilities**: Local ETL environment defined in `etl/docker-compose.yml`. Shell scripts (`data-transfer.sh`, `data-migration.sh`) assist with data movement and NiFi process management.

## 8. Identity and Access Management (IAM)

*   **Technology**: Keycloak.
*   **Responsibilities**: Handles user authentication, identity brokering, token issuance (JWTs), and access management.
*   **Integration**: Frontend integrates via OIDC (`keycloak-js`). Backend validates JWTs issued by Keycloak.

## Potentially Used Services (Commented out in root `docker-compose.yml`)

*   **`clamav`**: Antivirus engine, likely for scanning file uploads if enabled.

---
*This document provides an overview. For deeper dives into specific technologies or code structure, refer to the linked detailed pages or the codebase itself.* 