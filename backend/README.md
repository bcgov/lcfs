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



## Running tests

For running tests on your local machine.
1. you need to start a database, ideally with the docker-compose.

2. Run the pytest.
```bash
pytest -vv .
```
