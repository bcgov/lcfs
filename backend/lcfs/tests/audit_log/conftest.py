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
    auth_backend = MockAuthBackend()  # Create a single instance of MockAuthBackend

    # Add middleware only if it hasn't been added already
    if not any(isinstance(middleware, AuthenticationMiddleware) for middleware in fastapi_app.user_middleware):
        fastapi_app.add_middleware(AuthenticationMiddleware, backend=auth_backend)

    def set_roles(roles):
        auth_backend.roles = roles  # Persist roles across requests

    yield set_roles  # Yield the role-setting function for use in tests
