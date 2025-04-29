import pytest
from httpx import AsyncClient
from fastapi import FastAPI, status

from lcfs.db.models.user.Role import RoleEnum


@pytest.mark.anyio
async def test_get_transactions_paginated_by_org(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    organization_id = 1
    url = fastapi_app.url_path_for(
        "get_transactions_paginated_by_org", organization_id=organization_id
    )
    pagination = {"page": 1, "size": 10, "filters": [], "sortOrders": []}
    response = await client.post(url, json=pagination)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "transactions" in data
    assert "pagination" in data
    assert data["pagination"]["page"] == 1
    assert len(data["transactions"]) == 2


@pytest.mark.anyio
async def test_export_transactions_by_org(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    organization_id = 1
    url = fastapi_app.url_path_for(
        "export_transactions_by_org", organization_id=organization_id
    )
    response = await client.post(url, params={"format": "csv"})

    assert response.status_code == status.HTTP_200_OK
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=" in response.headers["content-disposition"]


@pytest.mark.anyio
async def test_get_transactions_paginated(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("get_transactions_paginated")
    pagination = {"page": 1, "size": 10, "filters": [], "sortOrders": []}
    response = await client.post(url, json=pagination)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "transactions" in data
    assert "pagination" in data
    assert data["pagination"]["page"] == 1
    assert len(data["transactions"]) == 2


@pytest.mark.anyio
async def test_export_transactions(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("export_transactions")
    response = await client.post(url, params={"format": "csv"})
    assert response.status_code == status.HTTP_200_OK
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=" in response.headers["content-disposition"]


@pytest.mark.anyio
async def test_get_transaction_statuses(client: AsyncClient, fastapi_app: FastAPI):
    url = fastapi_app.url_path_for("get_transaction_statuses")
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    statuses = response.json()
    assert isinstance(statuses, list)
    if statuses:
        assert isinstance(statuses[0], dict)
        assert "status" in statuses[0]
