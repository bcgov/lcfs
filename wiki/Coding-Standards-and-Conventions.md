# Coding Standards and Conventions

This document outlines the coding standards, guidelines, and conventions to be followed when developing for the LCFS project. Adhering to these standards ensures code consistency, readability, and maintainability. This is adapted from the original "02. Code Guidelines Conventions" wiki page and updated with current project details.

## 1. General Principles

*   **DRY (Don't Repeat Yourself)**: Avoid duplicating code. Utilize functions, components, and services to encapsulate reusable logic.
*   **KISS (Keep It Super Simple)**: Strive for simplicity in design and implementation. Avoid unnecessary complexity.
*   **Separation of Concerns**: Organize code so that distinct functionalities are managed in separate, well-defined modules or components.
*   **Readability**: Write clear, understandable code. Use meaningful variable and function names. Add comments where necessary to explain complex logic, but avoid over-commenting obvious code.

## 2. Frontend (React, Vite, Material-UI)

### 2.1. Directory Structure

The frontend source code resides primarily in `frontend/src/`. The structure aims for clarity and modularity:

```
frontend/
├── public/                     # Static assets (copied to dist root)
├── src/
│   ├── assets/                 # Images, fonts, icons
│   │   ├── fonts/
│   │   ├── icons/
│   │   └── images/
│   ├── components/             # Reusable UI components (agnostic of business logic)
│   ├── constants/              # Application-wide constant values
│   ├── hooks/                  # Custom React hooks (e.g., for API calls, complex state logic)
│   ├── layouts/                # Components defining page structure (e.g., header, footer, sidebar)
│   ├── pages/views/            # Page-level components, often assembling layouts and feature components
│   ├── services/               # Modules for interacting with external services (e.g., backend APIs, Keycloak)
│   ├── stores/                 # Zustand state management stores
│   ├── themes/                 # Material-UI theme configurations
│   ├── types/                  # TypeScript type definitions (if/when using TypeScript)
│   ├── utils/                  # General utility functions
│   ├── App.jsx                 # Root React component, router setup
│   ├── main.jsx                # Application entry point (renders App)
│   └── global.scss             # Global styles (use sparingly, prefer MUI theming and component-scoped styles)
├── .storybook/                 # Storybook configuration and stories
├── cypress/                    # Cypress E2E tests
├── .eslint.cjs                 # ESLint configuration
├── .prettierrc                 # Prettier configuration
├── vite.config.js              # Vite build configuration
├── jsconfig.json               # JS/TS path alias configuration (sync with vite.config.js)
└── package.json                # Project dependencies and scripts
```

*   **Component Organization**:
    *   Simple, self-contained components can be single `.jsx` files within `src/components/`.
    *   More complex components that have their own specific child components, tests, stories, or styles should reside in their own subdirectory (e.g., `src/components/MyComplexComponent/MyComplexComponent.jsx`, `MyComplexComponent.test.jsx`, etc.).
    *   Use an `index.js` or `index.jsx` file within such component directories to export the main component, allowing for cleaner imports: `import { MyComplexComponent } from '@/components/MyComplexComponent';`

### 2.2. Naming Conventions

*   **Components**: PascalCase (e.g., `UserProfile.jsx`, `DataGridComponent`).
*   **Hooks**: camelCase, prefixed with `use` (e.g., `useAuth.js`, `useUserData`).
*   **Variables/Functions**: camelCase (e.g., `isLoading`, `fetchUserDetails`).
*   **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`).
*   **CSS/SCSS Classes**: Kebab-case (e.g., `user-profile-card`) when not using MUI's styling solutions.

### 2.3. Coding Style

*   **JavaScript/JSX**: Adhere to the configuration in `.eslintrc.cjs` (likely based on a standard like Airbnb or StandardJS, plus React-specific rules) and `.prettierrc` for automated code formatting.
*   **Named Exports**: Prefer named exports over default exports for explicitness and consistency.
    ```javascript
    // Preferred
    export const MyComponent = () => { /* ... */ };
    import { MyComponent } from '@/components/MyComponent';

    // Avoid
    // const MyComponent = () => { /* ... */ };
    // export default MyComponent;
    // import MyComponent from '@/components/MyComponent';
    ```
*   **Import Aliases**: Utilize import aliases configured in `jsconfig.json` and `vite.config.js` (e.g., `@/` mapping to `src/`) to avoid long relative paths: `import { MyComponent } from '@/components/MyComponent';`
*   **Styling**: 
    *   Primarily use Material-UI's theming and styling solutions (`sx` prop, `styled` components).
    *   For global styles or rare cases where MUI isn't sufficient, use SCSS/CSS modules or a global stylesheet (`global.scss`) judiciously.
*   **State Management**: Use Zustand for global state and React Query for server state management as per guidelines in [Libraries and Their Common Uses](Libraries-and-Their-Common-Uses.md).
*   **PropTypes/TypeScript**: While the current project seems to be JavaScript-based, if TypeScript is introduced, use it for strong typing. Otherwise, consider `prop-types` for runtime type checking in components.

### 2.4. Comments

*   Comment complex logic, algorithms, or non-obvious parts of the code.
*   Use JSDoc-style comments for functions and components to describe their purpose, parameters, and return values.
*   Avoid commenting out large blocks of code; remove unused code or use version control to manage it.

## 3. Backend (Python, FastAPI)

### 3.1. Directory Structure

The backend source code resides in `backend/lcfs/`. The structure is organized by feature and responsibility:

```
backend/
├── lcfs/
│   ├── db/                     # Database related modules
│   │   ├── migrations/         # Alembic migration scripts
│   │   │   └── versions/
│   │   ├── models/             # SQLAlchemy ORM models (e.g., user_model.py, report_model.py)
│   │   └── seeders/            # Alembic data seeding scripts
│   ├── services/               # Integration with external services (Redis, RabbitMQ, MinIO clients/logic)
│   ├── tests/                  # Pytest tests, organized mirroring the app structure
│   ├── utils/                  # Utility functions and classes
│   └── web/                    # FastAPI web application components
│       ├── api/                # API endpoint routers (e.g., v1/users.py, v1/reports.py)
│       │   └── router.py       # Main API router aggregating all versioned routers
│       ├── core/               # Core business logic, services, schemas (Pydantic models for API I/O)
│       ├── deps/               # FastAPI dependency injection functions
│       ├── application.py      # FastAPI application instantiation and middleware setup
│       └── lifetime.py       # Startup and shutdown event handlers (e.g., init_db, close_redis)
│   ├── __main__.py             # Entry point for running the backend (starts Uvicorn)
│   ├── settings.py             # Pydantic-based application settings/configuration
│   ├── logging_config.py       # Structlog logging configuration
│   └── conftest.py             # Pytest global fixtures
├── alembic.ini                 # Alembic configuration
├── pyproject.toml              # Poetry dependencies and project metadata
├── .pre-commit-config.yaml     # Pre-commit hook configurations
├── .flake8                     # Flake8 linter configuration
└── Dockerfile                  # Docker build instructions
```

### 3.2. Naming Conventions

*   **Modules/Files**: `snake_case.py` (e.g., `user_service.py`, `report_model.py`).
*   **Classes**: `PascalCase` (e.g., `UserService`, `ReportModel`).
*   **Functions/Methods/Variables**: `snake_case` (e.g., `get_user_details`, `report_id`).
*   **Constants**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_PAGE_SIZE`).

