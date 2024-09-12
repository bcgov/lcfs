import pytest
from httpx import AsyncClient, Response
from fastapi import FastAPI, status


@pytest.mark.anyio
async def test_get_transactions_paginated(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_transactions_paginated")
    pagination = {"page": 1, "size": 10, "filters": [], "sortOrders": []}
    response = await client.post(url, json=pagination)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "transactions" in data
    assert "pagination" in data
    assert data["pagination"]["page"] == 1


@pytest.mark.anyio
async def test_get_transactions_unauthenticated(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_transactions_paginated")
    pagination = {}
    response = await client.post(url, json=pagination)
    # Adjust the expected status code according to your application's auth setup
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_get_transaction_statuses(client: AsyncClient, fastapi_app: FastAPI):
    url = fastapi_app.url_path_for("get_transaction_statuses")
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    statuses = response.json()
    assert isinstance(statuses, list)
