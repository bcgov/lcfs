import pytest
from unittest.mock import AsyncMock
from lcfs.web.api.audit_log.services import AuditLogService
from lcfs.web.api.audit_log.repo import AuditLogRepository
from lcfs.web.api.audit_log.schema import (
    AuditLogListSchema,
    AuditLogSchema,
)
from lcfs.web.api.base import (
    PaginationRequestSchema,
    FilterModel,
)
from lcfs.db.models.audit.AuditLog import AuditLog
from lcfs.web.exception.exceptions import DataNotFoundException


@pytest.fixture
def mock_repo():
    return AsyncMock(spec=AuditLogRepository)


@pytest.fixture
def audit_log_service(mock_repo):
    service = AuditLogService()
    service.repo = mock_repo
    return service


@pytest.mark.anyio
async def test_get_audit_logs_paginated_success(audit_log_service, mock_repo):
    # Arrange
    pagination = PaginationRequestSchema(page=1, size=10, filters=[], sort_orders=[])
    expected_audit_logs = [
        AuditLog(
            audit_log_id=1,
            table_name="users",
            operation="INSERT",
            row_id=123,
            delta={"name": "John Doe"},
            create_date="2023-11-01",
            create_user="admin",
        ),
        AuditLog(
            audit_log_id=2,
            table_name="orders",
            operation="UPDATE",
            row_id=456,
            delta={"status": "completed"},
            create_date="2023-11-02",
            create_user="manager",
        ),
    ]
    expected_total_count = 2
    mock_repo.get_audit_logs_paginated.return_value = (
        expected_audit_logs,
        expected_total_count,
    )

    # Act
    result = await audit_log_service.get_audit_logs_paginated(pagination)

    # Assert
    assert isinstance(result, AuditLogListSchema)
    assert len(result.audit_logs) == 2
    assert result.pagination.total == expected_total_count
    mock_repo.get_audit_logs_paginated.assert_called_once()


@pytest.mark.anyio
async def test_get_audit_logs_paginated_no_data(audit_log_service, mock_repo):
    # Arrange
    pagination = PaginationRequestSchema(page=1, size=10, filters=[], sort_orders=[])
    mock_repo.get_audit_logs_paginated.return_value = ([], 0)

    # Act & Assert
    with pytest.raises(DataNotFoundException):
        await audit_log_service.get_audit_logs_paginated(pagination)


@pytest.mark.anyio
async def test_get_audit_log_by_id_success(audit_log_service, mock_repo):
    # Arrange
    audit_log_id = 1
    expected_audit_log = AuditLog(
        audit_log_id=audit_log_id,
        table_name="users",
        operation="INSERT",
        row_id=123,
        delta={"name": "John Doe"},
        create_date="2023-11-01",
        create_user="admin",
    )
    mock_repo.get_audit_log_by_id.return_value = expected_audit_log

    # Act
    result = await audit_log_service.get_audit_log_by_id(audit_log_id)

    # Assert
    assert isinstance(result, AuditLogSchema)
    assert result.audit_log_id == audit_log_id
    assert result.table_name == "users"
    mock_repo.get_audit_log_by_id.assert_called_once_with(audit_log_id)


@pytest.mark.anyio
async def test_get_audit_log_by_id_not_found(audit_log_service, mock_repo):
    # Arrange
    audit_log_id = 999
    mock_repo.get_audit_log_by_id.return_value = None

    # Act & Assert
    with pytest.raises(DataNotFoundException):
        await audit_log_service.get_audit_log_by_id(audit_log_id)


@pytest.mark.anyio
async def test_apply_audit_log_filters(audit_log_service):
    # Arrange
    pagination = PaginationRequestSchema(
        page=1,
        size=10,
        filters=[
            FilterModel(
                field="operation", filter_type="text", type="equals", filter="UPDATE"
            ),
            FilterModel(
                field="createDate",
                filter_type="date",
                type="greaterThan",
                date_from="2021-01-01",
            ),
        ],
        sort_orders=[],
    )
    conditions = []

    # Act
    audit_log_service.apply_audit_log_filters(pagination, conditions)

    # Assert
    assert len(conditions) == 2  # Two filters applied
