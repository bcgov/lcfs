import pytest
from httpx import AsyncClient
from fastapi import FastAPI, status
from datetime import datetime

@pytest.mark.anyio
async def test_get_other_use(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    compliance_report_id = 1
    url = fastapi_app.url_path_for("get_other_uses", compliance_report_id=compliance_report_id)
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK

@pytest.mark.anyio
async def test_create_other_use(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("create_other_use")
    other_use_payload = {
        "compliance_report_id": 1,
        "quantity_supplied": 100,
        "fuel_type": "Diesel",
        "fuel_category": "Biofuel",
        "expected_use": "Transport",
        "units": "liters",
        "rationale": "Initial setup of the other use."
    }
    response = await client.post(url, json=other_use_payload)
    assert response.status_code == status.HTTP_201_CREATED

@pytest.mark.anyio
async def test_update_other_use(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    other_uses_id = 1
    url = fastapi_app.url_path_for("update_other_use", other_uses_id=other_uses_id)
    other_use_update_payload = {
        "compliance_report_id": 1,
        "quantity_supplied": 150,
        "fuel_type": "Petrol",
        "fuel_category": "Fossil Fuel",
        "expected_use": "Machinery",
        "units": "gallons",
        "rationale": "Updated other use."
    }
    response = await client.put(url, json=other_use_update_payload)
    assert response.status_code == status.HTTP_200_OK

# Test to ensure validation prevents deleting a non-existent other use
@pytest.mark.anyio
async def test_fail_delete_non_existent_other_use(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    other_uses_id = 999  # Assuming this ID does not exist in the test setup.
    url = fastapi_app.url_path_for("delete_other_use", other_uses_id=other_uses_id)
    response = await client.delete(url)
    assert response.status_code == status.HTTP_404_NOT_FOUND

@pytest.mark.anyio
async def test_delete_other_use(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    other_uses_id = 1
    url = fastapi_app.url_path_for("delete_other_use", other_uses_id=other_uses_id)
    response = await client.delete(url)
    assert response.status_code == status.HTTP_204_NO_CONTENT
