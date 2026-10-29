from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from starlette.authentication import AuthCredentials, UnauthenticatedUser
from starlette.requests import Request

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.user.Role import Role, RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.UserRole import UserRole
from lcfs.services.redis.dependency import get_redis_client
from lcfs.settings import settings
from lcfs.web.application import LazyAuthenticationBackend, get_app
from lcfs.web.core.decorators import view_handler

# Host headers that are not plain host names.
MALFORMED_HOSTS = [
    "test/api/health?",
    "test/api/health#",
    "test/api/release-notes/overrides?",
    "test/api/calculator/",
]


def make_request(path: str, method: str = "GET", host: str = None) -> Request:
    headers = [(b"host", host.encode("latin-1"))] if host is not None else []
    return Request({"type": "http", "method": method, "path": path, "headers": headers})


@pytest.mark.anyio
@pytest.mark.parametrize("host", MALFORMED_HOSTS)
async def test_skip_list_ignores_host_header(host):
    """The public skip-list matches the raw request path, whatever the Host."""
    backend = LazyAuthenticationBackend(app=MagicMock())
    request = make_request("/api/users/current", host=host)

    with pytest.raises(HTTPException) as exc_info:
        await backend.authenticate(request)

    assert exc_info.value.status_code == 401


@pytest.mark.anyio
async def test_skip_list_matches_whole_raw_path():
    """A path that only begins with a public path is not public."""
    backend = LazyAuthenticationBackend(app=MagicMock())
    request = make_request("/api/release-notes/overrides?x", method="PUT")

    with pytest.raises(HTTPException) as exc_info:
        await backend.authenticate(request)

    assert exc_info.value.status_code == 401


@pytest.mark.anyio
async def test_public_path_still_skips_auth_with_ordinary_host():
    backend = LazyAuthenticationBackend(app=MagicMock())
    request = make_request("/api/health", host="lowcarbonfuels.gov.bc.ca")

    credentials, user = await backend.authenticate(request)

    assert isinstance(user, UnauthenticatedUser)
    assert credentials.scopes == []


def make_user_request(user) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/test",
            "headers": [],
            "user": user,
            "auth": AuthCredentials([]),
        }
    )


def make_user_profile(*roles: RoleEnum) -> UserProfile:
    user = UserProfile(user_profile_id=1, organization_id=1)
    user.user_roles = [UserRole(role=Role(name=role)) for role in roles]
    return user


@pytest.mark.anyio
@pytest.mark.parametrize("required_roles", [["*"], [RoleEnum.GOVERNMENT]])
async def test_view_handler_rejects_unauthenticated_user(required_roles):
    """Every role list, including ["*"], requires a signed-in user profile."""
    endpoint = AsyncMock(return_value="reached")
    wrapped = view_handler(required_roles)(endpoint)

    with pytest.raises(HTTPException) as exc_info:
        await wrapped(make_user_request(UnauthenticatedUser()))

    assert exc_info.value.status_code == 401
    endpoint.assert_not_awaited()


@pytest.mark.anyio
async def test_view_handler_wildcard_admits_user_profile():
    endpoint = AsyncMock(return_value="reached")
    wrapped = view_handler(["*"])(endpoint)

    result = await wrapped(make_user_request(make_user_profile()))

    assert result == "reached"


@pytest.mark.anyio
async def test_view_handler_role_list_admits_matching_user_profile():
    endpoint = AsyncMock(return_value="reached")
    wrapped = view_handler([RoleEnum.GOVERNMENT])(endpoint)

    result = await wrapped(make_user_request(make_user_profile(RoleEnum.GOVERNMENT)))

    assert result == "reached"


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


@pytest.mark.anyio
async def test_protected_wildcard_route_requires_token(anonymous_client):
    response = await anonymous_client.get("/api/users/current")

    assert response.status_code == 401


@pytest.mark.anyio
@pytest.mark.parametrize("host", MALFORMED_HOSTS)
async def test_protected_wildcard_route_requires_token_with_malformed_host(
    anonymous_client, host
):
    response = await anonymous_client.get("/api/users/current", headers={"Host": host})

    assert response.status_code == 401


@pytest.mark.anyio
@pytest.mark.parametrize(
    "path",
    [
        # Public for GET; DELETE is a System Admin route.
        "/api/release-notes/overrides",
        "/api/release-notes/overrides%3Fx",
    ],
)
async def test_protected_route_behind_public_path_requires_token(
    anonymous_client, path
):
    """Anonymous callers get 401 from admin routes that share a public path."""
    response = await anonymous_client.delete(path)

    assert response.status_code == 401


@pytest.mark.anyio
async def test_public_route_still_reachable_without_token(anonymous_client):
    response = await anonymous_client.get("/api/health")

    assert response.status_code == 200
