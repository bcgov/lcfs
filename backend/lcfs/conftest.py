import warnings
import os
import structlog

# Suppress the PendingDeprecationWarning for multipart
warnings.filterwarnings(
    "ignore",
    message="Please use `import python_multipart` instead.",
    category=PendingDeprecationWarning,
)
import subprocess
import warnings
from typing import Any, AsyncGenerator, List, Callable

import pytest
from fakeredis import FakeServer, aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from starlette.authentication import AuthCredentials, AuthenticationBackend
from starlette.middleware.authentication import AuthenticationMiddleware

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.user.Role import Role
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.UserRole import UserRole
from lcfs.db.seeders.seed_database import seed_database
from lcfs.db.utils import create_test_database, drop_test_database
from lcfs.services.redis.dependency import get_redis_client
from lcfs.settings import settings
from lcfs.web.application import get_app


logger = structlog.get_logger(__name__)


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
    try:
        subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=f"{os.getcwd()}",
            check=True,
        )
    except Exception as e:
        logger.error(
            "Error running migrations",
            error=str(e),
            exc_info=e,
        )
        raise

    # Create AsyncEngine instance
    engine = create_async_engine(str(settings.db_test_url))

    # Seed the database with test data
    await seed_database("test")

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
    async with _engine.begin() as connection:
        session_maker = async_sessionmaker(
            connection,
            expire_on_commit=False,
        )
        session = session_maker()

        # Add test user info into the session
        user_info = UserProfile(
            user_profile_id=1, keycloak_username="test_user", organization_id=1
        )  # Mocked user ID

        session.info["user"] = user_info

        try:
            yield session
        finally:
            # Rolling back the session here prevents data persistence,
            # which causes issues for tests that depend on others.
            await session.rollback()
            await session.close()


@pytest.fixture
async def fake_redis_client() -> AsyncGenerator[aioredis.FakeRedis, None]:
    """
    Get instance of a fake Redis client.

    :yield: FakeRedis client instance.
    """
    server = FakeServer()
    server.connected = True
    redis_client = aioredis.FakeRedis(server=server, decode_responses=True)

    try:
        yield redis_client
    finally:
        await redis_client.close()


@pytest.fixture
async def dbsession_factory(
    _engine: AsyncEngine,
) -> Callable[[], AsyncGenerator[AsyncSession, None]]:
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
    fake_redis_client: aioredis.FakeRedis,
    set_mock_user,  # Fixture for setting up mock authentication
    user_roles: List[RoleEnum] = [RoleEnum.ADMINISTRATOR],  # Default role
) -> FastAPI:
    # Create the FastAPI application instance
    application = get_app()
    application.dependency_overrides[get_async_db_session] = lambda: dbsession
    application.dependency_overrides[get_redis_client] = lambda: fake_redis_client

    # Set up application state for testing
    application.state.redis_client = fake_redis_client
    application.state.settings = settings

    # Set up mock authentication backend with the specified roles
    set_mock_user(application, user_roles)

    # Initialize the cache with fake Redis backend
    FastAPICache.init(RedisBackend(fake_redis_client), prefix="lcfs")

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
    def __init__(self, user_roles: List[RoleEnum], user_details: dict):
        """
        Initialize mock authentication backend with user details from a dictionary.

        Args:
            user_roles (List[RoleEnum]): List of user roles.
            user_details (dict): A dictionary containing customizable user attributes (username, email, etc.).
        """
        # Convert list of role names (strings) to RoleEnum members
        self.user_roles_enum = user_roles
        self.role_count = 0

        # Use the provided user details
        self.user_profile_id = user_details["user_profile_id"]
        self.keycloak_username = user_details["keycloak_username"]
        self.keycloak_email = user_details["keycloak_email"]
        self.username = user_details["username"]
        self.organization_id = user_details["organization_id"]
        self.email = user_details["email"]
        self.first_name = user_details["first_name"]
        self.last_name = user_details["last_name"]
        self.is_active = user_details["is_active"]
        self.organization_name = user_details["organization_name"]

    async def authenticate(self, request):
        # Simulate a user object based on the role
        user = UserProfile(
            user_profile_id=self.user_profile_id,
            keycloak_username=self.keycloak_username,
            keycloak_email=self.keycloak_email,
            organization_id=self.organization_id,
            email=self.email,
            first_name=self.first_name,
            last_name=self.last_name,
            is_active=self.is_active,
        )

        organization = Organization(
            organization_id=self.organization_id, name=self.organization_name
        )
        user.organization = organization

        # Create UserRole instances based on the RoleEnum members provided
        user.user_roles = [
            self.create_user_role(user, role_enum) for role_enum in self.user_roles_enum
        ]

        return AuthCredentials(["authenticated"]), user

    def create_user_role(self, user_profile, role_enum):
        role = Role(
            role_id=self.role_count,
            name=role_enum,
            description=f"Mocked role for {role_enum}",
            is_government_role=role_enum
            in [RoleEnum.GOVERNMENT, RoleEnum.ANALYST, RoleEnum.ADMINISTRATOR],
        )
        user_role = UserRole(
            user_role_id=self.role_count, user_profile=user_profile, role=role
        )
        self.role_count += 1
        return user_role


