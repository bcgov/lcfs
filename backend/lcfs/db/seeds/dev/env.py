import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio.engine import create_async_engine
from sqlalchemy.future import Connection

from lcfs.db.models import load_all_models
from lcfs.settings import settings
from lcfs.db.base import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

load_all_models()

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata object for 'autogenerate' support in seed migrations
target_metadata = Base.metadata

def include_object(object, name, type_, reflected, compare_to):
    # List of tables to be ignored
    ignored_tables = {
        "alembic_version_seeds_dev",
        "alembic_version_seeds_prod",
        "alembic_version_seeds_common",
        "alembic_version"
    }

    if type_ == "table" and name in ignored_tables:
        return False
    else:
        return True

async def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    context.configure(
        url=str(settings.db_url),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table='alembic_version_seeds_dev',
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection) -> None:
    """Run actual sync migrations."""
    context.configure(
        connection=connection, 
        target_metadata=target_metadata,
        version_table='alembic_version_seeds_dev',
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = create_async_engine(str(settings.db_url))

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

loop = asyncio.get_event_loop()
if context.is_offline_mode():
    task = run_migrations_offline()
else:
    task = run_migrations_online()

loop.run_until_complete(task)
