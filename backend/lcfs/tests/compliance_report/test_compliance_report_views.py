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


@pytest.mark.anyio
async def test_create_compliance_report_draft(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Supplier"])
    try:
        with open(Path(__file__).parent / "report_payload.json") as f_data:
            payload = json.load(f_data)
            url = fastapi_app.url_path_for(
                "create_compliance_report", organization_id=1
            )
            response = await client.post(url, json=payload["draftReport"])
            assert response.status_code == status.HTTP_201_CREATED
            assert response.content
            f_data.close()
    except Exception as e:
        raise AssertionError("Failed to create compliance report", e)


@pytest.mark.anyio
async def test_get_compliance_report_by_id_for_bceid_user(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for(
        "get_compliance_report_by_id", organization_id=1, report_id=1
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    assert response.content

@pytest.mark.anyio
async def test_get_compliance_report_by_id_for_idir_user(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for(
        "get_compliance_report_by_id", report_id=1
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    assert response.content