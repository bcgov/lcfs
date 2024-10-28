from unittest.mock import MagicMock, patch
import pytest
from httpx import AsyncClient
from fastapi import FastAPI, status
from lcfs.db.models.user.Role import RoleEnum


@pytest.mark.anyio
async def test_create_admin_adjustment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])
    url = fastapi_app.url_path_for("create_admin_adjustment")
    admin_adjustment_payload = {
        "transactionEffectiveDate": "2024-08-06",
        "txnType": "administrativeAdjustment",
        "complianceUnits": 1000,
        "toOrganizationId": "1",
        "govComment": "Initial creation of admin adjustment.",
        "internalComment": "<p>my comments</p>",
        "currentStatus": "Recommended",
    }
    response = await client.post(url, json=admin_adjustment_payload)
    assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.anyio
async def test_get_admin_adjustment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    admin_adjustment_id = 1  # This test assumes that there exists an admin adjustment with ID 1 in the test database.
    url = fastapi_app.url_path_for(
        "get_admin_adjustment", admin_adjustment_id=admin_adjustment_id
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.skip(reason="FIX ME")
async def test_get_admin_adjustment_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test that a user without correct organization access cannot retrieve an admin adjustment."""
    # Set user with an unauthorized role or incorrect organization
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])  # A non-government role
    admin_adjustment_id = 1  # Assuming an admin adjustment with ID 1 exists

    # Mock the service to return an admin adjustment belonging to a different organization
    mock_admin_adjustment = MagicMock()
    mock_admin_adjustment.to_organization.organization_id = 2  # Different organization
    with patch(
        "lcfs.web.api.admin_adjustment.services.AdminAdjustmentServices.get_admin_adjustment"
    ) as mock_get_admin_adjustment:
        mock_get_admin_adjustment.return_value = mock_admin_adjustment

        url = fastapi_app.url_path_for(
            "get_admin_adjustment", admin_adjustment_id=admin_adjustment_id
        )
        response = await client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_get_admin_adjustment_not_found(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test that a 404 error is raised if the admin adjustment does not exist."""
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])  # Authorized role
    admin_adjustment_id = 999  # Non-existing admin adjustment ID

    # Mock the service to return None, simulating a missing admin adjustment
    with patch(
        "lcfs.web.api.admin_adjustment.services.AdminAdjustmentServices.get_admin_adjustment",
    ) as mock_get_admin_adjustment:
        mock_get_admin_adjustment.return_value = None

        url = fastapi_app.url_path_for(
            "get_admin_adjustment", admin_adjustment_id=admin_adjustment_id
        )
        response = await client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_update_admin_adjustment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.ANALYST, RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("update_admin_adjustment")
    admin_adjustment_update_payload = {
        "transactionEffectiveDate": "2024-08-06",
        "txnType": "administrativeAdjustment",
        "complianceUnits": 1500,
        "toOrganizationId": "1",
        "govComment": None,
        "internalComment": "",
        "currentStatus": "Draft",
        "adminAdjustmentId": "1",
    }
    response = await client.put(url, json=admin_adjustment_update_payload)
    assert response.status_code == status.HTTP_202_ACCEPTED


@pytest.mark.skip(reason="FIX ME")
async def test_fail_update_processed_admin_adjustment(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.DIRECTOR, RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("update_admin_adjustment")
    admin_adjustment_update_payload = {
        "transactionEffectiveDate": "2024-08-06",
        "txnType": "administrativeAdjustment",
        "complianceUnits": 1500,
        "toOrganizationId": "1",
        "govComment": None,
        "internalComment": "",
        "currentStatus": "Draft",
        "adminAdjustmentId": "2",
    }
    response = await client.put(url, json=admin_adjustment_update_payload)
    assert response.status_code == status.HTTP_403_FORBIDDEN
