import pytest
from unittest.mock import AsyncMock, MagicMock
from lcfs.web.api.audit_log.repo import AuditLogRepository
from lcfs.db.models.audit.AuditLog import AuditLog


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def audit_log_repo(mock_db):
    repo = AuditLogRepository()
    repo.db = mock_db
    return repo


@pytest.mark.anyio
async def test_get_audit_logs_paginated_success(audit_log_repo, mock_db):
    # Arrange
    expected_audit_logs = [AuditLog(audit_log_id=1), AuditLog(audit_log_id=2)]
    expected_total_count = 2

    # Mock total_count_result for count query
    mock_total_count_result = MagicMock()
    mock_total_count_result.scalar_one.return_value = expected_total_count

    # Mock result for the data query
    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = expected_audit_logs
    mock_result.scalars.return_value = mock_scalars

    # Mock execute to return the total count result and the data result
    mock_db.execute.side_effect = [mock_total_count_result, mock_result]

    # Act
    offset = 0
    limit = 10
    conditions = []
    sort_orders = []
    audit_logs, total_count = await audit_log_repo.get_audit_logs_paginated(
        offset, limit, conditions, sort_orders
    )

    # Assert
    assert audit_logs == expected_audit_logs
    assert total_count == expected_total_count
    assert (
        mock_db.execute.call_count == 2
    )  # One for the count query, one for the data query


@pytest.mark.anyio
async def test_get_audit_log_by_id_success(audit_log_repo, mock_db):
    # Arrange
    audit_log_id = 1
    expected_audit_log = AuditLog(audit_log_id=audit_log_id)

    # Mock result for the query
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = expected_audit_log
    mock_db.execute.return_value = mock_result

    # Act
    result = await audit_log_repo.get_audit_log_by_id(audit_log_id)

    # Assert
    assert result == expected_audit_log
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_audit_log_by_id_not_found(audit_log_repo, mock_db):
    # Arrange
    audit_log_id = 999

    # Mock result for the query to return None
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    # Act
    result = await audit_log_repo.get_audit_log_by_id(audit_log_id)

    # Assert
    assert result is None
    mock_db.execute.assert_called_once()
