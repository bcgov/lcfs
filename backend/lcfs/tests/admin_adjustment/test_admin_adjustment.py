import pytest
from httpx import AsyncClient
from fastapi import FastAPI, status

@pytest.mark.anyio
async def test_get_admin_adjustment(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Admin"])  # Assuming role needed is 'Admin'
    admin_adjustment_id = 1  # This test assumes that there exists an admin adjustment with ID 1 in the test database.
    url = fastapi_app.url_path_for("get_admin_adjustment", admin_adjustment_id=admin_adjustment_id)
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK

@pytest.mark.anyio
async def test_create_admin_adjustment(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Admin"])
    url = fastapi_app.url_path_for("create_admin_adjustment")
    admin_adjustment_payload = {
        "compliance_units": 100,
        "current_status": "Pending",
        "transaction_effective_date": "2023-05-08",
        "to_organization_id": 2,
        "gov_comment": "Initial creation of admin adjustment."
    }
    response = await client.post(url, json=admin_adjustment_payload)
    assert response.status_code == status.HTTP_201_CREATED

@pytest.mark.anyio
async def test_update_admin_adjustment(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Admin"])
    admin_adjustment_id = 1  # This test assumes that there exists an admin adjustment with ID 1 in the test database.
    url = fastapi_app.url_path_for("update_admin_adjustment", admin_adjustment_id=admin_adjustment_id)
    admin_adjustment_update_payload = {
        "compliance_units": 150,
        "current_status": "Updated",
        "transaction_effective_date": "2023-05-09",
        "to_organization_id": 3,
        "gov_comment": "Updated admin adjustment."
    }
    response = await client.put(url, json=admin_adjustment_update_payload)
    assert response.status_code == status.HTTP_200_OK

# Example of a test for validation logic
@pytest.mark.anyio
async def test_fail_update_processed_admin_adjustment(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Admin"])
    admin_adjustment_id = 2  # Assuming this adjustment is marked as "Processed" in the test setup.
    url = fastapi_app.url_path_for("update_admin_adjustment", admin_adjustment_id=admin_adjustment_id)
    admin_adjustment_update_payload = {
        "compliance_units": 200,
        "current_status": "Processed",  # Attempting to update a processed adjustment
        "transaction_effective_date": "2023-05-10",
        "to_organization_id": 4,
        "gov_comment": "Attempt to update processed adjustment."
    }
    response = await client.put(url, json=admin_adjustment_update_payload)
    assert response.status_code == status.HTTP_403_FORBIDDEN