### 3.3. Coding Style

*   **PEP 8**: Strictly follow the PEP 8 Style Guide for Python Code.
*   **Formatting**: Use Black for automated code formatting (enforced by pre-commit hooks).
*   **Linting/Static Analysis**: Adhere to Flake8 and MyPy configurations (enforced by pre-commit hooks).
    *   `wemake-python-styleguide` is also used, providing stricter linting rules.
*   **Imports**: Use Isort to sort imports automatically (enforced by pre-commit hooks).
*   **Type Hinting**: Use Python type hints extensively for all function signatures and variables where appropriate. MyPy is used for static type checking.
*   **Docstrings**: Use Google-style docstrings for modules, classes, functions, and methods.
    ```python
    def get_user(user_id: int) -> User:
        """Fetches a user by their ID.

        Args:
            user_id: The ID of the user to fetch.

        Returns:
            The User object if found, otherwise None.
        """
        # ... implementation ...
    ```
*   **FastAPI**: Follow FastAPI best practices for structuring routers, using dependency injection, Pydantic models for request/response, etc.
*   **SQLAlchemy**: Use SQLAlchemy ORM features. Avoid raw SQL queries where possible. Define clear model relationships.

### 3.4. Logging

*   Utilize the centralized `structlog` based logging configured in `logging_config.py`. Refer to the [Backend Logging Guide](Backend-Logging-Guide.md) for details on how to log effectively.

## 4. Git and Version Control

*   Refer to the [Git Workflow and Branching](Git-Workflow-and-Branching.md) and [Contribution Guidelines](Contribution-Guidelines.md) for commit message standards and branching strategy.

## 5. Pre-commit Hooks

*   The backend uses `pre-commit` (configured in `backend/.pre-commit-config.yaml`) to automatically run linters (Flake8, MyPy), formatters (Black, Isort), and other checks before code is committed. Ensure pre-commit hooks are installed (`poetry run pre-commit install` in the `backend` directory).
*   The frontend may also use pre-commit hooks (e.g., via Husky, check `frontend/.husky/`) for ESLint and Prettier.

---
*These guidelines are intended to evolve. Please discuss any proposed changes or additions with the team.* 