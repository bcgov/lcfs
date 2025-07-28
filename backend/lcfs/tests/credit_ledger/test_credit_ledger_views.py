import pytest
from httpx import AsyncClient
from fastapi import FastAPI, status

from lcfs.db.models.user.Role import RoleEnum


ORG_ID = 1


@pytest.mark.anyio
async def test_get_credit_ledger(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Supplier can fetch its own ledger."""
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    url = fastapi_app.url_path_for("get_credit_ledger", organization_id=ORG_ID)
    payload = {"page": 1, "size": 10, "filters": [], "sortOrders": []}

    resp = await client.post(url, json=payload)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["pagination"]["page"] == 1
    assert "ledger" in data


@pytest.mark.anyio
async def test_get_credit_ledger_forbidden(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    other_org = ORG_ID + 999
    url = fastapi_app.url_path_for("get_credit_ledger", organization_id=other_org)
    payload = {"page": 1, "size": 10, "filters": [], "sortOrders": []}

    resp = await client.post(url, json=payload)
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_export_credit_ledger(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    monkeypatch,
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    monkeypatch.setattr(
        "lcfs.web.api.credit_ledger.services.SpreadsheetBuilder.build_spreadsheet",
        lambda self: b"dummy-bytes",
    )

    url = fastapi_app.url_path_for("export_credit_ledger", organization_id=ORG_ID)
    resp = await client.get(url)
    assert resp.status_code == status.HTTP_200_OK
    assert "attachment; filename=" in resp.headers["content-disposition"]


@pytest.mark.anyio
async def test_get_organization_ledger_years(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Supplier can fetch available years for its own organization."""
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    url = fastapi_app.url_path_for("get_organization_ledger_years", organization_id=ORG_ID)
    resp = await client.get(url)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert isinstance(data, list)  # Should return a list of years


@pytest.mark.anyio
async def test_get_organization_ledger_years_forbidden(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Supplier cannot fetch years for another organization."""
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    other_org = ORG_ID + 999
    url = fastapi_app.url_path_for("get_organization_ledger_years", organization_id=other_org)
    resp = await client.get(url)
    assert resp.status_code == status.HTTP_403_FORBIDDEN
