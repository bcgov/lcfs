# Development Tools and Utilities

This document provides an overview of common development tools and utility scripts used in the LCFS project. This is part of the requirements for ticket #2410.

## 1. Backend Tools

### 1.1. Poetry
*   **Purpose**: Dependency management and packaging for Python projects.
*   **Configuration**: `backend/pyproject.toml`, `backend/poetry.lock`.
*   **Common Commands** (run from `backend/` directory):
    *   `poetry install`: Install dependencies.
    *   `poetry add <package_name>`: Add a new dependency.
    *   `poetry remove <package_name>`: Remove a dependency.
    *   `poetry update`: Update dependencies to their latest allowed versions.
    *   `poetry run <command>`: Run a command within the project's virtual environment (e.g., `poetry run pytest`).
*   **Reference**: [Poetry Documentation](https://python-poetry.org/docs/)

### 1.2. Pre-commit
*   **Purpose**: A framework for managing and maintaining multi-language pre-commit hooks. Ensures code quality checks (linting, formatting) run before code is committed.
*   **Configuration**: `backend/.pre-commit-config.yaml`.
*   **Hooks Used**: Black (formatter), Flake8 (linter), Isort (import sorter), MyPy (static type checker), `wemake-python-styleguide` (linter).
*   **Setup** (run from `backend/` directory):
    ```bash
    poetry run pre-commit install
    ```
*   **Usage**: Runs automatically when you `git commit`. You can also run it manually on all files: `poetry run pre-commit run --all-files`.
*   **Reference**: [Pre-commit Documentation](https://pre-commit.com/)

### 1.3. `migrate.sh`
*   **Purpose**: Utility script in `backend/migrate.sh` for managing Alembic database migrations.
*   **Functionality**: Generating new migration scripts, applying upgrades, and performing downgrades.
*   **Usage**: See [Database Schema Overview](Database-Schema-Overview.md#managing-migrations-backendmigratesh).

### 1.4. Locust
*   **Purpose**: Load testing tool for backend APIs.
*   **Configuration**: `backend/performance/locustfile.py` defines test scenarios.
*   **Usage**: See `backend/performance/readme.md` for instructions on running load tests.
*   **Reference**: [Locust Documentation](https://locust.io/)

## 2. Frontend Tools

### 2.1. Node.js & npm
*   **Purpose**: Node.js is the JavaScript runtime. npm (Node Package Manager) is used for managing frontend dependencies and running scripts.
*   **Configuration**: `frontend/package.json`, `frontend/package-lock.json`.
*   **Common Commands** (run from `frontend/` directory):
    *   `npm install`: Install dependencies.
    *   `npm run dev`: Start the Vite development server.
    *   `npm run build`: Create a production build.
    *   `npm run test`: Run Vitest unit tests.
    *   `npm run lint`: Run ESLint.
    *   `npm run cypress:open`: Open Cypress test runner.
*   **Reference**: [Node.js Documentation](https://nodejs.org/), [npm Documentation](https://docs.npmjs.com/)

### 2.2. Vite
*   **Purpose**: Frontend build tool and development server. Provides fast HMR and optimized builds.
*   **Configuration**: `frontend/vite.config.js`.
*   **Reference**: [Vite Documentation](https://vitejs.dev/)

### 2.3. ESLint
*   **Purpose**: Pluggable JavaScript linter to find and fix problems in JavaScript code.
*   **Configuration**: `frontend/.eslintrc.cjs`.
*   **Usage**: Integrated into pre-commit hooks (via Husky) and can be run manually: `npm run lint`.
*   **Reference**: [ESLint Documentation](https://eslint.org/)

### 2.4. Prettier
*   **Purpose**: Opinionated code formatter.
*   **Configuration**: `frontend/.prettierrc`.
*   **Usage**: Integrated into pre-commit hooks (via Husky) and can be run manually.
*   **Reference**: [Prettier Documentation](https://prettier.io/)

### 2.5. Husky
*   **Purpose**: Tool for managing Git hooks easily (e.g., for running linters/formatters on pre-commit).
*   **Configuration**: `frontend/.husky/` directory.
*   **Setup**: Typically installed via `npm install` if listed as a dev dependency.
*   **Reference**: [Husky Documentation](https://typicode.github.io/husky/)

### 2.6. Storybook
*   **Purpose**: UI component development environment and documentation tool. Allows developing and testing components in isolation.
*   **Configuration**: `frontend/.storybook/` directory.
*   **Run**: `npm run storybook` (from `frontend/` directory).
*   **Reference**: [Storybook Documentation](https://storybook.js.org/)

### 2.7. Cypress Utilities
*   **`cypress.env.json`**: Stores environment variables for Cypress tests (e.g., user credentials). Create from `cypress.env.example.json`. **Do not commit `cypress.env.json`**.
*   **Chrome Recorder**: Potentially used for generating Cypress test skeletons (see `frontend/cypress/chrome-recorder` if present).

## 3. ETL Tools & Utilities

### 3.1. Apache NiFi & NiFi Registry
*   **Purpose**: Data flow automation and version control for flows.
*   **Local Setup**: Managed via `etl/docker-compose.yml`.
*   **Access UIs (local dev)**:
    *   NiFi: `http://localhost:8091/nifi/`
    *   NiFi Registry: `http://localhost:18080`

### 3.2. `etl/data-migration.sh`
*   **Purpose**: Script to automate NiFi-based data migration from TFRS to LCFS.
*   **Usage**: See [Data Migration (TFRS to LCFS)](Data-Migration-TFRS-to-LCFS.md).

### 3.3. `etl/data-transfer.sh`
*   **Purpose**: Script to transfer database dumps between OpenShift and local PostgreSQL instances.
*   **Usage**: See [Data Migration (TFRS to LCFS)](Data-Migration-TFRS-to-LCFS.md).

### 3.4. `jq` and `lsof`
*   **`jq`**: Command-line JSON processor, used by ETL scripts.
*   **`lsof`**: Utility to list open files, used by ETL scripts to check port usage.
*   **Installation**: These may need to be installed on your system if not already present, especially if you are running ETL scripts locally outside of a container that might provide them.

## 4. General Tools

*   **Docker & Docker Compose**: For containerization and local orchestration across the project.
*   **Git & GitHub**: For version control and collaboration.
*   **OpenShift CLI (`oc`)**: For interacting with OpenShift clusters.
*   **IDE**: VS Code is popular, but other IDEs supporting Python and JavaScript development can be used.

---
*This list provides an overview. Refer to the specific documentation for each tool for more detailed information and advanced usage.* 