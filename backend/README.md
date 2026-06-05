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
├── services  # Package for different external services such as redis, S3, CHES, etc.
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

All environment variables should start with "LCFS\_" prefix.

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

- black (formats your code);
- mypy (validates types);
- isort (sorts imports in all files);
- flake8 (spots possibe bugs);

You can read more about pre-commit here: https://pre-commit.com/

## Rate limiting

Public (unauthenticated) endpoints are protected by a Redis-backed
fixed-window rate limiter that shares state across every replica via
the existing `redis_url` connection. The limiter is wired into the
`public_view_handler` decorator, so any route decorated with it is
automatically capped at the global default
(`LCFS_RATE_LIMIT_DEFAULT_TIMES` requests per
`LCFS_RATE_LIMIT_DEFAULT_SECONDS` seconds, default `60 / 60`).

Routes decorated with `view_handler` (i.e. all authenticated routes)
are **not** rate-limited by default. Health (`/api/health`) and
Prometheus (`/metrics`) endpoints are also exempt because they do not
use `public_view_handler`.

### Tighten a public route

```python
from lcfs.web.core.decorators import public_view_handler
from lcfs.web.core.rate_limit import RateLimit

@router.post("/expensive-export")
@public_view_handler(rate_limit=RateLimit(times=5, seconds=60))
async def expensive_export(request: Request, ...):
    ...
```

### Key on user instead of IP (for authenticated public-ish routes)

```python
@public_view_handler(rate_limit=RateLimit(times=30, seconds=60, scope="user"))
```

`scope="user"` falls back to the IP when the request is anonymous.

### Opt a route out entirely

```python
from lcfs.web.core.rate_limit import RATE_LIMIT_EXEMPT

@public_view_handler(rate_limit=RATE_LIMIT_EXEMPT)
async def cheap_endpoint(...):
    ...
```

### Tuning knobs (env vars)

| Variable                          | Default | Purpose                                                                                                                         |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `LCFS_RATE_LIMIT_ENABLED`         | `True`  | Master kill-switch.                                                                                                             |
| `LCFS_RATE_LIMIT_DEFAULT_TIMES`   | `60`    | Global per-window cap.                                                                                                          |
| `LCFS_RATE_LIMIT_DEFAULT_SECONDS` | `60`    | Global window size, in seconds.                                                                                                 |

The limiter keys on `request.client.host`, which Uvicorn populates from
`X-Forwarded-For` because the app is started with `--proxy-headers
--forwarded-allow-ips="*"` (see `lcfs/__main__.py`). That `*` is safe
only under the assumption that LCFS pods are never directly reachable
from the internet — the OpenShift router is the only possible TCP peer.
If a pod is ever exposed via a NodePort/LoadBalancer that bypasses the
router, tighten `forwarded_allow_ips` to the router subnet or header
spoofing becomes trivial.

The limiter is best-effort: if Redis is unreachable the request is
allowed through and a warning is logged, rather than failing closed.

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
- `-v`: Verbose mode. Provides detailed information about each test being run...
