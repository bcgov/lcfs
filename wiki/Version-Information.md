# Version Information

This page provides guidance on how to find version information for the LCFS application components and its key dependencies. This is part of the requirements for ticket #2409.

## 1. Application Versioning (Overall)

*   **Git Tags**: The primary way to version the overall LCFS application is through Git tags on the `main` branch. Tags should follow Semantic Versioning (e.g., `v1.0.0`, `v1.1.0`, `v1.0.1`).
*   **Releases**: GitHub Releases are created from these tags and should include changelogs or summaries of what's included in that version.
*   **Action**: Confirm if this Git Tag / GitHub Release strategy is actively used and documented.

## 2. Backend Component Versions

*   **Python Version**: Defined in `backend/.python-version`.
*   **Key Python Libraries (FastAPI, SQLAlchemy, etc.)**: Versions are managed by Poetry and specified in `backend/pyproject.toml` under `[tool.poetry.dependencies]` and `[tool.poetry.group.dev.dependencies]`.
    *   The exact resolved versions are locked in `backend/poetry.lock`.
*   **Backend Docker Image**: The version/tag of the `lcfs-backend` Docker image pushed to the container registry (e.g., OpenShift registry) will correspond to a specific Git commit or release tag from the CI/CD pipeline.

## 3. Frontend Component Versions

*   **Node.js Version**: May be specified in `frontend/.nvmrc` or in the `engines` field of `frontend/package.json`.
*   **Key JavaScript Libraries (React, Vite, MUI, etc.)**: Versions are managed by npm and specified in `frontend/package.json` under `dependencies` and `devDependencies`.
    *   The exact resolved versions are locked in `frontend/package-lock.json`.
*   **Frontend Docker Image**: The version/tag of the `lcfs-frontend` Docker image pushed to the container registry will correspond to a specific Git commit or release tag from the CI/CD pipeline.

## 4. ETL Component Versions

*   **Apache NiFi Image**: Specified in `etl/docker-compose.yml` (e.g., `apache/nifi:1.27.0`).
*   **Apache NiFi Registry Image**: Specified in `etl/docker-compose.yml` (e.g., `apache/nifi-registry:1.27.0`).
*   **Zookeeper Image**: Specified in `etl/docker-compose.yml` (e.g., `bitnami/zookeeper:3.9.2-debian-12-r14`).
*   **PostgreSQL JDBC Driver**: The specific JAR file version is usually included in `etl/jdbc_drivers/` (e.g., `postgresql-42.7.3.jar`) and mounted into the NiFi container.

## 5. Infrastructure Service Versions (from `docker-compose.yml` for local dev)

*   **PostgreSQL (LCFS Main DB)**: e.g., `postgres:14.2` (from root `docker-compose.yml`).
*   **Redis**: e.g., `bitnami/redis:7.4.2` (from root `docker-compose.yml`).
*   **RabbitMQ**: e.g., `rabbitmq:3-management` (from root `docker-compose.yml`).
*   **MinIO**: e.g., `minio/minio:latest` (from root `docker-compose.yml` - note that `latest` can change).
*   **OpenShift**: The version of the OpenShift Container Platform being used for deployments (Dev, Test, Prod). This is managed by the platform team.
*   **Keycloak**: The version of Keycloak being used. This might be a centrally managed instance.

## 6. Finding Version Information in a Deployed Environment

*   **OpenShift**: 
    *   `oc describe deploymentconfig <dc_name>` or `oc describe deployment <deployment_name>` can show the image tag being used for a particular deployment.
    *   Application UIs might have an "About" page or a footer displaying the current version/commit SHA (this is a common practice to implement).
*   **API Endpoint**: The backend might expose an informational endpoint (e.g., `/api/version` or `/api/health`) that returns the current application version or Git commit SHA.
    *   **Action**: Check if such an endpoint exists or should be added.

---
*It is important to keep track of versions for debugging, compatibility, and security patching. Refer to the specified files and systems for the most up-to-date version information.* 