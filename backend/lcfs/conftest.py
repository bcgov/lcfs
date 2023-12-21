from typing import Any, AsyncGenerator, List, Callable

import pytest
import subprocess
import logging
from fakeredis import FakeServer
from starlette.authentication import SimpleUser, AuthCredentials, AuthenticationBackend
from starlette.middleware.authentication import AuthenticationMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from httpx import AsyncClient
from fakeredis.aioredis import FakeConnection
from redis.asyncio import ConnectionPool
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from lcfs.db.dependencies import get_db_session, get_async_db_session
from lcfs.db.utils import create_test_database, drop_test_database
from lcfs.services.redis.dependency import get_redis_pool
from lcfs.settings import settings
from lcfs.web.application import get_app
from lcfs.db.seeders.seed_database import seed_database
from lcfs.db.models.Role import RoleEnum

logging.getLogger('faker').setLevel(logging.INFO)


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    """
    Backend for anyio pytest plugin.

    :return: backend name.
    """
    return "asyncio"


@pytest.fixture(scope="session")
async def _engine() -> AsyncGenerator[AsyncEngine, None]:
    """
    Create engine and run Alembic migrations.

    :yield: new engine.
    """
    # Create the test database
    await create_test_database()

    # Run Alembic migrations
    subprocess.run(["alembic", "upgrade", "head"], check=True)  

    # Create AsyncEngine instance
    engine = create_async_engine(str(settings.db_test_url))

    # Seed the database with test data
    await seed_database('test')

    try:
        yield engine
    finally:
        await engine.dispose()
        await drop_test_database()


@pytest.fixture
async def dbsession(
    _engine: AsyncEngine,
) -> AsyncGenerator[AsyncSession, None]:
    """
    Get session to database.

    Fixture that returns a SQLAlchemy session with a SAVEPOINT, and the rollback to it
    after the test completes.

    :param _engine: current engine.
    :yields: async session.
    """
    connection = await _engine.connect()
    trans = await connection.begin()

    session_maker = async_sessionmaker(
        connection,
        expire_on_commit=False,
    )
    session = session_maker()

    try:
        yield session
    finally:
        await session.close()
        await trans.rollback()
        await connection.close()


@pytest.fixture
async def fake_redis_pool() -> AsyncGenerator[ConnectionPool, None]:
    """
    Get instance of a fake redis.

    :yield: FakeRedis instance.
    """
    server = FakeServer()
    server.connected = True
    pool = ConnectionPool(connection_class=FakeConnection, server=server)

    yield pool

    await pool.disconnect()


@pytest.fixture
async def dbsession_factory(_engine: AsyncEngine) -> Callable[[], AsyncGenerator[AsyncSession, None]]:
    """
    Get a factory function for database sessions.

    :param _engine: current engine.
    :return: A factory function that returns an async session.
    """
    session_factory = async_sessionmaker(
        _engine,
        expire_on_commit=False,
    )
    return session_factory


@pytest.fixture
def fastapi_app(
    dbsession: AsyncSession,
    fake_redis_pool: ConnectionPool,
    set_mock_user_roles,  # Fixture for setting up mock authentication
    user_roles: List[str] = ["Administrator"]  # Default role
) -> FastAPI:
    # Create the FastAPI application instance
    application = get_app()
    application.dependency_overrides[get_async_db_session] = lambda: dbsession
    application.dependency_overrides[get_redis_pool] = lambda: fake_redis_pool
    
    # Set up application state for testing
    application.state.redis_pool = fake_redis_pool
    # application.state.db_session_factory = test_session_factory
    application.state.settings = settings

    # Set up mock authentication backend with the specified roles
    set_mock_user_roles(application, user_roles)

    return application
  

@pytest.fixture
async def client(
    fastapi_app: FastAPI,
    anyio_backend: Any,
) -> AsyncGenerator[AsyncClient, None]:
    """
    Fixture that creates client for requesting server.

    :param fastapi_app: the application.
    :yield: client for the app.
    """
    async with AsyncClient(app=fastapi_app, base_url="http://test") as ac:
        yield ac


def role_enum_member(role_name):
    for role in RoleEnum:
        if role.value == role_name:
            return role
    raise ValueError(f"Invalid role name: {role_name}")

class MockAuthenticationBackend(AuthenticationBackend):
    def __init__(self, user_roles: List[str]):
        # Convert role names to RoleEnum members
        self.user_roles = [role_enum_member(role) for role in user_roles]

    async def authenticate(self, request):
        # Simulate a user object based on the role
        user = SimpleUser(username="testuser")
        user.email = "test@test.com"
        user.user_roles = self.user_roles
        return AuthCredentials(["authenticated"]), user


@pytest.fixture
def set_mock_user_roles():
    def _set_mock_auth(application: FastAPI, roles: List[str]):
        # Clear existing middleware
        application.user_middleware = []

        # Add necessary middleware for testing, excluding LazyAuthenticationBackend
        application.add_middleware(
            CORSMiddleware, 
            allow_origins=["*"], 
            allow_methods=["*"], 
            allow_headers=["*"]
        )

        # Add the Mock Authentication Middleware
        mock_auth_backend = MockAuthenticationBackend(user_roles=roles)
        application.add_middleware(
            AuthenticationMiddleware, 
            backend=mock_auth_backend
        )

    return _set_mock_auth