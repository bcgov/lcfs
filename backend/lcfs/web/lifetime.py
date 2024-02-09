from typing import Awaitable, Callable

from fastapi import FastAPI
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from redis import asyncio as aioredis

from lcfs.services.redis.lifetime import init_redis, shutdown_redis
from lcfs.settings import settings
from lcfs.db import dependencies


def _setup_db(app: FastAPI) -> None:  # pragma: no cover
    """
    Creates connection to the database.

    This function creates SQLAlchemy engine instance,
    session_factory for creating sessions
    and stores them in the application's state property.

    :param app: fastAPI application.
    """
    engine = create_async_engine(str(settings.db_url), echo=settings.db_echo)
    session_factory = async_sessionmaker(
        engine,
        expire_on_commit=False,
    )
    app.state.db_engine = engine
    app.state.db_session_factory = session_factory


def register_startup_event(
    app: FastAPI,
) -> Callable[[], Awaitable[None]]:  # pragma: no cover
    """
    Actions to run on application startup.

    This function uses fastAPI app to store data
    in the state, such as db_engine.

    :param app: the fastAPI application.
    :return: function that actually performs actions.
    """

    @app.on_event("startup")
    async def _startup() -> None:  # noqa: WPS430
        # Set up database connections and session factory
        _setup_db(app)

        # Initialize Redis connection pool
        init_redis(app)

        # Assign settings to app state for global access
        app.state.settings = settings

        # Initialize the cache with Redis backend
        redis = aioredis.from_url(
            str(settings.redis_url), encoding="utf8", decode_responses=True
        )
        FastAPICache.init(RedisBackend(redis), prefix="lcfs")
        pass  # noqa: WPS420

    return _startup


def register_shutdown_event(
    app: FastAPI,
) -> Callable[[], Awaitable[None]]:  # pragma: no cover
    """
    Actions to run on application's shutdown.

    :param app: fastAPI application.
    :return: function that actually performs actions.
    """

    @app.on_event("shutdown")
    async def _shutdown() -> None:  # noqa: WPS430
        await app.state.db_engine.dispose()

        await shutdown_redis(app)
        pass  # noqa: WPS420

    return _shutdown
