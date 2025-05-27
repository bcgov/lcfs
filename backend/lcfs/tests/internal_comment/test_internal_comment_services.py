import pytest
from unittest.mock import AsyncMock, MagicMock

from lcfs.db.models.comment.ComplianceReportInternalComment import (
    ComplianceReportInternalComment,
)
from lcfs.web.api.internal_comment.schema import EntityTypeEnum
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
