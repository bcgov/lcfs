import pytest
from fastapi import FastAPI, Depends
from httpx import AsyncClient
from starlette import status


@pytest.mark.anyio
async def test_endpoint_success(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles) -> None:
    url = fastapi_app.url_path_for("get_current_user")
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["keycloak_username"] == "mockuser"


@pytest.mark.anyio
async def test_endpoint_access_denied(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles) -> None:
    set_mock_user_roles(fastapi_app, ["Analyst"])
    url = fastapi_app.url_path_for("get_organizations")
    pagination = {
        "page": 1,
        "size": 10,
        "filters": [],
        "sortOrders": []
    }
    response = await client.post(url, json=pagination)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_endpoint_access_success(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_organizations")
    pagination = {
        "page": 1,
        "size": 10,
        "filters": [],
        "sortOrders": []
    }
    response = await client.post(url, json=pagination)
    assert response.status_code == status.HTTP_200_OK
