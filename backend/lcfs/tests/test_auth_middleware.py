import jwt
import json
import base64
from jwt import PyJWKClient
import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import Response
from starlette.status import HTTP_401_UNAUTHORIZED, HTTP_200_OK
from lcfs.services.keycloak.authentication import UserAuthentication
from lcfs.db.models.user.UserProfile import UserProfile
from fastapi import HTTPException
from lcfs.settings import settings
from sqlalchemy.ext.asyncio import AsyncSession
from jwt import ExpiredSignatureError
from unittest.mock import patch

# Mock for JWKS client
@pytest.fixture
def mock_jwks_client():
    client = MagicMock()
    client.get_signing_key_from_jwt = MagicMock()
    return client

# Fixture for the UserAuthentication backend
@pytest.fixture
def user_auth_backend(fake_redis_pool, dbsession_factory, mock_jwks_client):
    backend = UserAuthentication(redis_pool=fake_redis_pool, session=dbsession_factory, settings=settings)
    backend.test_mode = True
    backend.jwks_client = mock_jwks_client  # Replace JWKS client with a mock
    return backend


@pytest.mark.anyio
async def test_successful_authentication(user_auth_backend, dbsession_factory):
    # Mock token and user profile
    token = "valid.jwt.token"

    # Set test user 
    user_auth_backend.test_keycloak_user = {
        'preferred_username': 'idiruser@idir',
        'idir_username': 'IDIRUSER',
        'email': 'idir@test.com',
        'identity_provider': 'idir',
    }

    # Simulate request
    request = MagicMock()
    request.headers.get.return_value = f"Bearer {token}"

    # Perform authentication
    credentials, user = await user_auth_backend.authenticate(request)

    assert credentials.scopes == ["authenticated"]


# @pytest.mark.anyio
# async def test_token_expired(user_auth_backend):
#     # Create a mock header with a 'kid'
#     header = json.dumps({"alg": "HS256", "typ": "JWT", "kid": "test-key-id"})
#     payload = json.dumps({"sub": "1234567890"})

#     # Base64 URL encode the header, payload, and a dummy signature
#     encoded_header = base64.urlsafe_b64encode(header.encode()).decode().rstrip("=")
#     encoded_payload = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
#     encoded_signature = base64.urlsafe_b64encode(b'dummysignature').decode().rstrip("=")

#     # Combine the segments
#     mock_jwt_token = f"{encoded_header}.{encoded_payload}.{encoded_signature}"

#     request = MagicMock()
#     request.headers.get.return_value = f"Bearer {mock_jwt_token}"

#     # Mock the JWKS client to prevent actual key retrieval
#     with patch.object(user_auth_backend.jwks_client, 'get_signing_key_from_jwt', return_value="mocked_key"):
#         with patch('jwt.decode', side_effect=jwt.ExpiredSignatureError('Token has expired')):
#             with pytest.raises(HTTPException) as exc_info:
#                 await user_auth_backend.authenticate(request)

#     assert exc_info.value.status_code == 401
#     assert 'Token has expired' in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_keycloak_user_not_found(user_auth_backend, dbsession_factory):
    token = "valid.jwt.token"
    request = MagicMock()
    request.headers.get.return_value = f"Bearer {token}"

    # Set test user 
    user_auth_backend.test_keycloak_user = {
        'preferred_username': 'random_lcfs1',
        'idir_username': 'random_lcfs1',
        'email': 'random_lcfs1@gov.bc.ca',
        'identity_provider': 'idir',
    }

    with pytest.raises(HTTPException) as exc_info:
        await user_auth_backend.authenticate(request)

    assert exc_info.value.status_code == HTTP_401_UNAUTHORIZED
    assert 'No User with that configuration exists.' in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_active_user_authentication(user_auth_backend, dbsession_factory):
    token = "valid.jwt.token"

    # Simulate request with JWT token
    request = MagicMock()
    request.headers.get.return_value = f"Bearer {token}"

    # Set test user 
    user_auth_backend.test_keycloak_user = {
        'preferred_username': 'activeuser@bceidbusiness',
        'bceid_username': 'ACTIVEUSER',
        'email': 'active@test.com',
        'identity_provider': 'bceidbusiness',
    }

    # Perform authentication
    credentials, user = await user_auth_backend.authenticate(request)

    assert credentials.scopes == ["authenticated"]
    assert user.is_active is True


@pytest.mark.anyio
async def test_inactive_user_authentication(user_auth_backend, dbsession_factory):
    token = "valid.jwt.token"

    # Simulate request with JWT token
    request = MagicMock()
    request.headers.get.return_value = f"Bearer {token}"

    # Set test user 
    user_auth_backend.test_keycloak_user = {
        'preferred_username': 'inactiveuser@bceidbusiness',
        'bceid_username': 'INACTIVEUSER',
        'email': 'inactive@test.com',
        'identity_provider': 'bceidbusiness',
    }

    # Perform authentication and expect an HTTPException for inactive user
    with pytest.raises(HTTPException) as exc_info:
        await user_auth_backend.authenticate(request)

    assert exc_info.value.status_code == HTTP_401_UNAUTHORIZED
    assert 'The account is currently inactive.' in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_idir_identity_provider_authentication(user_auth_backend, dbsession_factory):
    token = "valid.jwt.token"

    # Simulate request with JWT token
    request = MagicMock()
    request.headers.get.return_value = f"Bearer {token}"

    # Set test user 
    user_auth_backend.test_keycloak_user = {
        'preferred_username': 'idiruser@idir',
        'idir_username': 'IDIRUSER',
        'email': 'idir@test.com',
        'identity_provider': "idir", 
    }

    # Perform authentication for idir identity provider
    credentials, user = await user_auth_backend.authenticate(request)

    assert credentials.scopes == ["authenticated"]
    assert user.organization_id is None


@pytest.mark.anyio
async def test_bceidbusiness_identity_provider_authentication(user_auth_backend, dbsession_factory):
    token = "valid.jwt.token"

    # Simulate request with JWT token
    request = MagicMock()
    request.headers.get.return_value = f"Bearer {token}"

    # Set test user 
    user_auth_backend.test_keycloak_user = {
        'preferred_username': 'bceiduser@bceidbusiness',
        'bceid_username': 'BCEIDUSER',
        'email': 'bceid@test.com',
        'identity_provider': "bceidbusiness", 
    }

    # Perform authentication for bceidbusiness identity provider
    credentials, user = await user_auth_backend.authenticate(request)

    assert credentials.scopes == ["authenticated"]
    assert user.organization_id is not None


@pytest.mark.anyio
async def test_unknown_identity_provider_authentication(user_auth_backend):
    token = "valid.jwt.token"

    # Simulate request with JWT token
    request = MagicMock()
    request.headers.get.return_value = f"Bearer {token}"

    # Set test user 
    user_auth_backend.test_keycloak_user = {
        'preferred_username': 'unknownuser',
        'idir_username': 'IDIRUSER',
        'email': 'user@test.com',
        'identity_provider': "unknown", 
    }

    # Perform authentication for an unknown identity provider and expect an HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await user_auth_backend.authenticate(request)

    # assert exc_info.value.status_code == HTTP_401_UNAUTHORIZED
    assert 'Unknown or missing identity provider' in str(exc_info.value.detail)

