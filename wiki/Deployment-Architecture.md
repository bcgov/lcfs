# Deployment Architecture

This document describes the deployment architecture for the LCFS system, covering local development, and production/staging environments (OpenShift).

## 1. Local Development Environment

The local development setup is defined by Docker Compose files:

*   **Main Application (`./docker-compose.yml`)**: Orchestrates the core LCFS services:
    *   `backend`: Python FastAPI application.
    *   `frontend`: React (Vite) application.
    *   `db`: PostgreSQL database for LCFS data.
    *   `redis`: Redis for caching.
    *   `rabbitmq`: RabbitMQ for message queuing.
    *   `minio`: S3-compatible object storage.
    *   `create_bucket`: MinIO utility to create the initial bucket.
    *   All services are connected via a `shared_network`.
*   **ETL Subsystem (`./etl/docker-compose.yml`)**: Orchestrates the services required for ETL processes:
    *   `nifi`: Apache NiFi for data flow automation.
    *   `registry`: Apache NiFi Registry for flow version control.
    *   `zookeeper`: Apache Zookeeper for NiFi configuration management.
    *   `tfrs`: PostgreSQL database (source TFRS data for ETL).
    *   These services also connect via a `shared_network`, likely the same one as the main application to allow NiFi to access the LCFS `db`.

## 2. OpenShift Deployment (Production/Staging/Test)

The LCFS application is deployed to an OpenShift Container Platform environment. Key aspects include:

*   **Container Images**: Custom Docker images are built for the `backend` and `frontend` services.
    *   `Dockerfile` and `Dockerfile.dev` are used for local development builds.
    *   `Dockerfile.openshift` files exist in both `backend/` and `frontend/` directories, suggesting specific image build configurations for OpenShift.
*   **Build Configuration (`openshift/templates/`)**:
    *   `backend-bc.yaml`: Defines an OpenShift `BuildConfig` for the backend service. This likely uses Source-to-Image (S2I) or a Docker strategy to build the backend container image within OpenShift from the source code.
    *   `frontend-bc.yaml`: Defines an OpenShift `BuildConfig` for the frontend service, similarly building the frontend container image.
*   **Serving Frontend Assets**: The `frontend/nginx.conf` file indicates that Nginx is used to serve the static assets (HTML, CSS, JavaScript) built by the React/Vite application in the OpenShift environment.
*   **OpenShift Resources (Inferred - requires further details from `openshift/` templates or cluster inspection)**:
    *   **Deployments/DeploymentConfigs**: Manage the lifecycle of application pods (backend, frontend, potentially others like NiFi if deployed to OpenShift).
    *   **Services**: Provide stable internal IP addresses and DNS names for accessing pods.
    *   **Routes**: Expose services (particularly the frontend and backend APIs) externally with hostnames.
    *   **ConfigMaps**: Store non-sensitive configuration data.
    *   **Secrets**: Store sensitive data (database credentials, API keys, JWT secrets for Keycloak integration).
    *   **Persistent Volumes**: Used for databases (PostgreSQL for LCFS, TFRS if also on OpenShift), MinIO (if on OpenShift), RabbitMQ data, NiFi repositories.
    *   **Network Policies**: The `openshift/templates/knps/` directory might contain `NetworkPolicy` resources, possibly for controlling traffic flow between pods, especially concerning Keycloak or other sensitive services.
*   **Maintenance Page**: The `openshift/templates/maintenance-page/` directory suggests resources for deploying a dedicated maintenance page.
*   **ETL Deployment**: The ETL components (NiFi, NiFi Registry, Zookeeper, TFRS DB) might also be deployed to OpenShift, or NiFi might connect to an OpenShift-hosted LCFS database from an external NiFi instance. The `data-transfer.sh` script in `etl/` implies interaction between OpenShift and other environments for data.

## Further Investigation

*   A detailed review of all YAML files within `openshift/templates/` (including subdirectories like `knps/` and `maintenance-page/`) is needed to fully document the specific OpenShift resources and their configurations.
*   Clarify if the ETL subsystem (NiFi, etc.) is also deployed to OpenShift or runs externally.
*   Understand the CI/CD pipeline that triggers the OpenShift builds and deployments. 