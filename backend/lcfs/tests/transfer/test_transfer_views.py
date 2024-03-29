import pytest
from httpx import AsyncClient, Response
from fastapi import FastAPI, status
from lcfs.tests.transfer.transfer_payloads import transfer_create_payload_2, transfer_update_payload_2, transfer_update_draft_payload


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
    response = await client.post(url, json=transfer_create_payload_2.dict())
    assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.anyio
async def test_update_transfer_draft(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    # This test assumes that there exists a transfer with ID 1 in the test database.
    transfer_id = 1
    url = fastapi_app.url_path_for(
        "update_transfer_draft", transfer_id=transfer_id)
    response = await client.put(url, json=transfer_update_draft_payload.dict())
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_update_transfer(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    # This test assumes that there exists a transfer with ID 1 in the test database.
    transfer_id = 1
    url = fastapi_app.url_path_for("update_transfer", transfer_id=transfer_id)
    response = await client.put(url, json=transfer_update_payload_2.dict())
    assert response.status_code == status.HTTP_200_OK
