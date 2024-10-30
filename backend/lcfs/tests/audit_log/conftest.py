# conftest.py
from starlette.authentication import AuthenticationBackend, AuthCredentials, SimpleUser
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.authentication import AuthCredentials, AuthenticationBackend, BaseUser
from fastapi import FastAPI
import pytest

class MockAuthBackend(AuthenticationBackend):
    def __init__(self):
        self.roles = []

    async def authenticate(self, request):
        if self.roles:
            # Use MockUser with roles instead of SimpleUser
            return AuthCredentials(["authenticated"]), MockUser("mock_user", self.roles)
        return None


class MockUser(BaseUser):
    def __init__(self, username: str, roles: list):
        self.username = username
        self.roles = roles

    @property
    def is_authenticated(self) -> bool:
        return True

@pytest.fixture
def mock_user_role(fastapi_app: FastAPI):
    auth_backend = MockAuthBackend()  # Initialize the backend instance
    fastapi_app.add_middleware(AuthenticationMiddleware, backend=auth_backend)  # Add middleware once

    def set_roles(roles):
        auth_backend.roles = roles  # Update roles directly on the existing backend

    yield set_roles  # Provide the function to the tests for role setting
