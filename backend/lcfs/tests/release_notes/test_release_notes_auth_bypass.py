import pytest
from unittest.mock import MagicMock

from fastapi import HTTPException
from starlette.authentication import UnauthenticatedUser
from starlette.requests import Request

from lcfs.web.application import LazyAuthenticationBackend


def make_request(path: str, method: str = "GET") -> Request:
    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "headers": [],
    }
    return Request(scope)


@pytest.mark.anyio
@pytest.mark.parametrize(
    "path",
    [
        "/api/release-notes/overrides",
        "/api/release-notes/overrides/",
    ],
)
async def test_release_note_overrides_endpoint_bypasses_authentication(path):
    """
    The release notes page is public (no login required), so every viewer
    needs the overrides list without an Authorization header, exactly like
    the auto-generated release-notes.json static asset.
    """
    backend = LazyAuthenticationBackend(app=MagicMock())
    request = make_request(path)

    credentials, user = await backend.authenticate(request)

    assert isinstance(user, UnauthenticatedUser)
    assert credentials.scopes == []


@pytest.mark.anyio
async def test_release_note_update_endpoint_requires_authentication():
    """
    Unlike the public overrides list, editing a release note must never
    bypass authentication -- it is a System Admin only action.
    """
    backend = LazyAuthenticationBackend(app=MagicMock())
    request = make_request("/api/release-notes/1.3.6", method="PUT")

    with pytest.raises(HTTPException) as exc_info:
        await backend.authenticate(request)

    assert exc_info.value.status_code == 401
