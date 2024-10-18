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


# Example of a test for validation logic
@pytest.mark.anyio
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
