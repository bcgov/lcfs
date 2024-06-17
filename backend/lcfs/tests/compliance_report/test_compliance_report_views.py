import pytest
import json
from httpx import AsyncClient
from fastapi import FastAPI, status
from pathlib import Path


@pytest.mark.anyio
async def test_get_compliance_periods_for_idir_users(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_compliance_periods")
    reposnse = await client.get(url)
    assert reposnse.status_code == status.HTTP_200_OK
    assert reposnse.content

@pytest.mark.anyio
async def test_get_compliance_periods_for_bceid_users(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_compliance_periods")
    reposnse = await client.get(url)
    assert reposnse.status_code == status.HTTP_200_OK
    assert reposnse.content

@pytest.mark.anyio
async def test_get_fse_options(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_fse_options")
    reposnse = await client.get(url)
    assert reposnse.status_code == status.HTTP_200_OK
    assert reposnse.content