@pytest.fixture
def set_mock_user():
    def _set_mock_auth(
        application: FastAPI, roles: List[RoleEnum], user_details: dict = None
    ):
        """
        Fixture to mock user authentication with customizable user details.

        Args:
            application (FastAPI): The FastAPI application instance.
            roles (List[RoleEnum]): The roles to be assigned to the user.
            user_details (dict): A dictionary containing customizable user attributes (username, email, etc.).
        """
        default_user_details = {
            "user_profile_id": 1,
            "keycloak_username": "mockuser",
            "keycloak_email": "test@test.com",
            "username": "mockuser",
            "organization_id": 1,
            "email": "test@test.com",
            "first_name": "Test",
            "last_name": "User",
            "is_active": True,
            "organization_name": "Test Organization",
        }

        # Merge default values with provided user details
        user_details = {**default_user_details, **(user_details or {})}

        # Clear existing middleware
        application.user_middleware = []

        # Add necessary middleware for testing, excluding LazyAuthenticationBackend
        application.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        )

        # Add the Mock Authentication Middleware
        mock_auth_backend = MockAuthenticationBackend(
            user_roles=roles, user_details=user_details
        )
        application.add_middleware(AuthenticationMiddleware, backend=mock_auth_backend)

    return _set_mock_auth


@pytest.fixture
async def add_models(dbsession):
    """
    Fixture to add and flush a list of model instances to the database.

    Args:
        dbsession: The active database session for transaction management.

    Returns:
        A function that takes a list of models and flushes them to the database. It includes
        error handling to manage any exceptions that occur during database operations.
    """

    async def _add(models):
        try:
            dbsession.add_all(models)
            await dbsession.flush()
        except Exception as e:
            logger.error(
                "Error adding models to the database",
                error=str(e),
                exc_info=e,
            )
            await dbsession.rollback()
            raise

    return _add


@pytest.fixture
async def update_model(dbsession):
    """
    Fixture to update and flush a model instance to the database.

    Args:
        dbsession: The active database session for transaction management.

    Returns:
        A function that takes a model instance, updates it in the database, and handles exceptions.
    """

    async def _update(model):
        try:
            dbsession.add(model)
            await dbsession.flush()
        except Exception as e:
            logger.error(
                "Error updating models to the database",
                error=str(e),
                exc_info=e,
            )
            await dbsession.rollback()
            raise

    return _update


@pytest.fixture(autouse=True)
def ignore_specific_warnings():
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore", message="This endpoint is accessible by all roles"
        )
        warnings.filterwarnings("ignore", category=DeprecationWarning)
        # Add more specific warnings to ignore as needed
        yield
