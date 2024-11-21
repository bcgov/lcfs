import pytest
from unittest.mock import patch
from httpx import AsyncClient
from fastapi import FastAPI

from lcfs.web.api.audit_log.schema import (
    AuditLogListSchema,
    AuditLogSchema,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.exception.exceptions import DataNotFoundException


@pytest.mark.anyio
async def test_get_audit_logs_paginated_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    with patch(
        "lcfs.web.api.audit_log.views.AuditLogService.get_audit_logs_paginated"
    ) as mock_service:
        # Arrange
        mock_service.return_value = AuditLogListSchema(
            audit_logs=[
                {
                    "audit_log_id": 1,
                    "table_name": "users",
                    "operation": "INSERT",
                    "row_id": 101,
                    "create_date": "2023-01-01T12:00:00",
                    "create_user": "admin",
                },
                {
                    "audit_log_id": 2,
                    "table_name": "orders",
                    "operation": "UPDATE",
                    "row_id": 202,
                    "create_date": "2023-01-02T13:00:00",
                    "create_user": "manager",
                },
            ],
            pagination={
                "total": 2,
                "page": 1,
                "size": 10,
                "total_pages": 1,
            },
        )
        set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])

        url = fastapi_app.url_path_for("get_audit_logs_paginated")
        payload = {"page": 1, "size": 10, "filters": [], "sortOrders": []}

        # Act
        response = await client.post(url, json=payload)

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["pagination"]["total"] == 2
        assert len(data["auditLogs"]) == 2
        mock_service.assert_called_once()


@pytest.mark.anyio
async def test_get_audit_logs_paginated_forbidden(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])  # Insufficient permissions

    url = fastapi_app.url_path_for("get_audit_logs_paginated")
    payload = {"page": 1, "size": 10, "filters": [], "sortOrders": []}

    response = await client.post(url, json=payload)

    assert response.status_code == 403  # Forbidden


@pytest.mark.anyio
async def test_get_audit_log_by_id_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    with patch(
        "lcfs.web.api.audit_log.views.AuditLogService.get_audit_log_by_id"
    ) as mock_service:
        # Arrange
        audit_log_id = 1
        mock_service.return_value = AuditLogSchema(
            audit_log_id=audit_log_id,
            table_name="users",
            operation="UPDATE",
            row_id=101,
            create_date="2023-01-01T12:00:00",
            create_user="admin",
        )
        set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])

        url = fastapi_app.url_path_for("get_audit_log_by_id", audit_log_id=audit_log_id)

        # Act
        response = await client.get(url)

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["auditLogId"] == audit_log_id
        assert data["tableName"] == "users"
        mock_service.assert_called_once_with(audit_log_id)


@pytest.mark.anyio
async def test_get_audit_log_by_id_not_found(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    with patch(
        "lcfs.web.api.audit_log.views.AuditLogService.get_audit_log_by_id"
    ) as mock_service:
        # Arrange
        audit_log_id = 999
        mock_service.side_effect = DataNotFoundException("Audit log not found")
        set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])

        url = fastapi_app.url_path_for("get_audit_log_by_id", audit_log_id=audit_log_id)

        # Act
        response = await client.get(url)

        # Assert
        assert response.status_code == 404
        mock_service.assert_called_once_with(audit_log_id)
