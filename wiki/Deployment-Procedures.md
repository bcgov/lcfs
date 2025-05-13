# Deployment Procedures

This document outlines the procedures for deploying the LCFS application to different environments (e.g., Development, Test, Production on OpenShift). It complements the [Deployment Architecture](Deployment-Architecture.md) and [CI/CD Pipeline](CI-CD-Pipeline.md) documents. This fulfills part of the requirements for ticket #2410.

## 1. Overview

Deployments are primarily managed through the automated [CI/CD Pipeline](CI-CD-Pipeline.md). However, manual steps or checks might be required in certain situations, or for initial environment setup.

## 2. Automated Deployments (via CI/CD)

*   **Trigger**: Typically, merges to specific branches trigger automated deployments:
    *   Merge to `develop` (if used) might deploy to a Development or Staging environment.
    *   Merge to `main` might deploy to a Test environment, and subsequently to Production after further approvals/testing.
    *   **Action**: Confirm the exact branch-to-environment mapping and promotion strategy.
*   **Process**: The CI/CD pipeline handles:
    *   Building Docker images (using `Dockerfile.openshift`).
    *   Pushing images to the container registry.
    *   Applying OpenShift configurations (templates, Kustomize, Helm - as per project setup).
    *   Running database migrations (Alembic).
    *   Basic health checks.
*   **Monitoring**: Deployment progress and status can be monitored via the CI/CD platform (e.g., GitHub Actions interface) and OpenShift console.

## 3. Manual Deployment Steps (If Necessary)

Manual intervention might be needed for:

*   **Initial Environment Setup**: Setting up new OpenShift projects, databases, Keycloak clients, or other external dependencies for the first time.
*   **Hotfixes**: While ideally automated, a critical hotfix might require manual steps or expedited deployment procedures.
*   **Troubleshooting Failed Deployments**: Diagnosing and resolving issues that cause an automated deployment to fail.
*   **Specific Data Migration Tasks**: Running scripts like `etl/data-migration.sh` or `etl/data-transfer.sh` might be manual steps outside the regular CD pipeline for specific data operations.

### 3.1. General Manual Deployment Checklist (OpenShift)

*(This is a generic checklist; specific steps depend on your OpenShift templates and application configuration.)*

1.  **Access OpenShift**: Ensure you have `oc` CLI access to the target OpenShift cluster and are logged into the correct project/namespace.
2.  **Backup (If applicable)**: Before major changes or in production, ensure database backups and any stateful application data are recent.
3.  **Configuration Management**: 
    *   Verify `ConfigMaps` and `Secrets` in OpenShift are up-to-date (e.g., database credentials, API keys, Keycloak settings).
    *   Update these manually if they are not managed by the CI/CD pipeline or a configuration management tool.
4.  **Build Images (if not done by CI/CD or S2I)**:
    *   If using local Dockerfiles for OpenShift (`Dockerfile.openshift`):
        ```bash
        docker build -f backend/Dockerfile.openshift -t <image_registry>/<namespace>/lcfs-backend:<tag> backend/
        docker push <image_registry>/<namespace>/lcfs-backend:<tag>
        # Repeat for frontend
        ```
5.  **Apply OpenShift Resources**:
    *   If using OpenShift templates (e.g., from `openshift/templates/`):
        ```bash
        oc process -f openshift/templates/your-app-template.yaml -p IMAGE_TAG=<tag> -p OTHER_PARAM=value | oc apply -f -
        ```
    *   If `BuildConfigs` (`*-bc.yaml`) are used, new builds might be started via:
        ```bash
        oc start-build lcfs-backend --follow
        oc start-build lcfs-frontend --follow
        ```
        This typically pulls the latest code from the configured Git branch and builds the image within OpenShift.
6.  **Database Migrations**: 
    *   Ensure the backend application can connect to the database.
    *   Execute Alembic migrations. This might involve running a command inside the backend pod or using an OpenShift Job resource configured to run migrations.
        ```bash
        # Example: Exec into a running backend pod
        oc exec <backend_pod_name> -- ./migrate.sh -u head 
        ```
7.  **Verify Deployment**: 
    *   Check pod statuses: `oc get pods`.
    *   View pod logs: `oc logs -f <pod_name>`.
    *   Check service and route accessibility.
    *   Perform smoke tests.

## 4. Rolling Back a Deployment

*   **OpenShift `DeploymentConfig`**: OpenShift `DeploymentConfigs` automatically keep track of previous successful deployments. You can roll back to a previous deployment version using:
    ```bash
    oc rollout history dc/<deployment_config_name>
    oc rollout undo dc/<deployment_config_name> --to-revision=<previous_revision_number>
    ```
*   **OpenShift `Deployment`**: For standard Kubernetes `Deployments`, rollbacks are managed similarly:
    ```bash
    oc rollout history deployment/<deployment_name>
    oc rollout undo deployment/<deployment_name> --to-revision=<previous_revision_number>
    ```
*   **Database**: Rolling back database migrations requires careful consideration and use of Alembic downgrade scripts (`./migrate.sh -d <target_revision>`). This can be complex if data changes have occurred.

## 5. Maintenance Page

*   The `openshift/templates/maintenance-page/` directory suggests resources for deploying a maintenance page.
*   **Procedure**: Document the steps to enable and disable the maintenance page (e.g., by scaling down application pods and scaling up maintenance page pods, or by adjusting OpenShift Routes).

## Environment-Specific Considerations

*(Detail any differences in deployment procedures for Dev, Test, and Prod environments. E.g., approval processes, data handling, specific configurations.)*

*   **Development/Test**: Deployments are generally more frequent and may involve more permissive configurations.
*   **Production**: Deployments require stricter controls, pre-approval, and are often done during maintenance windows. Data backup and rollback plans are critical.

---
*This document should be updated as deployment processes evolve. Always ensure you understand the implications of deployment steps, especially in production environments.* 