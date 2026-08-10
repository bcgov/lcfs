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


@pytest.mark.anyio
async def test_create_ci_application_public_comment_for_non_government_user():
    mock_repo = MagicMock()
    mock_repo.get_entity_org_and_year = AsyncMock(return_value=(None, None))
    mock_repo.get_category_id_by_name = AsyncMock(return_value=None)
    mock_repo.create_internal_comment = AsyncMock()
    mock_repo.create_internal_comment.return_value = SimpleNamespace(
        internal_comment_id=1,
        comment="Public applicant comment",
        audience_scope=None,
        visibility=CommentVisibilityEnum.PUBLIC,
        create_user="BCEIDUSER",
        create_date=None,
        update_date=None,
        update_user=None,
        update_full_name=None,
        full_name="BCeID User",
        documents=[],
    )
    mock_notification_service = MagicMock()
    mock_notification_service.send_notification = AsyncMock()

    service = InternalCommentService(
        request=SimpleNamespace(
            user=SimpleNamespace(
                role_names=[RoleEnum.SUPPLIER],
                keycloak_username="BCEIDUSER",
                user_profile_id=12,
            )
        ),
        repo=mock_repo,
        notification_service=mock_notification_service,
    )

    result = await service.create_internal_comment(
        InternalCommentCreateSchema(
            entity_type=EntityTypeEnum.CI_APPLICATION,
            entity_id=123,
            comment="Public applicant comment",
            visibility=CommentVisibilityEnum.PUBLIC,
            audience_scope=AudienceScopeEnum.ANALYST,
        )
    )

    created_comment = mock_repo.create_internal_comment.call_args.args[0]
    assert result.visibility == CommentVisibilityEnum.PUBLIC
    assert result.audience_scope is None
    assert created_comment.visibility == CommentVisibilityEnum.PUBLIC
    assert created_comment.audience_scope is None
    mock_repo.create_internal_comment.assert_called_once()
    mock_notification_service.send_notification.assert_awaited_once()


