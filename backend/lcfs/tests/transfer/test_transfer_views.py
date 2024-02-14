import pytest
from httpx import AsyncClient, Response
from fastapi import FastAPI, status


@pytest.mark.anyio
async def test_get_all_transfers(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_all_transfers")
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK

@pytest.mark.anyio
async def test_get_transfer(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    # This test assumes that there exists a transfer with ID 1 in the test database.
    transfer_id = 1
    url = fastapi_app.url_path_for("get_transfer", transfer_id=transfer_id)
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK

@pytest.mark.anyio
async def test_create_transfer(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("create_transfer")
    transfer_payload = {
        "from_organization_id": 1,
        "to_organization_id": 2,
        "agreement_date": "2023-01-01",
        "quantity": 100,
        "price_per_unit": 10.0,
        "signing_authority_declaration": True,
        "comments": "Initial Transfer"
    }
    response = await client.post(url, json=transfer_payload)
    assert response.status_code == status.HTTP_201_CREATED

@pytest.mark.anyio
async def test_update_transfer(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    transfer_id = 1
    url = fastapi_app.url_path_for("update_transfer", transfer_id=transfer_id)
    update_payload = {
        "from_organization_id": 1,
        "to_organization_id": 2,
        "agreement_date": "2023-02-02",
        "quantity": 150,
        "price_per_unit": 20.0,
        "signing_authority_declaration": "Updated Authorization",
        "comments": "Updated Transfer"
    }
    response = await client.put(url, json=update_payload)
    assert response.status_code == status.HTTP_200_OK

