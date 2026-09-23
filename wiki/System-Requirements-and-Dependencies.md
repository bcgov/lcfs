# System Requirements and Dependencies

This document lists the key software, services, frameworks, and libraries that the LCFS system depends on. It also includes prerequisites for setting up a development environment as outlined in the "01. Gettings Started" guide.

## I. Development Prerequisites

- **Operating System**: Linux, macOS, or Windows (with WSL2 recommended for Docker performance).
- **Containerization**: Docker and Docker Compose.
- **Frontend**: Node.js (check `frontend/.nvmrc` or `package.json` for specific version, e.g., LTS) and npm (comes with Node.js).
- **Backend**: Python (version specified in `backend/.python-version`, e.g., 3.9+) and Poetry (for dependency management).
- **Version Control**: Git.
- **OpenShift CLI**: `oc` CLI tool for interacting with OpenShift environments (for data transfer, deployment tasks).

## II. Runtime Environment & Orchestration

- **Containerization**: Docker.
- **Local Development Orchestration**: Docker Compose (separate `docker-compose.yml` for main app and ETL).
- **Production/Staging Orchestration**: OpenShift Container Platform.

## III. Backend (`backend` service)

- **Programming Language**: Python (`^3.9` as per `pyproject.toml`).
- **Web Framework**: FastAPI (`^0.115.4`).
- **ASGI Server**: Uvicorn.
- **Database/ORM**: PostgreSQL (`postgres:17` locally; Crunchy PostgreSQL HA cluster in OpenShift).
  - **Driver**: `asyncpg` (for asyncio with SQLAlchemy).
  - **ORM**: SQLAlchemy (`^2.0.0`).
  - **Migrations**: Alembic (`^1.12.1`), `alembic-postgresql-enum`.
- **Caching**: Redis (`redis:8.2.1` via Docker image; used for caching, rate limiting, and async job status).
  - **Client**: `redis` Python library (`^4.4.2`).
  - **Integration**: `fastapi-cache2` (`^0.2.1`).
- **Object Storage**: MinIO (S3-compatible, `latest` image).
  - **Client**: `boto3` (`^1.35.26`).
- **Virus Scanning**: ClamAV, feature-flagged via `clamav_enabled` (off by default; `backend/lcfs/services/clamav`).

> **Note**: RabbitMQ has been fully removed from the stack — there is no `rabbitmq` service, no AMQP/`aio-pika` config in `backend/lcfs/settings.py`, and `backend/lcfs/services/rabbitmq/` is an empty leftover directory. Older docs/diagrams referencing RabbitMQ or Redis 7.4.2/Postgres 14.2 are out of date.

- **Data Validation/Serialization**: Pydantic (`^2.4.2`), `pydantic-settings`.
- **Authentication/Security**: `pyjwt` (`^2.8.0`), `cryptography` (`^43.0.1`).
- **HTTP Client**: `httpx` (`^0.23.3`).
- **Data Handling/Excel**: `pandas`, `openpyxl`, `xlwt`, `xlrd`, `numpy`.
- **Logging**: Structlog (`^24.4.0`). See [Backend Logging Guide](Backend-Logging-Guide.md).
- **Templating**: Jinja2 (`^3.1.6`).
- **Dependency Management**: Poetry.

## IV. Frontend (`frontend` service)

- **Core Framework**: React (`^18.3.1`).
- **Build Tool/Dev Server**: Vite (`^6.2.6`) with `@vitejs/plugin-react`.
- **Package Manager**: npm.
- **UI Component Library**: Material-UI (`@mui/material ^6.4.9`).
- **Data Grids**: AG Grid (`@ag-grid-community/react ^32.3.4`).
- **Routing**: React Router DOM (`^7.5.2`).
- **State Management**:
  - Zustand (`^5.0.3`): For global client-side state.
  - React Query (`@tanstack/react-query ^5.69.0`): For server state, data fetching, caching, and synchronization.
- **HTTP Client**: Axios (`^1.8.4`).
- **Forms**: React Hook Form (`^7.54.2`), Yup (`^1.6.1`).
- **Authentication (Client-Side)**: Keycloak JS (`^26.1.4`), `@react-keycloak/web` (`^3.4.0`).
- **Internationalization (i18n)**: `i18next` (`^24.2.3`), `react-i18next` (`^15.4.1`).
- **Date/Time**: `date-fns`, `dayjs`, `@mui/x-date-pickers`.
- **Rich Text Editor**: Quill, `react-quill`.
- **Mapping/GIS**: Leaflet, `react-leaflet`.
- **Notifications**: `notistack`.
- **File Handling**: `papaparse` (CSV), `xlsx` (Excel).
- **API Documentation Display**: `swagger-ui-react`.
- **Web Server (Production/OpenShift)**: Nginx.

## V. ETL Subsystem (`etl/` directory)

- **Data Flow Automation**: Apache NiFi (`1.27.0`).
- **NiFi Flow Version Control**: Apache NiFi Registry (`1.27.0`).
- **NiFi Configuration Management**: Apache Zookeeper (`bitnami/zookeeper:3.9.2-debian-12-r14`).
- **Source Database (ETL context)**: PostgreSQL (`postgres:17`, named `tfrs`).
- **JDBC Drivers**: PostgreSQL JDBC Driver (`postgresql-42.7.3.jar` for NiFi).

## VI. External Services / Integrations

- **Identity & Access Management**: Keycloak.
- **TFRS Database**: External PostgreSQL database serving as a data source for ETL processes.
- **CHES (Common Hosted Email Service)**: BC Gov's email API, called via OAuth2 client-credentials (`backend/lcfs/web/api/email/`). Feature-flagged via `ches_enabled` (off by default). Used for user notifications, government notifications, and scheduled-task emails (fuel code expiry, monthly credit market report).
- **BC Address Geocoder**: External REST API for forward/reverse geocoding and address autocomplete (`backend/lcfs/services/geocoder/`), results cached in Redis.
- **Metabase**: External BI tool used two ways — the backend calls its dashboard/card REST API to build the monthly credit-market Excel report (`backend/lcfs/services/metabase/client.py`), and Metabase itself reads dedicated reporting views directly from PostgreSQL (`backend/lcfs/db/sql/views/metabase.sql`).

## VII. Local Developer Tooling (not deployed)

- **MCP Server** (`mcp-server/`): TypeScript Model Context Protocol server exposing container/DB/test-run controls to AI coding assistants over stdio. Requires `APP_ENVIRONMENT=dev`; commented out in `docker-compose.yml` by default and never built/deployed for OpenShift.

## VIII. Development & Testing Tools

- **Backend Testing**: Pytest, `pytest-cov`, `fakeredis`.
- **Backend Performance Testing**: Locust.
- **Backend Linting/Formatting/Static Analysis**: Flake8, MyPy, Isort, Black, `wemake-python-styleguide`, pre-commit.
- **Frontend Unit/Integration Testing**: Vitest, React Testing Library, JSDOM, MSW (Mock Service Worker).
- **Frontend E2E Testing**: Cypress, Cucumber (`@badeball/cypress-cucumber-preprocessor`).
- **Frontend Linting/Formatting**: ESLint, Prettier.
- **Component Development (Frontend)**: Storybook.

---

_This list is based on current analysis of configuration files and existing documentation. Specific versions are as found and may be subject to updates. Refer to respective package manager files (`pyproject.toml`, `package.json`) for the most precise versioning._
