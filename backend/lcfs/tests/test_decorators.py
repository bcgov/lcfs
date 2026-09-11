import pytest
from types import SimpleNamespace

from starlette.authentication import UnauthenticatedUser

from lcfs.web.core.decorators import (
    extract_context,
    repo_handler,
    request_var,
    service_handler,
    session_var,
    user_var,
)
from lcfs.web.exception.exceptions import DatabaseException, ServiceException


def set_user(user):
    """Seed the request-scoped context vars extract_context() reads."""
    user_var.set(user)
    request_var.set(None)
    session_var.set(None)


def call_extract_context():
    """Call extract_context() from a stack deep enough for its sys._getframe(3)."""

    def level_two():
        def level_three():
            return extract_context()

        return level_three()

    return level_two()


def test_extract_context_with_unauthenticated_user():
    """
    Public endpoints authenticate to UnauthenticatedUser, which is truthy but has
    no user_profile_id/role_names. extract_context runs inside the exception
    handlers, so raising here masks the error being logged.
    """
    set_user(UnauthenticatedUser())

    context = call_extract_context()

    assert context["user"] == {"id": None, "roles": []}


def test_extract_context_with_authenticated_user():
    set_user(SimpleNamespace(user_profile_id=42, role_names=["Government"]))

    context = call_extract_context()

    assert context["user"] == {"id": 42, "roles": ["Government"]}


def test_extract_context_with_no_user():
    set_user(None)

    context = call_extract_context()

    assert context["user"] == {"id": None, "roles": []}


@pytest.mark.anyio
async def test_service_handler_wraps_error_for_unauthenticated_user():
    """The original failure must reach the view layer as a ServiceException."""
    set_user(UnauthenticatedUser())

    @service_handler
    async def failing_service():
        raise RuntimeError("boom")

    with pytest.raises(ServiceException):
        await failing_service()


@pytest.mark.anyio
async def test_repo_handler_wraps_error_for_unauthenticated_user():
    set_user(UnauthenticatedUser())

    @repo_handler
    async def failing_repo():
        raise RuntimeError("boom")

    with pytest.raises(DatabaseException):
        await failing_repo()
