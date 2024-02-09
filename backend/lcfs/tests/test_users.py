import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from starlette import status


@pytest.mark.anyio
async def test_export_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("export_users")
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.headers["Content-Type"] == "application/vnd.ms-excel"


@pytest.mark.anyio
async def test_export_unauthorized_access(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Analyst"])
    url = fastapi_app.url_path_for("export_users")
    response = await client.get(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN
