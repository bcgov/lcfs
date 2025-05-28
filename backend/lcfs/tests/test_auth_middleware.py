from unittest.mock import AsyncMock, patch, MagicMock, Mock

import pytest
import json
import redis
from starlette.exceptions import HTTPException
from starlette.requests import Request
from redis.asyncio import Redis, ConnectionPool

from lcfs.db.models import UserProfile
from lcfs.services.keycloak.authentication import UserAuthentication
from lcfs.settings import Settings


@pytest.fixture
def redis_client():
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
def auth_backend(redis_client, session_generator, settings):
    return UserAuthentication(redis_client, session_generator[0], settings)


@pytest.mark.anyio
async def test_load_jwk_from_redis(auth_backend):
    # Mock auth_backend.redis_client.get to return a JSON string directly
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(
        return_value='{"jwks": "jwks_data", "jwks_uri": "jwks_uri_data"}'
    )

    # Patch Redis client in the auth backend
    with patch.object(auth_backend, "redis_client", mock_redis):
        await auth_backend.refresh_jwk()

        # Assertions to verify JWKS data was loaded correctly
        assert auth_backend.jwks == "jwks_data"
        assert auth_backend.jwks_uri == "jwks_uri_data"

        # Verify that Redis `get` was called with the correct key
        mock_redis.get.assert_awaited_once_with("jwks_data")


@pytest.mark.anyio
@patch("httpx.AsyncClient.get")
async def test_refresh_jwk_sets_new_keys_in_redis(mock_httpx_get, redis_client):
    # Mock responses for the well-known endpoint and JWKS URI
    mock_oidc_response = MagicMock()
    mock_oidc_response.json.return_value = {"jwks_uri": "https://example.com/jwks"}
    mock_oidc_response.raise_for_status = MagicMock()

    mock_certs_response = MagicMock()
    mock_certs_response.json.return_value = {
        "keys": [{"kty": "RSA", "kid": "key2", "use": "sig", "n": "def", "e": "AQAB"}]
    }
    mock_certs_response.raise_for_status = MagicMock()

    # Configure the mock to return the above responses in order
    mock_httpx_get.side_effect = [mock_oidc_response, mock_certs_response]

    # Mock Redis client behavior
    redis_client.get = AsyncMock(return_value=None)  # JWKS data not in cache
    redis_client.set = AsyncMock()

    # Create auth_backend with the mocked Redis client
    auth_backend = UserAuthentication(
        redis_client=redis_client,
        session_factory=AsyncMock(),
        settings=MagicMock(
            well_known_endpoint="https://example.com/.well-known/openid-configuration"
        ),
    )

    # Call refresh_jwk
    await auth_backend.refresh_jwk()

    # Assertions to verify JWKS data was fetched and set correctly
    expected_jwks = {
        "keys": [{"kty": "RSA", "kid": "key2", "use": "sig", "n": "def", "e": "AQAB"}]
    }
    assert auth_backend.jwks == expected_jwks
    assert auth_backend.jwks_uri == "https://example.com/jwks"

    # Verify that Redis `get` was called with "jwks_data"
    redis_client.get.assert_awaited_once_with("jwks_data")

    # Verify that the well-known endpoint was called twice
    assert mock_httpx_get.call_count == 2
    mock_httpx_get.assert_any_call(
        "https://example.com/.well-known/openid-configuration"
    )
    mock_httpx_get.assert_any_call("https://example.com/jwks")

    # Verify that Redis `set` was called with the correct parameters
    expected_jwks_data = {
        "jwks": expected_jwks,
        "jwks_uri": "https://example.com/jwks",
    }
    redis_client.set.assert_awaited_once_with(
        "jwks_data", json.dumps(expected_jwks_data), ex=86400
    )


@pytest.mark.anyio
async def test_authenticate_no_auth_header(auth_backend):
    request = MagicMock(spec=Request)
    request.headers = {}

    with pytest.raises(HTTPException) as exc_info:
        await auth_backend.authenticate(request)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Authorization header is required"
