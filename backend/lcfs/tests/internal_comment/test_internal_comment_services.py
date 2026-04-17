import pytest
from unittest.mock import AsyncMock, MagicMock
from types import SimpleNamespace
from fastapi import HTTPException

from lcfs.db.models.comment.ComplianceReportInternalComment import (
    ComplianceReportInternalComment,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.internal_comment.schema import (
    EntityTypeEnum,
    AudienceScopeEnum,
    CommentVisibilityEnum,
    InternalCommentCreateSchema,
    InternalCommentUpdateSchema,
)
from lcfs.web.api.internal_comment.services import InternalCommentService


@pytest.mark.anyio
async def test_copy_internal_comments_success():
    """
    Test successful copying of internal comments from source to target report.
    """
    # Setup mock repository
    mock_repo = MagicMock()
    mock_repo.get_internal_comment_ids_for_entity = AsyncMock(return_value=[1, 2, 3])

    # Setup mock database session
    mock_db = MagicMock()
    mock_db.add_all = MagicMock()
    mock_db.flush = AsyncMock()
    mock_repo.db = mock_db

    # Create service instance
    service = InternalCommentService()
    service.repo = mock_repo

    # Execute the function
    await service.copy_internal_comments(source_report_id=100, target_report_id=200)

    # Verify get_internal_comment_ids_for_entity was called correctly
    mock_repo.get_internal_comment_ids_for_entity.assert_called_once_with(
        EntityTypeEnum.COMPLIANCE_REPORT, 100
    )

    # Verify add_all was called with correct associations
    mock_db.add_all.assert_called_once()

    # Get the associations that were added
    added_associations = mock_db.add_all.call_args[0][0]
    assert len(added_associations) == 3

    # Verify each association has correct attributes
    for i, association in enumerate(added_associations):
        assert isinstance(association, ComplianceReportInternalComment)
        assert association.compliance_report_id == 200
        assert association.internal_comment_id == i + 1

    # Verify flush was called
    mock_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_copy_internal_comments_no_comments():
    """
    Test copying when no comments exist for the source report.
    """
    # Setup mock repository that returns empty list
    mock_repo = MagicMock()
    mock_repo.get_internal_comment_ids_for_entity = AsyncMock(return_value=[])

    # Setup mock database session
    mock_db = MagicMock()
    mock_db.add_all = MagicMock()
    mock_db.flush = AsyncMock()
    mock_repo.db = mock_db

    # Create service instance
    service = InternalCommentService()
    service.repo = mock_repo

    # Execute the function
    await service.copy_internal_comments(source_report_id=100, target_report_id=200)

    # Verify get_internal_comment_ids_for_entity was called
    mock_repo.get_internal_comment_ids_for_entity.assert_called_once_with(
        EntityTypeEnum.COMPLIANCE_REPORT, 100
    )

    # Verify no database operations were performed since no comments exist
    mock_db.add_all.assert_not_called()
    mock_db.flush.assert_not_called()


@pytest.mark.anyio
async def test_copy_internal_comments_none_comment_ids():
    """
    Test copying when get_internal_comment_ids_for_entity returns None.
    """
    # Setup mock repository that returns None
    mock_repo = MagicMock()
    mock_repo.get_internal_comment_ids_for_entity = AsyncMock(return_value=None)

    # Setup mock database session
    mock_db = MagicMock()
    mock_db.add_all = MagicMock()
    mock_db.flush = AsyncMock()
    mock_repo.db = mock_db

    # Create service instance
    service = InternalCommentService()
    service.repo = mock_repo

    # Execute the function
    await service.copy_internal_comments(source_report_id=100, target_report_id=200)

    # Verify get_internal_comment_ids_for_entity was called
    mock_repo.get_internal_comment_ids_for_entity.assert_called_once_with(
        EntityTypeEnum.COMPLIANCE_REPORT, 100
    )

    # Verify no database operations were performed since no comments exist
    mock_db.add_all.assert_not_called()
    mock_db.flush.assert_not_called()


@pytest.mark.anyio
async def test_copy_internal_comments_single_comment():
    """
    Test copying a single internal comment.
    """
    # Setup mock repository with single comment
    mock_repo = MagicMock()
    mock_repo.get_internal_comment_ids_for_entity = AsyncMock(return_value=[42])

    # Setup mock database session
    mock_db = MagicMock()
    mock_db.add_all = MagicMock()
    mock_db.flush = AsyncMock()
    mock_repo.db = mock_db

    # Create service instance
    service = InternalCommentService()
    service.repo = mock_repo

    # Execute the function
    await service.copy_internal_comments(source_report_id=555, target_report_id=666)

    # Verify get_internal_comment_ids_for_entity was called correctly
    mock_repo.get_internal_comment_ids_for_entity.assert_called_once_with(
        EntityTypeEnum.COMPLIANCE_REPORT, 555
    )

    # Verify add_all was called with single association
    mock_db.add_all.assert_called_once()

    # Get the associations that were added
    added_associations = mock_db.add_all.call_args[0][0]
    assert len(added_associations) == 1

    # Verify the association has correct attributes
    association = added_associations[0]
    assert isinstance(association, ComplianceReportInternalComment)
    assert association.compliance_report_id == 666
    assert association.internal_comment_id == 42

    # Verify flush was called
    mock_db.flush.assert_called_once()


@pytest.mark.anyio
async def test_copy_internal_comments_large_number_of_comments():
    """
    Test copying a large number of internal comments to ensure performance.
    """
    # Setup mock repository with many comments
    comment_ids = list(range(1, 101))  # 100 comments
    mock_repo = MagicMock()
    mock_repo.get_internal_comment_ids_for_entity = AsyncMock(return_value=comment_ids)

    # Setup mock database session
    mock_db = MagicMock()
    mock_db.add_all = MagicMock()
    mock_db.flush = AsyncMock()
    mock_repo.db = mock_db

    # Create service instance
    service = InternalCommentService()
    service.repo = mock_repo

    # Execute the function
    await service.copy_internal_comments(source_report_id=100, target_report_id=200)

    # Verify get_internal_comment_ids_for_entity was called correctly
    mock_repo.get_internal_comment_ids_for_entity.assert_called_once_with(
        EntityTypeEnum.COMPLIANCE_REPORT, 100
    )

    # Verify add_all was called with correct number of associations
    mock_db.add_all.assert_called_once()

    # Get the associations that were added
    added_associations = mock_db.add_all.call_args[0][0]
    assert len(added_associations) == 100

    # Verify all associations have correct attributes
    for i, association in enumerate(added_associations):
        assert isinstance(association, ComplianceReportInternalComment)
        assert association.compliance_report_id == 200
        assert association.internal_comment_id == i + 1

    # Verify flush was called
    mock_db.flush.assert_called_once()


def _build_service_with_user_roles(role_names):
    service = InternalCommentService()
    service.request = MagicMock()
    service.request.user = SimpleNamespace(
        role_names=role_names,
        keycloak_username="mockuser",
    )
    service.repo = MagicMock()
    service.repo.create_internal_comment = AsyncMock()
    service.repo.get_internal_comments = AsyncMock()
    service.repo.get_internal_comment_by_id = AsyncMock()
    service.repo.update_internal_comment = AsyncMock()
    return service


@pytest.mark.anyio
async def test_create_internal_comment_non_gov_rejects_non_compliance_report():
    service = _build_service_with_user_roles([RoleEnum.SUPPLIER])
    payload = InternalCommentCreateSchema(
        entity_type=EntityTypeEnum.TRANSFER,
        entity_id=1,
        comment="Supplier comment",
        audience_scope=AudienceScopeEnum.ANALYST,
        visibility=CommentVisibilityEnum.PUBLIC,
    )

    with pytest.raises(HTTPException) as exc:
        await service.create_internal_comment(payload)

    assert exc.value.status_code == 403
    service.repo.create_internal_comment.assert_not_called()


@pytest.mark.anyio
async def test_create_internal_comment_non_gov_rejects_internal_visibility():
    service = _build_service_with_user_roles([RoleEnum.SUPPLIER])
    payload = InternalCommentCreateSchema(
        entity_type=EntityTypeEnum.COMPLIANCE_REPORT,
        entity_id=1,
        comment="Supplier internal comment",
        audience_scope=None,
        visibility=CommentVisibilityEnum.INTERNAL,
    )

    with pytest.raises(HTTPException) as exc:
        await service.create_internal_comment(payload)

    assert exc.value.status_code == 403
    service.repo.create_internal_comment.assert_not_called()


@pytest.mark.anyio
async def test_create_internal_comment_non_gov_public_forces_audience_scope_none():
    service = _build_service_with_user_roles([RoleEnum.SUPPLIER])
    service.repo.create_internal_comment.return_value = SimpleNamespace(
        internal_comment_id=99,
        comment="Public supplier comment",
        audience_scope=None,
        visibility="Public",
        create_user="mockuser",
        create_date=None,
        update_date=None,
        full_name="Mock User",
    )
    payload = InternalCommentCreateSchema(
        entity_type=EntityTypeEnum.COMPLIANCE_REPORT,
        entity_id=42,
        comment="Public supplier comment",
        audience_scope=AudienceScopeEnum.ANALYST,
        visibility=CommentVisibilityEnum.PUBLIC,
    )

    await service.create_internal_comment(payload)

    service.repo.create_internal_comment.assert_awaited_once()
    created_comment_arg = service.repo.create_internal_comment.await_args.args[0]
    assert created_comment_arg.visibility == "Public"
    assert created_comment_arg.audience_scope is None


@pytest.mark.anyio
async def test_create_internal_comment_government_defaults_audience_scope_to_analyst():
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    service.repo.create_internal_comment.return_value = SimpleNamespace(
        internal_comment_id=100,
        comment="Internal gov comment",
        audience_scope="Analyst",
        visibility="Internal",
        create_user="mockuser",
        create_date=None,
        update_date=None,
        full_name="Mock User",
    )
    payload = InternalCommentCreateSchema(
        entity_type=EntityTypeEnum.COMPLIANCE_REPORT,
        entity_id=42,
        comment="Internal gov comment",
        audience_scope=None,
        visibility=CommentVisibilityEnum.INTERNAL,
    )

    await service.create_internal_comment(payload)

    service.repo.create_internal_comment.assert_awaited_once()
    created_comment_arg = service.repo.create_internal_comment.await_args.args[0]
    assert created_comment_arg.audience_scope == "Analyst"
    assert created_comment_arg.visibility == "Internal"


@pytest.mark.anyio
async def test_get_internal_comments_non_gov_enforces_public_visibility_filter():
    service = _build_service_with_user_roles([RoleEnum.SUPPLIER])
    service.repo.get_internal_comments.return_value = []

    await service.get_internal_comments(
        EntityTypeEnum.COMPLIANCE_REPORT.value,
        555,
    )

    service.repo.get_internal_comments.assert_awaited_once_with(
        EntityTypeEnum.COMPLIANCE_REPORT.value,
        555,
        "Public",
    )


@pytest.mark.anyio
async def test_get_internal_comments_non_gov_rejects_non_compliance_report():
    service = _build_service_with_user_roles([RoleEnum.SUPPLIER])

    with pytest.raises(HTTPException) as exc:
        await service.get_internal_comments(EntityTypeEnum.TRANSFER.value, 555)

    assert exc.value.status_code == 403
    service.repo.get_internal_comments.assert_not_called()


@pytest.mark.anyio
async def test_update_internal_comment_public_sets_audience_scope_to_none():
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    service.repo.get_internal_comment_by_id.return_value = SimpleNamespace(
        internal_comment_id=8,
        comment="existing",
        audience_scope="Analyst",
        visibility="Internal",
    )
    service.repo.update_internal_comment.return_value = SimpleNamespace(
        internal_comment_id=8,
        comment="updated",
        audience_scope=None,
        visibility="Public",
        create_user="mockuser",
        create_date=None,
        update_date=None,
        full_name="Mock User",
    )
    payload = InternalCommentUpdateSchema(
        comment="updated",
        visibility=CommentVisibilityEnum.PUBLIC,
    )

    await service.update_internal_comment(8, payload)

    service.repo.update_internal_comment.assert_awaited_once_with(
        internal_comment_id=8,
        new_comment_text="updated",
        visibility="Public",
        audience_scope=None,
    )


@pytest.mark.anyio
async def test_update_internal_comment_internal_without_scope_defaults_to_analyst():
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    service.repo.get_internal_comment_by_id.return_value = SimpleNamespace(
        internal_comment_id=9,
        comment="existing",
        audience_scope=None,
        visibility="Internal",
    )
    service.repo.update_internal_comment.return_value = SimpleNamespace(
        internal_comment_id=9,
        comment="updated",
        audience_scope="Analyst",
        visibility="Internal",
        create_user="mockuser",
        create_date=None,
        update_date=None,
        full_name="Mock User",
    )
    payload = InternalCommentUpdateSchema(
        comment="updated",
        visibility=CommentVisibilityEnum.INTERNAL,
    )

    await service.update_internal_comment(9, payload)

    service.repo.update_internal_comment.assert_awaited_once_with(
        internal_comment_id=9,
        new_comment_text="updated",
        visibility="Internal",
        audience_scope="Analyst",
    )