@pytest.mark.anyio
async def test_create_ci_application_internal_comment_for_non_government_user_forbidden():
    mock_repo = MagicMock()
    mock_repo.create_internal_comment = AsyncMock()
    mock_notification_service = MagicMock()
    mock_notification_service.send_notification = AsyncMock()

    service = InternalCommentService(
        request=SimpleNamespace(
            user=SimpleNamespace(
                role_names=[RoleEnum.SUPPLIER],
                keycloak_username="BCEIDUSER",
            )
        ),
        repo=mock_repo,
        notification_service=mock_notification_service,
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.create_internal_comment(
            InternalCommentCreateSchema(
                entity_type=EntityTypeEnum.CI_APPLICATION,
                entity_id=123,
                comment="Internal applicant comment",
                visibility=CommentVisibilityEnum.INTERNAL,
            )
        )

    assert exc_info.value.status_code == 403
    mock_repo.create_internal_comment.assert_not_called()
    mock_notification_service.send_notification.assert_not_awaited()


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
    # Metadata helpers used by ``_populate_comment_metadata``. Tests that
    # care about specific values can override these on the returned service.
    service.repo.get_category_id_by_name = AsyncMock(return_value=99)
    service.repo.get_entity_org_and_year = AsyncMock(return_value=(7, 2025))
    service.repo.get_comments_for_organization = AsyncMock()
    # Most comments are not Company Overview notes; tests that need the
    # organization-comment path override this.
    service.repo.is_organization_comment = AsyncMock(return_value=False)
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
async def test_update_internal_comment_non_gov_clamps_to_public():
    """
    Non-government users (BCeID) may edit the text of their own comment,
    but the service force-clamps visibility to Public and audience_scope
    to None regardless of what the payload contains. Creator-ownership is
    enforced upstream in the view.
    """
    service = _build_service_with_user_roles([RoleEnum.SUPPLIER])
    service.repo.get_internal_comment_by_id.return_value = SimpleNamespace(
        internal_comment_id=1,
        comment="existing",
        audience_scope="Analyst",
        visibility="Internal",
    )
    service.repo.update_internal_comment.return_value = SimpleNamespace(
        internal_comment_id=1,
        comment="updated text",
        audience_scope=None,
        visibility="Public",
        create_user="mockuser",
        create_date=None,
        update_date=None,
        full_name="Mock User",
    )
    payload = InternalCommentUpdateSchema(
        comment="updated text",
        visibility="Internal",  # smuggled — service should ignore
        audience_scope="Analyst",  # smuggled — service should ignore
    )

    await service.update_internal_comment(1, payload)

    service.repo.update_internal_comment.assert_awaited_once()
    call_kwargs = service.repo.update_internal_comment.await_args.kwargs
    assert call_kwargs["visibility"] == CommentVisibilityEnum.PUBLIC.value
    assert call_kwargs["audience_scope"] is None
    assert call_kwargs["new_comment_text"] == "updated text"


@pytest.mark.anyio
async def test_create_organization_comment_is_forced_internal():
    """
    Company Overview notes have no public option in the UI; the service pins
    the visibility so a client cannot file one as Public (#4608).
    """
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    service.repo.create_internal_comment.return_value = SimpleNamespace(
        internal_comment_id=101,
        comment="Overview note",
        audience_scope="Analyst",
        visibility="Internal",
        create_user="mockuser",
        create_date=None,
        update_date=None,
        full_name="Mock User",
    )
    payload = InternalCommentCreateSchema(
        entity_type=EntityTypeEnum.ORGANIZATION,
        entity_id=7,
        comment="Overview note",
        visibility=CommentVisibilityEnum.PUBLIC,
    )

    await service.create_internal_comment(payload)

    service.repo.create_internal_comment.assert_awaited_once()
    created_comment_arg = service.repo.create_internal_comment.await_args.args[0]
    assert created_comment_arg.visibility == CommentVisibilityEnum.INTERNAL
    # Internal comments still need an audience scope, resolved from the role.
    assert created_comment_arg.audience_scope == AudienceScopeEnum.ANALYST


@pytest.mark.anyio
async def test_update_organization_comment_cannot_be_flipped_to_public():
    """An edit cannot turn a Company Overview note public (#4608)."""
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    service.repo.is_organization_comment = AsyncMock(return_value=True)
    service.repo.get_internal_comment_by_id.return_value = SimpleNamespace(
        internal_comment_id=11,
        comment="existing",
        audience_scope="Analyst",
        visibility="Internal",
    )
    service.repo.update_internal_comment.return_value = SimpleNamespace(
        internal_comment_id=11,
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
        visibility=CommentVisibilityEnum.PUBLIC,  # smuggled — service ignores
    )

    await service.update_internal_comment(11, payload)

    call_kwargs = service.repo.update_internal_comment.await_args.kwargs
    assert call_kwargs["visibility"] == CommentVisibilityEnum.INTERNAL.value
    assert call_kwargs["audience_scope"] == AudienceScopeEnum.ANALYST.value


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

    service.repo.update_internal_comment.assert_awaited_once()
    call_kwargs = service.repo.update_internal_comment.await_args.kwargs
    assert call_kwargs["internal_comment_id"] == 8
    assert call_kwargs["new_comment_text"] == "updated"
    assert call_kwargs["visibility"] == "Public"
    assert call_kwargs["audience_scope"] is None


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

    service.repo.update_internal_comment.assert_awaited_once()
    call_kwargs = service.repo.update_internal_comment.await_args.kwargs
    assert call_kwargs["internal_comment_id"] == 9
    assert call_kwargs["new_comment_text"] == "updated"
    assert call_kwargs["visibility"] == "Internal"
    assert call_kwargs["audience_scope"] == "Analyst"


# ======================================================================
# Comment Log metadata helper (`_populate_comment_metadata`)
# ======================================================================
from lcfs.web.api.internal_comment.services import (
    DEFAULT_CATEGORY_BY_ENTITY,
    sanitize_comment_text,
)
from lcfs.db.models.comment.InternalComment import InternalComment


def test_sanitize_comment_text_strips_html_and_collapses_whitespace():
    assert sanitize_comment_text(None) == ""
    assert sanitize_comment_text("") == ""
    assert sanitize_comment_text("<p>Hello <b>world</b></p>") == "Hello world"
    assert sanitize_comment_text("<p>a</p>\n<p>b   c</p>") == "a b c"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "entity_type,expected_category",
    [
        (EntityTypeEnum.COMPLIANCE_REPORT, "Compliance notes"),
        (EntityTypeEnum.TRANSFER, "Transfer notes"),
        (EntityTypeEnum.INITIATIVE_AGREEMENT, "IA notes"),
        (EntityTypeEnum.ADMIN_ADJUSTMENT, "Penalty notes"),
        (EntityTypeEnum.CI_APPLICATION, "CI application notes"),
    ],
)
async def test_populate_comment_metadata_default_category_per_entity_type(
    entity_type, expected_category
):
    """
    The helper must apply the agreed default category for every supported
    entity type when the caller does not pass an explicit override.
    """
    assert DEFAULT_CATEGORY_BY_ENTITY[entity_type] == expected_category

    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    service.repo.get_entity_org_and_year.return_value = (42, 2025)
    service.repo.get_category_id_by_name.return_value = 11

    comment = InternalComment(comment="<p>hello</p>")
    await service._populate_comment_metadata(
        comment,
        entity_type=entity_type,
        entity_id=123,
        category_display_name=None,
    )

    service.repo.get_category_id_by_name.assert_awaited_once_with(expected_category)
    service.repo.get_entity_org_and_year.assert_awaited_once_with(entity_type, 123)
    assert comment.organization_id == 42
    # compliance_year is only meaningful for compliance reports; the fake
    # returns 2025 for all but the assertion is on the helper wiring.
    assert comment.compliance_year == 2025
    assert comment.comment_category_id == 11
    assert comment.comment_search_text == "hello"
    assert comment.comment_search_vector is not None  # SQL expression


