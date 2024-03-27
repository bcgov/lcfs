# lcfs

This project was generated using fastapi_template.

## Poetry

This project uses poetry. It's a modern dependency management
tool.

To run the project use this set of commands:

```bash
poetry install
poetry run python -m lcfs
```

This will start the server on the configured host.

You can find swagger documentation at `/api/docs`.

You can read more about poetry here: https://python-poetry.org/

## Project structure

```bash
$ tree "lcfs"
lcfs
├── conftest.py  # Fixtures for all tests.
├── db  # module contains db configurations
│   ├── migrations  # Alembic migrations used to seed the database.
│   └── models  # Package contains different models for ORMs.
├── __main__.py  # Startup script. Starts uvicorn.
├── services  # Package for different external services such as rabbit or redis etc.
├── settings.py  # Main configuration settings for project.
├── static  # Static content.
├── tests  # Tests for project.
└── web  # Package contains web server. Handlers, startup config.
    ├── api  # Package with all handlers.
    │   └── router.py  # Main router.
    ├── application.py  # FastAPI application configuration.
    └── lifetime.py  # Contains actions to perform on startup and shutdown.
```

## Configuration

This application can be configured with environment variables.

You can create `.env` file in the root directory and place all
environment variables here.

All environment variables should start with "LCFS_" prefix.

For example if you see in your "lcfs/settings.py" a variable named like
`random_parameter`, you should provide the "LCFS_RANDOM_PARAMETER"
variable to configure the value. This behaviour can be changed by overriding `env_prefix` property
in `lcfs.settings.Settings.Config`.

You can read more about BaseSettings class here: https://pydantic-docs.helpmanual.io/usage/settings/

## Pre-commit

To install pre-commit simply run inside the shell:
```bash
pre-commit install
```

pre-commit is very useful to check your code before publishing it.
It's configured using .pre-commit-config.yaml file.

By default it runs:
* black (formats your code);
* mypy (validates types);
* isort (sorts imports in all files);
* flake8 (spots possibe bugs);


You can read more about pre-commit here: https://pre-commit.com/


## Migrations

## Documentation for `migrate.sh`

### Purpose
The `migrate.sh` script is a versatile tool for managing database migrations in this fastapi project. It automates various tasks related to Alembic, including generating new migrations, upgrading and downgrading the database, and managing the virtual environment and dependencies.

### Features
- **Virtual Environment Management**: Automatically creates and manages a virtual environment for migration operations.
- **Dependency Management**: Installs project dependencies using Poetry.
- **Migration Generation**: Generates Alembic migration files based on SQLAlchemy model changes.
- **Database Upgrade**: Upgrades the database schema to a specified revision or the latest version.
- **Database Downgrade**: Reverts the database schema to a specified revision or to the base state.

### Usage
1. **Make Script Executable**
```bash
chmod +x migrate.sh
```

2. **Generating Migrations**
Generate a new migration with a descriptive message:
```bash
./migrate.sh -g "Description of changes"
```

3. **Upgrading Database**
Upgrade the database to a specific revision or to the latest version:
```bash
./migrate.sh -u [revision]
```
Omit `[revision]` to upgrade to the latest version (head).

4. **Downgrading Database**
Downgrade the database to a specific revision or to the base state:
```bash
./migrate.sh -d [revision]
```
Omit `[revision]` to revert to the base state.

5. **Help Manual**
Display the help manual for script usage:
```bash
./migrate.sh -h
```

### Notes
- Ensure Python 3.9+ and Poetry are installed on your system.
- The script assumes that it is located in the same directory as `alembic.ini`.
- Always test migrations in a development environment before applying them to production.
- The script automatically activates and deactivates the virtual environment as needed.


## Running Tests

To ensure the quality and correctness of the code, it's important to run tests regularly. This project uses `pytest` for testing. Follow these steps to run tests on your local machine:

### Prerequisites

Before running the tests, ensure the following prerequisites are met:

1. **PostgreSQL Instance**: A running instance of PostgreSQL is required. Ideally, use the provided `docker-compose` file to start a PostgreSQL container. This ensures consistency in the testing environment.

2. **Python Environment**: Make sure your Python environment is set up with all necessary dependencies. This can be achieved using Poetry:

   ```bash
   poetry install
   ```

### Running Tests with Pytest

The project's tests can be executed using the `pytest` command. Our testing framework is configured to handle the setup and teardown of the test environment automatically. Here's what happens when you run the tests:

- **Test Database Setup**: A test database is automatically created. This is separate from your development or production databases to avoid any unintended data modifications.

- **Database Migrations**: Alembic migrations are run against the test database to ensure it has the correct schema.

- **Data Seeding**: The `test_seeder` is used to populate the test database with necessary data for the tests.

- **Test Execution**: All test cases are run against the configured test database.

- **Teardown**: After the tests have completed, the test database is dropped to clean up the environment.

To run the tests, use the following command in your terminal:

```bash
poetry run pytest -s -v
```

Options:
- `-s`: Disables per-test capturing of stdout/stderr. This is useful for observing print statements and other console outputs in real time.
- `-v`: Verbose mode. Provides detailed information about each test being run.


## Role-Based Access Control

Our application implements role-based access control (RBAC) using the `roles_required` decorator. This decorator is used to enforce access control on route handlers based on the user's roles.

### `roles_required` Decorator

#### Description

The `roles_required` decorator is a custom decorator used to restrict access to certain endpoints based on the user's roles. It ensures that only authenticated users with the required roles can access specific route handlers.

#### Usage

To use this decorator, import it from its module and apply it to any FastAPI route handler. Specify the required roles as arguments to the decorator.

#### Example

```python
from fastapi import APIRouter, HTTPException, Request
from your_module import roles_required
from .dependencies import get_async_db
from .schemas import OrganizationSchema
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

@router.get("/organizations/", response_model=list[OrganizationSchema])
@roles_required("Administrator", "Manager")
async def list_organizations(request: Request, db: AsyncSession = Depends(get_async_db)):
    # Your endpoint logic here
    ...
