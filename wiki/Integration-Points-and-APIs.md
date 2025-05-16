# Integration Points and APIs

This document outlines the key integration points and Application Programming Interfaces (APIs) within the LCFS system.

## 1. Internal APIs (Backend Service)

*   **Provider**: The `backend` service (FastAPI application).
*   **Type**: RESTful APIs (confirmed by `[fastapi-template.options]` in `pyproject.toml`).
*   **Specification**: FastAPI automatically generates an OpenAPI schema for the APIs it serves.
    *   **OpenAPI JSON**: Typically available at the `/openapi.json` endpoint when the backend service is running.
    *   **Interactive API Docs (Swagger UI)**: Typically available at the `/docs` endpoint.
    *   **Interactive API Docs (ReDoc)**: Typically available at the `/redoc` endpoint.
*   **Consumers**: Primarily the `frontend` React application. Other services or external clients could potentially consume these APIs if authorized.
*   **Authentication**: Secured using JWTs, issued by Keycloak and validated by the backend (see [Security Architecture](Security-Architecture.md)).
*   **Key Functionality Areas (Inferred)**:
    *   User management and authentication-related operations (though primarily delegated to Keycloak).
    *   CRUD (Create, Read, Update, Delete) operations for core LCFS data entities.
    *   Endpoints for business logic and workflow processing.
    *   Endpoints for initiating asynchronous tasks via RabbitMQ.
    *   Endpoints for file uploads/downloads via MinIO.

## 2. Frontend to Backend Communication

*   The `frontend` (React application) uses the `axios` library to make HTTP requests to the `backend` APIs.
*   It utilizes `@tanstack/react-query` for managing server state, which involves fetching, caching, and synchronizing data from these backend APIs.

## 3. External Service Integrations

### 3.1. Keycloak (Identity and Access Management)

*   **Purpose**: Handles user authentication, identity brokering, and potentially fine-grained authorization.
*   **Integration Type**: The `frontend` application integrates with Keycloak using OpenID Connect (OIDC) via `keycloak-js` and `@react-keycloak/web` libraries.
*   **Flow**: The frontend redirects users to Keycloak for login. Keycloak issues JWTs (access and ID tokens) which are then used by the frontend to authenticate with the LCFS `backend` API.
*   **API Interaction**: While primarily a redirect-based flow for authentication, Keycloak also has its own comprehensive set of APIs (Admin API, Account API) that LCFS might interact with for user management or other advanced scenarios (though this is not directly evident from current codebase analysis).

### 3.2. TFRS Database (ETL Source)

*   **Purpose**: Acts as a data source for the ETL processes.
*   **Integration Type**: The Apache NiFi service within the ETL subsystem connects to the TFRS PostgreSQL database using a JDBC connection.
*   **Data Flow**: Data is extracted from TFRS and processed by NiFi for loading into the LCFS application database.

## 4. ETL Subsystem APIs/Interfaces

*   **Apache NiFi UI**: Provides a web interface at `http://localhost:8091/nifi/` (local dev) for managing, monitoring, and operating data flows.
*   **Apache NiFi REST API**: NiFi itself exposes a comprehensive REST API that can be used to control and monitor NiFi programmatically. It's unclear if LCFS directly uses this API, but it's available.
*   **Apache NiFi Registry UI**: Provides a web interface at `http://localhost:18080` (local dev) for managing versioned flows.
*   **Apache NiFi Registry REST API**: The NiFi Registry also has its own REST API.

## Further Investigation

*   Analyze the frontend code (services, API call locations) to map out specific backend API endpoints being consumed.
*   Explore the `/openapi.json` schema (once the backend is running) to get a definitive list and structure of all backend APIs.
*   Investigate NiFi flow definitions (`etl/templates/`) to understand the specifics of data interaction with the TFRS and LCFS databases. 