@pytest.mark.anyio
async def test_populate_comment_metadata_explicit_category_wins():
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    service.repo.get_category_id_by_name.return_value = 77

    comment = InternalComment(comment="<p>x</p>")
    await service._populate_comment_metadata(
        comment,
        entity_type=EntityTypeEnum.TRANSFER,
        entity_id=1,
        category_display_name="Organization details",
    )

    service.repo.get_category_id_by_name.assert_awaited_once_with(
        "Organization details"
    )
    assert comment.comment_category_id == 77


@pytest.mark.anyio
async def test_create_internal_comment_populates_all_metadata():
    """AC: All five metadata columns are populated on create."""
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    service.repo.get_entity_org_and_year.return_value = (3, 2024)
    service.repo.get_category_id_by_name.return_value = 5
    service.repo.create_internal_comment.return_value = SimpleNamespace(
        internal_comment_id=1,
        comment="<p>hi</p>",
        audience_scope="Analyst",
        visibility="Internal",
        create_user="mockuser",
        create_date=None,
        update_date=None,
        full_name="Mock User",
    )

    payload = InternalCommentCreateSchema(
        entity_type=EntityTypeEnum.COMPLIANCE_REPORT,
        entity_id=10,
        comment="<p>hi</p>",
        visibility=CommentVisibilityEnum.INTERNAL,
    )
    await service.create_internal_comment(payload)

    created = service.repo.create_internal_comment.await_args.args[0]
    assert created.organization_id == 3
    assert created.compliance_year == 2024
    assert created.comment_category_id == 5
    assert created.comment_search_text == "hi"
    assert created.comment_search_vector is not None


@pytest.mark.anyio
async def test_update_internal_comment_refreshes_search_text_and_vector():
    """AC: search_text and search_vector are refreshed on edit."""
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    service.repo.get_internal_comment_by_id.return_value = SimpleNamespace(
        internal_comment_id=5,
        comment="<p>old</p>",
        audience_scope="Analyst",
        visibility="Internal",
    )
    service.repo.update_internal_comment.return_value = SimpleNamespace(
        internal_comment_id=5,
        comment="<p>new</p>",
        audience_scope="Analyst",
        visibility="Internal",
        create_user="mockuser",
        create_date=None,
        update_date=None,
        full_name="Mock User",
    )

    await service.update_internal_comment(
        5,
        InternalCommentUpdateSchema(comment="<p>new <b>edited</b></p>"),
    )

    call_kwargs = service.repo.update_internal_comment.await_args.kwargs
    assert call_kwargs["comment_search_text"] == "new edited"
    assert call_kwargs["comment_search_vector"] is not None


