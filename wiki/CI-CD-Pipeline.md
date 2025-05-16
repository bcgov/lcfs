# CI/CD Pipeline

This document describes the Continuous Integration (CI) and Continuous Deployment (CD) pipeline for the LCFS project. This is part of the requirements for ticket #2410.

## 1. Overview

The CI/CD pipeline automates the process of building, testing, and deploying the LCFS application, ensuring rapid and reliable delivery of new features and fixes.

*   **Platform**: GitHub Actions (inferred from the presence of `.github/workflows` directory in typical projects, and common for modern development).
    *   **Action**: Verify if GitHub Actions is indeed the CI/CD platform. If other tools are used (e.g., Jenkins, Azure DevOps, OpenShift Pipelines), this section needs to be updated.

## 2. Continuous Integration (CI)

CI is triggered on every push to a branch or when a Pull Request (PR) is created/updated targeting `main` (or `develop`).

### Key CI Steps (Typical)

1.  **Checkout Code**: Fetches the latest code from the branch/PR.
2.  **Setup Environment**: 
    *   Sets up specific versions of Node.js (for frontend) and Python (for backend).
    *   Installs dependencies (npm for frontend, Poetry for backend).
    *   Caches dependencies to speed up subsequent runs.
3.  **Linting & Formatting Checks**:
    *   **Frontend**: Runs ESLint and Prettier to check for code style and potential errors.
    *   **Backend**: Runs Flake8, Black (check mode), Isort (check mode), and MyPy for style, formatting, and type checking.
4.  **Automated Testing**:
    *   **Frontend Unit/Integration Tests**: Runs Vitest tests (`npm run test:run`). Generates code coverage reports.
    *   **Backend Unit/Integration Tests**: Runs Pytest tests (`poetry run pytest`). Generates code coverage reports.
    *   **(Optional) Frontend E2E Tests**: May run Cypress tests against a preview environment or a mocked backend, though E2E tests are often part of a separate, scheduled pipeline or triggered manually due to their longer execution time.
5.  **Build Application**:
    *   **Frontend**: Creates a production build (`npm run build`).
    *   **Backend**: No explicit build step for Python itself, but checks might include ensuring the Poetry project is valid.
6.  **Build Docker Images** (Optional in CI, more common in CD, but can be a check):
    *   Validates that `Dockerfile` and `Dockerfile.openshift` files can build successfully.
7.  **Security Scans** (Optional but Recommended):
    *   Dependency vulnerability scans (e.g., `npm audit`, `safety` or `pip-audit`).
    *   Static Application Security Testing (SAST) tools.
    *   Container image vulnerability scans (if images are built).
8.  **Notifications**: Reports build status (success/failure) to GitHub, PR comments, or team communication channels (e.g., Slack).

## 3. Continuous Deployment (CD)

CD is typically triggered after a successful merge to the `main` branch (for production deployment) or a `develop`/`staging` branch (for pre-production environments).

### Key CD Steps (Typical for OpenShift)

1.  **Checkout Code**: Fetches the code from the branch that triggered the deployment (e.g., `main`).
2.  **Build Docker Images** (if not already built and pushed by CI):
    *   Builds the `backend` and `frontend` Docker images using their respective `Dockerfile.openshift` files.
    *   Tags the images appropriately (e.g., with Git commit SHA, version number).
    *   Pushes the images to a container registry accessible by OpenShift (e.g., OpenShift Internal Registry, BC Gov Artefact Repository).
3.  **Deploy to OpenShift Environment** (e.g., Dev, Test, Prod):
    *   Connects to the target OpenShift cluster using `oc login` (credentials stored as GitHub Secrets).
    *   Applies OpenShift templates/configurations:
        *   May use `oc process -f template.yaml | oc apply -f -` if using OpenShift templates.
        *   May use `kustomize build | oc apply -f -` if using Kustomize.
        *   May use Helm charts (`helm upgrade --install ...`).
        *   This updates `DeploymentConfigs` or `Deployments`, which triggers new pod rollouts.
    *   The `backend-bc.yaml` and `frontend-bc.yaml` `BuildConfigs` found in `openshift/templates/` might be triggered here if the strategy is to build images directly within OpenShift using S2I or Docker strategy based on code changes.
4.  **Run Database Migrations**: For the backend, Alembic migrations (`./migrate.sh -u head` or similar) are run against the target environment's database before the new application version goes live.
5.  **Health Checks / Smoke Tests**: Performs basic checks to ensure the deployed application is running and healthy.
6.  **Notifications**: Reports deployment status.

## 4. Workflow Files

*   CI/CD pipelines are defined as YAML files in the `.github/workflows/` directory of the repository.
*   There might be separate workflow files for CI (e.g., `ci.yml`, `pull-request.yml`) and CD (e.g., `deploy-dev.yml`, `deploy-prod.yml`).

## 5. Wiki Documentation Synchronization

*   A dedicated GitHub Actions workflow can be set up to automatically synchronize changes made to Markdown files in the `wiki/` directory of the main codebase repository to the actual GitHub Wiki repository (`lcfs.wiki.git`).
*   See [GitHub Workflow for Wiki Sync](GitHub-Workflow-for-Wiki-Sync.md) for the implementation.

## Further Investigation

*   **Action**: Review the `.github/workflows/` directory in the LCFS repository to confirm the exact CI/CD tools, triggers, and steps.
*   Document specific workflow file names and their purposes.
*   Detail how environment variables and secrets are managed for different environments in the CI/CD pipeline.

---
*This document provides a general outline. The actual implementation details are in the workflow files within the repository.* 