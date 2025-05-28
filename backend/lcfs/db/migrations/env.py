import asyncio
import alembic_postgresql_enum
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio.engine import create_async_engine
from sqlalchemy.future import Connection

from lcfs.db.meta import meta
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

# Add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# Exclude specific tables (views and materialized views) from autogenerate
exclude_tables = [
    "mv_transaction_aggregate",
    "mv_transaction_count",
    "mv_director_review_transaction_count",
    "mv_org_compliance_report_count",
    "transaction_status_view",
    "mv_compliance_report_count",
    "mv_fuel_code_count",
]


def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table" and name in exclude_tables:
        # Exclude these tables from autogenerate
        return False
    else:
        return True


async def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well. By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    context.configure(
        url=str(settings.db_url),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        transaction_per_migration=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """
    Run actual sync migrations.

    :param connection: connection to the database.
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
        transaction_per_migration=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    connectable = create_async_engine(str(settings.db_url))

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)


if context.is_offline_mode():
    run_migrations_offline()
else:
    try:
        # This will raise if there's already a running loop (e.g., in pytest)
        asyncio.run(run_migrations_online())
    except RuntimeError as e:
        if "asyncio.run() cannot be called from a running event loop" in str(e):
            # Fallback: Schedule task directly on the running loop (pytest/anyio case)
            loop = asyncio.get_event_loop()
            loop.create_task(run_migrations_online())
        else:
            raise