# ======================================================================
# Organization Comment Log read view
# ======================================================================
@pytest.mark.anyio
async def test_get_organization_comments_bcid_other_org_forbidden():
    """AC: BCeID requesting another org's log gets 403."""
    service = _build_service_with_user_roles([RoleEnum.SUPPLIER])
    service.request.user = SimpleNamespace(
        role_names=[RoleEnum.SUPPLIER],
        keycloak_username="bceid-user",
        organization=SimpleNamespace(organization_id=10),
    )

    with pytest.raises(HTTPException) as exc:
        await service.get_organization_comments(organization_id=99)
    assert exc.value.status_code == 403
    service.repo.get_comments_for_organization.assert_not_called()


@pytest.mark.anyio
async def test_get_organization_comments_bcid_own_org_public_only():
    """AC: BCeID for own org only sees Public comments."""
    service = _build_service_with_user_roles([RoleEnum.SUPPLIER])
    service.request.user = SimpleNamespace(
        role_names=[RoleEnum.SUPPLIER],
        keycloak_username="bceid-user",
        organization=SimpleNamespace(organization_id=10),
    )
    service.repo.get_comments_for_organization.return_value = ([], 0)

    await service.get_organization_comments(organization_id=10)

    service.repo.get_comments_for_organization.assert_awaited_once()
    call_kwargs = service.repo.get_comments_for_organization.await_args.kwargs
    assert call_kwargs["organization_id"] == 10
    assert call_kwargs["page"] == 1
    assert call_kwargs["size"] == 25
    assert call_kwargs["visibility_filter"] == "Public"


@pytest.mark.anyio
async def test_get_organization_comments_idir_sees_internal_and_public():
    """AC: IDIR sees Internal + Public (no visibility filter)."""
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    service.repo.get_comments_for_organization.return_value = ([], 0)

    await service.get_organization_comments(organization_id=10, page=2, size=25)

    service.repo.get_comments_for_organization.assert_awaited_once()
    call_kwargs = service.repo.get_comments_for_organization.await_args.kwargs
    assert call_kwargs["organization_id"] == 10
    assert call_kwargs["page"] == 2
    assert call_kwargs["size"] == 25
    assert call_kwargs["visibility_filter"] is None


@pytest.mark.anyio
async def test_get_organization_comments_pagination_metadata():
    """AC: page/size/total/totalPages reflect the request and result count."""
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    sample_row = {
        "internal_comment_id": 1,
        "comment": "<p>x</p>",
        "plain_text_comment": "x",
        "organization_id": 5,
        "organization_name": "Org",
        "compliance_year": 2025,
        "visibility": "Internal",
        "audience_scope": "Analyst",
        "create_user": "mockuser",
        "create_date": None,
        "update_date": None,
        "category": "Compliance notes",
        "full_name": "Mock User",
        "entity_type": "complianceReport",
        "entity_id": 42,
    }
    service.repo.get_comments_for_organization.return_value = ([sample_row], 51)

    result = await service.get_organization_comments(organization_id=5, page=2, size=25)
    assert result.pagination.page == 2
    assert result.pagination.size == 25
    assert result.pagination.total == 51
    assert result.pagination.total_pages == 3
    assert len(result.comments) == 1
    # canEdit true when the requesting user created the comment.
    assert result.comments[0].can_edit is True


@pytest.mark.anyio
async def test_get_organization_comments_can_edit_false_for_other_user():
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    row = {
        "internal_comment_id": 2,
        "comment": "x",
        "plain_text_comment": "x",
        "organization_id": 5,
        "organization_name": "Org",
        "compliance_year": 2025,
        "visibility": "Internal",
        "audience_scope": "Analyst",
        "create_user": "someone-else",
        "create_date": None,
        "update_date": None,
        "category": "Compliance notes",
        "full_name": "Other User",
        "entity_type": "complianceReport",
        "entity_id": 1,
    }
    service.repo.get_comments_for_organization.return_value = ([row], 1)

    result = await service.get_organization_comments(organization_id=5)
    assert result.comments[0].can_edit is False


