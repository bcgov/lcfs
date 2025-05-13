# Development Environment Setup

This guide walks through setting up the local development environment for the LCFS project. It combines information from the original "01. Gettings Started" wiki page with current project structure and dependencies.

## 1. Prerequisites

Before you begin, ensure you have the following installed on your system:

*   **Git**: For cloning the repository and version control.
*   **Docker and Docker Compose**: For running the application services in containers. ([Install Docker](https://docs.docker.com/get-docker/), Docker Compose is typically included).
*   **Node.js and npm**: For frontend development.
    *   It's recommended to use a Node version manager like `nvm` to easily switch Node versions.
    *   Check `frontend/.nvmrc` (if it exists) or `frontend/package.json` (`engines` field) for the specific Node.js version recommended for the project. If not specified, a recent LTS version is generally a good choice.
    *   npm (Node Package Manager) is included with Node.js.
*   **Python and Poetry**: For backend development.
    *   Python version is specified in `backend/.python-version` (e.g., 3.9+).
    *   Poetry is used for Python dependency management. ([Install Poetry](https://python-poetry.org/docs/#installation)).
*   **OpenShift CLI (`oc`)**: Optional, but required for certain tasks like data transfer to/from OpenShift environments using scripts in the `etl/` directory. ([Install OpenShift CLI](https://docs.openshift.com/container-platform/latest/cli_reference/openshift_cli/getting-started-cli.html)).

## 2. Cloning the Repository

Clone the LCFS repository to your local machine:

```bash
git clone https://github.com/bcgov/lcfs.git
cd lcfs
```

## 3. Running the Full Application (Docker Compose)

The simplest way to get all core services (frontend, backend, database, Redis, RabbitMQ, MinIO) running together is using the main Docker Compose file at the project root.

```bash
docker-compose up --build
```

*   The `--build` flag ensures that Docker images are rebuilt if there are changes to Dockerfiles or related build contexts.
*   Once started:
    *   Frontend will be accessible at: `http://localhost:3000`
    *   Backend API documentation (Swagger UI) will be accessible at: `http://localhost:8000/docs` (Note: original wiki said `/3000/docs`, but FastAPI typically serves on its own port).
    *   Backend API documentation (ReDoc) will also be available at: `http://localhost:8000/redoc`.

## 4. Setting Up and Running Frontend Separately

If you need to work primarily on the frontend or run it independently:

1.  **Navigate to the frontend directory**:
    ```bash
    cd frontend
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
    This will also install Husky git hooks if configured (check `.husky/` directory).
3.  **Run the frontend development server**:
    ```bash
    npm run dev
    ```
    The frontend will typically be available at `http://localhost:3000` (as configured in Vite and `package.json`).

## 5. Setting Up and Running Backend Separately

If you need to work primarily on the backend or run it independently:

1.  **Navigate to the backend directory**:
    ```bash
    cd backend
    ```
2.  **Install dependencies using Poetry**:
    *Ensure Poetry is installed and configured in your shell.*
    ```bash
    poetry install
    ```
3.  **Set up pre-commit hooks** (recommended for code quality checks before committing):
    ```bash
    poetry run pre-commit install
    ```
    Pre-commit hooks are configured in `backend/.pre-commit-config.yaml` and typically run tools like Black, Flake8, MyPy, and Isort.
4.  **Run the backend development server**:
    ```bash
    poetry run python -m lcfs
    ```
    This command executes the `__main__.py` script in the `lcfs` package, which starts the Uvicorn server for the FastAPI application.
    The backend API will typically be available at `http://localhost:8000`.

## 6. Setting Up the ETL Environment

The ETL subsystem (Apache NiFi and related services) has its own Docker Compose setup for local development.

1.  **Navigate to the ETL directory**:
    ```bash
    cd etl
    ```
2.  **Run ETL services**:
    ```bash
    docker-compose up -d
    ```
    This starts NiFi, NiFi Registry, Zookeeper, and the TFRS source database.
3.  **Access NiFi UI**: `http://localhost:8091/nifi/`
4.  **Access NiFi Registry UI**: `http://localhost:18080`
5.  Refer to `etl/readme.md` or [Data Migration (TFRS to LCFS)](Data-Migration-TFRS-to-LCFS.md) for instructions on loading NiFi templates and configuring database connections within NiFi.

## 7. IDE Setup

*   **VS Code**: Recommended extensions for Python (Pylance, Python Test Explorer), JavaScript/React (ESLint, Prettier), Docker.
    *   Ensure your VS Code settings use the project's Python interpreter (managed by Poetry) and Node.js version.
*   **Other IDEs**: Configure according to their specific instructions for Python/Poetry and Node.js/npm projects.

## 8. Environment Variables

*   **Backend**: Core database and service connection details are often set via environment variables in `docker-compose.yml` for local development. For running the backend separately, you might need to set these in your shell or a `.env` file (check `backend/lcfs/settings.py` for how Pydantic settings loads them).
*   **Frontend**: Environment variables for the frontend (e.g., API base URL if not relative, Keycloak settings) are typically managed via `.env` files (e.g., `.env`, `.env.development`) loaded by Vite. Check `frontend/vite.config.js` and the application code.
*   **Cypress**: E2E tests require `frontend/cypress.env.json` for test user credentials and other parameters. Create this by copying `frontend/cypress.env.example.json` and filling in the necessary values. **Do not commit `cypress.env.json`.**

---
*This setup guide should provide a solid foundation for local development. Refer to specific README files in subdirectories (`backend/README.md`, `frontend/README.md`, `etl/readme.md`) for more detailed information on each component.* 