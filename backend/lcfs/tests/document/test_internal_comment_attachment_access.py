"""Unit tests for DocumentService.verify_internal_comment_access.

Attachment access "matches comment permissions" (issue #4514):
  * write (add/remove attachment): comment author only
  * read (list/download): government staff see all; everyone else only Public
    comments, on a compliance report or CI application belonging to their own
    organization
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService


def _service_with_comment(comment, owner_organization_ids=()):
    """Build a DocumentService with a mocked db.

    ``get()`` returns the comment; ``execute()`` stands in for the live
    lookup of the organizations owning the comment's readable entities.
    """
    rows = [(organization_id,) for organization_id in owner_organization_ids]
    service = DocumentService.__new__(DocumentService)
    service.db = SimpleNamespace(
        get=AsyncMock(return_value=comment),
        execute=AsyncMock(return_value=SimpleNamespace(all=lambda: rows)),
    )
    return service


def _comment(create_user="author", visibility="Internal"):
    return SimpleNamespace(create_user=create_user, visibility=visibility)


def _user(username="author", roles=None, organization_id=None):
    return SimpleNamespace(
        keycloak_username=username,
        role_names=roles if roles is not None else [],
        organization_id=organization_id,
    )


@pytest.mark.anyio
async def test_author_can_write():
    service = _service_with_comment(_comment(create_user="author"))
    result = await service.verify_internal_comment_access(
        1, _user(username="author", roles=[RoleEnum.GOVERNMENT]), write=True
    )
    assert result is not None


@pytest.mark.anyio
async def test_non_author_cannot_write():
    service = _service_with_comment(_comment(create_user="someone_else"))
    with pytest.raises(HTTPException) as exc:
        await service.verify_internal_comment_access(
            1, _user(username="author", roles=[RoleEnum.GOVERNMENT]), write=True
        )
    assert exc.value.status_code == 403


@pytest.mark.anyio
async def test_missing_comment_raises_404():
    service = _service_with_comment(None)
    with pytest.raises(HTTPException) as exc:
        await service.verify_internal_comment_access(
            999, _user(roles=[RoleEnum.GOVERNMENT]), write=False
        )
    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_government_can_read_internal():
    service = _service_with_comment(_comment(visibility="Internal"))
    result = await service.verify_internal_comment_access(
        1, _user(username="reader", roles=[RoleEnum.GOVERNMENT]), write=False
    )
    assert result is not None


@pytest.mark.anyio
async def test_non_government_can_read_public_on_own_organization():
    service = _service_with_comment(
        _comment(visibility="Public"), owner_organization_ids=(5,)
    )
    result = await service.verify_internal_comment_access(
        1,
        _user(username="bceid", roles=[RoleEnum.SUPPLIER], organization_id=5),
        write=False,
    )
    assert result is not None


@pytest.mark.anyio
async def test_non_government_cannot_read_public_on_another_organization():
    """Public visibility is not an organization scope."""
    service = _service_with_comment(
        _comment(visibility="Public"), owner_organization_ids=(5,)
    )
    with pytest.raises(HTTPException) as exc:
        await service.verify_internal_comment_access(
            1,
            _user(username="bceid", roles=[RoleEnum.SUPPLIER], organization_id=6),
            write=False,
        )
    assert exc.value.status_code == 403


@pytest.mark.anyio
async def test_non_government_cannot_read_comment_with_no_readable_entity():
    """A comment on a Transfer, an agreement, or nothing at all resolves to no
    readable organization and is refused."""
    service = _service_with_comment(
        _comment(visibility="Public"), owner_organization_ids=()
    )
    with pytest.raises(HTTPException) as exc:
        await service.verify_internal_comment_access(
            1,
            _user(username="bceid", roles=[RoleEnum.SUPPLIER], organization_id=5),
            write=False,
        )
    assert exc.value.status_code == 403


@pytest.mark.anyio
async def test_non_government_without_an_organization_cannot_read():
    service = _service_with_comment(
        _comment(visibility="Public"), owner_organization_ids=(5,)
    )
    with pytest.raises(HTTPException) as exc:
        await service.verify_internal_comment_access(
            1,
            _user(username="bceid", roles=[RoleEnum.SUPPLIER], organization_id=None),
            write=False,
        )
    assert exc.value.status_code == 403


@pytest.mark.anyio
async def test_non_government_cannot_read_internal():
    service = _service_with_comment(
        _comment(visibility="Internal"), owner_organization_ids=(5,)
    )
    with pytest.raises(HTTPException) as exc:
        await service.verify_internal_comment_access(
            1,
            _user(username="bceid", roles=[RoleEnum.SUPPLIER], organization_id=5),
            write=False,
        )
    assert exc.value.status_code == 403
