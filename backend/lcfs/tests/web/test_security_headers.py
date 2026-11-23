"""Regression tests for LCFS-SEC-024: X-Content-Type-Options on API responses."""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from lcfs.db.dependencies import get_async_db_session
from lcfs.services.redis.dependency import get_redis_client
from lcfs.settings import settings
from lcfs.web.application import get_app

pytestmark = pytest.mark.anyio


@pytest.fixture
def real_auth_app(dbsession, dbsession_factory, fake_redis_client) -> FastAPI:
    """The application with its real authentication middleware, not the mock."""
    application = get_app()
    application.dependency_overrides[get_async_db_session] = lambda: dbsession
    application.dependency_overrides[get_redis_client] = lambda: fake_redis_client
    application.state.redis_client = fake_redis_client
    application.state.db_session_factory = dbsession_factory
    application.state.settings = settings
    return application


@pytest.fixture
async def anonymous_client(real_auth_app, anyio_backend):
    async with AsyncClient(
        transport=ASGITransport(app=real_auth_app), base_url="http://test"
    ) as ac:
        yield ac


async def test_successful_response_sets_nosniff(anonymous_client):
    """A normal, successful API response carries X-Content-Type-Options."""
    response = await anonymous_client.get("/api/health")

    assert response.status_code == 200
    assert response.headers["X-Content-Type-Options"] == "nosniff"


async def test_unauthenticated_error_response_sets_nosniff(anonymous_client):
    """401 responses raised via the authentication middleware still get the header."""
    response = await anonymous_client.get("/api/users/current")

    assert response.status_code == 401
    assert response.headers["X-Content-Type-Options"] == "nosniff"
