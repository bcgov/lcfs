"""Penalty log comment permissions, search metadata and document lifecycle."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.internal_comment.repo import InternalCommentRepository
from lcfs.web.api.internal_comment.schema import (
    EntityTypeEnum,
    InternalCommentCreateSchema,
    InternalCommentUpdateSchema,
)
from lcfs.web.api.internal_comment.services import InternalCommentService


def _comment(**overrides):
    values = dict(
        internal_comment_id=42,
        comment="<p>Payment confirmation</p>",
        create_user="author",
        visibility="Internal",
        audience_scope="Analyst",
        documents=[],
        full_name="Comment Author",
        create_date=None,
        update_date=None,
    )
    return SimpleNamespace(**(values | overrides))


def _service(username="author", roles=None):
    repo = MagicMock(spec=InternalCommentRepository)
    repo.is_penalty_log_comment = AsyncMock(return_value=True)
    repo.is_organization_comment = AsyncMock(return_value=False)
    repo.get_internal_comment_by_id = AsyncMock(return_value=_comment())
    repo.create_internal_comment = AsyncMock(return_value=_comment())
    repo.update_internal_comment = AsyncMock(return_value=_comment())
    repo.get_entity_org_and_year = AsyncMock(return_value=(7, None))
    repo.get_category_id_by_name = AsyncMock(return_value=5)
    repo.delete_penalty_log_comment = AsyncMock()
    request = SimpleNamespace(
        user=SimpleNamespace(
            keycloak_username=username,
            role_names=roles if roles is not None else [RoleEnum.GOVERNMENT],
        )
    )
    return InternalCommentService(request=request, repo=repo)


@pytest.mark.anyio
async def test_penalty_comments_append_and_pin_search_category_and_visibility():
    service = _service()
    for _ in range(2):
        await service.create_internal_comment(
            InternalCommentCreateSchema(
                entity_type=EntityTypeEnum.PENALTY_LOG,
                entity_id=7,
                comment="<p>Payment confirmation</p>",
                visibility="Public",
                comment_category="Company Overview",
            )
        )
    assert service.repo.create_internal_comment.await_count == 2
    comment, entity_type, entity_id = (
        service.repo.create_internal_comment.await_args.args
    )
    assert (entity_type, entity_id) == (EntityTypeEnum.PENALTY_LOG, 7)
    assert comment.visibility == "Internal"
    assert comment.organization_id == 7
    assert comment.comment_category_id == 5
    assert comment.comment_search_text == "Payment confirmation"
    service.repo.get_category_id_by_name.assert_awaited_with("Penalty notes")


@pytest.mark.anyio
@pytest.mark.parametrize("operation", ["create", "read", "edit", "delete"])
async def test_suppliers_cannot_access_penalty_comments(operation):
    service = _service(roles=[RoleEnum.SUPPLIER])
    with pytest.raises(HTTPException) as exc:
        if operation == "create":
            await service.create_internal_comment(
                InternalCommentCreateSchema(
                    entity_type="penaltyLog",
                    entity_id=7,
                    comment="note",
                    visibility="Public",
                )
            )
        elif operation == "read":
            await service.get_internal_comments("penaltyLog", 7)
        elif operation == "edit":
            await service.update_internal_comment(
                42, InternalCommentUpdateSchema(comment="changed")
            )
        else:
            await service.delete_internal_comment(42, AsyncMock())
    assert exc.value.status_code == 403


@pytest.mark.anyio
@pytest.mark.parametrize("operation", ["edit", "delete"])
async def test_other_government_users_cannot_modify_penalty_comments(operation):
    service = _service(username="other")
    with pytest.raises(HTTPException) as exc:
        if operation == "edit":
            await service.update_internal_comment(
                42, InternalCommentUpdateSchema(comment="changed")
            )
        else:
            await service.delete_internal_comment(42, AsyncMock())
    assert exc.value.status_code == 403
    service.repo.delete_penalty_log_comment.assert_not_awaited()
    service.repo.update_internal_comment.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("is_admin", [False, True])
async def test_author_and_admin_can_edit_but_cannot_reclassify_or_publish(is_admin):
    service = _service(
        username="admin" if is_admin else "author",
        roles=[RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR] if is_admin else None,
    )
    await service.update_internal_comment(
        42,
        InternalCommentUpdateSchema(
            comment="changed", visibility="Public", comment_category="Company Overview"
        ),
    )
    kwargs = service.repo.update_internal_comment.await_args.kwargs
    assert kwargs["visibility"] == "Internal"
    assert kwargs["comment_category_id"] == 5
    assert kwargs["update_user"] == ("admin" if is_admin else "author")
    service.repo.get_category_id_by_name.assert_awaited_with("Penalty notes")


@pytest.mark.anyio
@pytest.mark.parametrize("is_admin", [False, True])
async def test_delete_cleans_up_comment_documents_before_comment(is_admin):
    service = _service(
        username="admin" if is_admin else "author",
        roles=[RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR] if is_admin else None,
    )
    service.repo.get_internal_comment_by_id.return_value = _comment(
        documents=[SimpleNamespace(document_id=81), SimpleNamespace(document_id=82)]
    )
    documents = AsyncMock()
    await service.delete_internal_comment(42, documents)
    assert documents.delete_file.await_count == 2
    documents.delete_file.assert_any_await(81, 42, "internal_comment")
    documents.delete_file.assert_any_await(82, 42, "internal_comment")
    service.repo.delete_penalty_log_comment.assert_awaited_once_with(42)


@pytest.mark.anyio
async def test_delete_does_not_remove_comment_when_document_cleanup_fails():
    service = _service()
    service.repo.get_internal_comment_by_id.return_value = _comment(
        documents=[SimpleNamespace(document_id=81)]
    )
    documents = AsyncMock()
    documents.delete_file.side_effect = HTTPException(503, "Storage unavailable")
    with pytest.raises(HTTPException):
        await service.delete_internal_comment(42, documents)
    service.repo.delete_penalty_log_comment.assert_not_awaited()


@pytest.mark.anyio
async def test_delete_endpoint_does_not_delete_other_comment_types():
    service = _service()
    service.repo.is_penalty_log_comment.return_value = False
    with pytest.raises(HTTPException) as exc:
        await service.delete_internal_comment(42, AsyncMock())
    assert exc.value.status_code == 404


@pytest.mark.anyio
@pytest.mark.parametrize("text", ["", "  ", "<p><br></p>", "<p>&nbsp;</p>"])
@pytest.mark.parametrize("operation", ["create", "edit"])
async def test_penalty_comments_require_visible_text(text, operation):
    service = _service()
    with pytest.raises(HTTPException) as exc:
        if operation == "create":
            await service.create_internal_comment(
                InternalCommentCreateSchema(
                    entity_type="penaltyLog",
                    entity_id=7,
                    comment=text,
                )
            )
        else:
            await service.update_internal_comment(
                42, InternalCommentUpdateSchema(comment=text)
            )
    assert exc.value.status_code == 422
    service.repo.create_internal_comment.assert_not_awaited()
    service.repo.update_internal_comment.assert_not_awaited()
