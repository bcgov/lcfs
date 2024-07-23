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
    payload = {"compliancePeriod": "2024", "organizationId": 1, "status": "Draft"}
    url = fastapi_app.url_path_for("create_compliance_report", organization_id=1)
    response = await client.post(url, json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    assert response.content


@pytest.mark.anyio
async def test_get_compliance_report_by_id_for_bceid_user(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    
    set_mock_user_roles(fastapi_app, ["Supplier"])
    payload = {"compliancePeriod": "2023", "organizationId": 1, "status": "Draft"}
    url = fastapi_app.url_path_for("create_compliance_report", organization_id=1)
    response = await client.post(url, json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    assert response.content

    compliance_report_id = json.loads(response.content.decode("utf-8"))[
        "complianceReportId"
    ]
    # test to get the the report back after creating
    url = fastapi_app.url_path_for(
        "get_compliance_report_by_id", organization_id=1, report_id=compliance_report_id
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    assert response.content

## Tests for getting paginated compliance reports list
@pytest.mark.anyio
async def test_get_reports_paginated_for_org_successful(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models
):
    # Load a sample record to retrieve the reports list.
    set_mock_user_roles(fastapi_app, ["Supplier"])
    payload = {"compliancePeriod": "2022", "organizationId": 1, "status": "Draft"}
    url = fastapi_app.url_path_for("create_compliance_report", organization_id=1)
    response = await client.post(url, json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    assert response.content
    # retrieve the list of reports
    url = fastapi_app.url_path_for("get_compliance_reports", organization_id=1)
    request_data = {"page": 1, "size": 5, "sortOrders": [], "filters": []}
    response = await client.post(url, json=request_data)

    # Check the status code
    assert response.status_code == status.HTTP_200_OK

    # check if pagination is working as expected
    content = json.loads(response.content.decode("utf-8"))
    assert content["pagination"]["page"] == 1