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
    # Arrange — window function returns rows with a _wf_total attribute
    expected_total_count = 2
    row1 = MagicMock(spec=["audit_log_id", "_wf_total"])
    row1.audit_log_id = 1
    row1._wf_total = expected_total_count
    row2 = MagicMock(spec=["audit_log_id", "_wf_total"])
    row2.audit_log_id = 2
    row2._wf_total = expected_total_count

    mock_result = MagicMock()
    mock_result.all.return_value = [row1, row2]
    mock_db.execute.return_value = mock_result

    # Act
    offset = 0
    limit = 10
    conditions = []
    sort_orders = []
    audit_logs, total_count = await audit_log_repo.get_audit_logs_paginated(
        offset, limit, conditions, sort_orders
    )

    # Assert — single execute (window function; no separate count query)
    assert audit_logs == [row1, row2]
    assert total_count == expected_total_count
    assert mock_db.execute.call_count == 1


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
