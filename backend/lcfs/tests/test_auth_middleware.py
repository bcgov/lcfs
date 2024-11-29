from unittest.mock import AsyncMock, patch, MagicMock, Mock

import pytest
import asyncio
from starlette.exceptions import HTTPException
from starlette.requests import Request

from lcfs.db.models import UserProfile
from lcfs.services.keycloak.authentication import UserAuthentication
from lcfs.settings import Settings


@pytest.fixture
def redis_pool():
    return AsyncMock()


@pytest.fixture
def session_generator():
    async_context = MagicMock()
    return async_context


@pytest.fixture
def settings():
    return Settings(
        well_known_endpoint="https://example.com/.well-known/openid-configuration",
        keycloak_audience="your-audience",
    )


@pytest.fixture
def auth_backend(redis_pool, session_generator, settings):
    return UserAuthentication(redis_pool, session_generator[0], settings)


@pytest.mark.anyio
async def test_load_jwk_from_redis(auth_backend):
    # Mock auth_backend.redis_pool.get to return a JSON string directly
    with patch.object(auth_backend.redis_pool, "get", new_callable=AsyncMock) as mock_redis_get:
        mock_redis_get.return_value = '{"jwks": "jwks", "jwks_uri": "jwks_uri"}'

        await auth_backend.refresh_jwk()

        assert auth_backend.jwks == "jwks"
        assert auth_backend.jwks_uri == "jwks_uri"


@pytest.mark.anyio
@patch("httpx.AsyncClient.get")
async def test_refresh_jwk_sets_new_keys_in_redis(mock_get, auth_backend):
    # Create a mock response object
    mock_response = MagicMock()

    # Set up the json method to return a dictionary with a .get method
    mock_json = MagicMock()
    mock_json.get.return_value = "{}"

    # Assign the mock_json to the json method of the response
    mock_response.json.return_value = mock_json

    mock_response_2 = MagicMock()
    mock_response_2.json.return_value = "{}"

    mock_get.side_effect = [
        mock_response,
        mock_response_2,
    ]

    with patch.object(auth_backend.redis_pool, "get", new_callable=AsyncMock) as mock_redis_get:
        mock_redis_get.return_value = None

        await auth_backend.refresh_jwk()



@pytest.mark.anyio
async def test_authenticate_no_auth_header(auth_backend):
    request = MagicMock(spec=Request)
    request.headers = {}

    with pytest.raises(HTTPException) as exc_info:
        await auth_backend.authenticate(request)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Authorization header is required"


@pytest.mark.anyio
async def test_map_user_keycloak_id(auth_backend, session_generator):
    user_profile = UserProfile()
    user_token = {"preferred_username": "testuser"}

    await auth_backend.map_user_keycloak_id(user_profile, user_token)

    assert user_profile.keycloak_user_id == "testuser"