# ======================================================================
# Comment Log filters & search (tickets #4452 / #4453)
# ======================================================================
from datetime import date

from lcfs.web.api.internal_comment.schema import (
    CommentSortFieldEnum,
    CommentSortOrderEnum,
    OrganizationCommentsFilterSchema,
)


@pytest.mark.anyio
async def test_get_organization_comments_passes_all_filters_to_repo():
    """AC: every filter param is forwarded to the repository in SQL."""
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    service.repo.get_comments_for_organization.return_value = ([], 0)

    filters = OrganizationCommentsFilterSchema(
        category="Transfer notes",
        compliance_year=2024,
        date_from=date(2024, 1, 1),
        date_to=date(2024, 12, 31),
        visibility=CommentVisibilityEnum.INTERNAL,
        search="transfer",
        sort_by=CommentSortFieldEnum.UPDATE_DATE,
        sort_order=CommentSortOrderEnum.ASC,
    )
    await service.get_organization_comments(organization_id=5, filters=filters)

    call_kwargs = service.repo.get_comments_for_organization.await_args.kwargs
    assert call_kwargs["category"] == "Transfer notes"
    assert call_kwargs["compliance_year"] == 2024
    assert call_kwargs["date_from"] == date(2024, 1, 1)
    assert call_kwargs["date_to"] == date(2024, 12, 31)
    assert call_kwargs["visibility_filter"] == "Internal"
    assert call_kwargs["search"] == "transfer"
    assert call_kwargs["sort_by"] == "update_date"
    assert call_kwargs["sort_order"] == "asc"


@pytest.mark.anyio
async def test_get_organization_comments_bceid_visibility_param_ignored():
    """AC: BCeID callers cannot escape the Public clamp via the visibility filter."""
    service = _build_service_with_user_roles([RoleEnum.SUPPLIER])
    service.request.user = SimpleNamespace(
        role_names=[RoleEnum.SUPPLIER],
        keycloak_username="bceid-user",
        organization=SimpleNamespace(organization_id=10),
    )
    service.repo.get_comments_for_organization.return_value = ([], 0)

    filters = OrganizationCommentsFilterSchema(
        visibility=CommentVisibilityEnum.INTERNAL,  # smuggled
    )
    await service.get_organization_comments(organization_id=10, filters=filters)

    call_kwargs = service.repo.get_comments_for_organization.await_args.kwargs
    # Visibility forced to Public regardless of input.
    assert call_kwargs["visibility_filter"] == "Public"


@pytest.mark.anyio
async def test_get_organization_comments_idir_visibility_filter_honored():
    """AC: IDIR callers may narrow visibility via the param."""
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    service.repo.get_comments_for_organization.return_value = ([], 0)

    filters = OrganizationCommentsFilterSchema(
        visibility=CommentVisibilityEnum.INTERNAL,
    )
    await service.get_organization_comments(organization_id=10, filters=filters)
    call_kwargs = service.repo.get_comments_for_organization.await_args.kwargs
    assert call_kwargs["visibility_filter"] == "Internal"


@pytest.mark.anyio
async def test_get_organization_comments_size_capped_at_100():
    """Service must cap page size to 100."""
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    service.repo.get_comments_for_organization.return_value = ([], 0)

    await service.get_organization_comments(organization_id=1, size=10_000)
    call_kwargs = service.repo.get_comments_for_organization.await_args.kwargs
    assert call_kwargs["size"] == 100


@pytest.mark.anyio
async def test_get_organization_comments_defaults_when_no_filters_passed():
    """No filters → all optional params default to None / create_date desc."""
    service = _build_service_with_user_roles([RoleEnum.GOVERNMENT])
    service.repo.get_comments_for_organization.return_value = ([], 0)

    await service.get_organization_comments(organization_id=1)
    call_kwargs = service.repo.get_comments_for_organization.await_args.kwargs
    assert call_kwargs["category"] is None
    assert call_kwargs["compliance_year"] is None
    assert call_kwargs["date_from"] is None
    assert call_kwargs["date_to"] is None
    assert call_kwargs["search"] is None
    assert call_kwargs["sort_by"] == "create_date"
    assert call_kwargs["sort_order"] == "desc"
