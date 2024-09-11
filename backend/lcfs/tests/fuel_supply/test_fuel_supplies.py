import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from starlette import status


@pytest.mark.anyio
async def test_get_fs_table_options(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_fs_table_options", compliancePeriod="2024")
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "fuel_types" in data
    assert "fuel_classes" in data
    assert isinstance(data["fuel_types"], list)
    assert isinstance(data["fuel_classes"], list)


@pytest.mark.anyio
async def test_get_fuel_supply_list(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_fuel_supply")
    payload = {
        "compliance_report_id": 1,
        "page": 1,
        "size": 10,
        "sort_orders": [],
        "filters": [],
    }
    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "pagination" in data
    assert "fuel_supplies" in data
    assert isinstance(data["fuel_supplies"], list)


@pytest.mark.anyio
async def test_get_fuel_supply_list_without_pagination(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_fuel_supply")
    payload = {"compliance_report_id": 1}
    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.anyio
async def test_save_fuel_supply_row_create(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("save_fuel_supply_row")
    payload = {
        "compliance_report_id": 1,
        "fuel_supply_id": None,
        "fuel_type": "Gasoline",
        "fuel_class": "Class 1",
        "quantity": 1000,
        "deleted": False,
    }
    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "fuel_supply_id" in data
    assert data["fuel_type"] == "Gasoline"
    assert data["fuel_class"] == "Class 1"
    assert data["quantity"] == 1000


@pytest.mark.anyio
async def test_save_fuel_supply_row_update(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("save_fuel_supply_row")
    payload = {
        "compliance_report_id": 1,
        "fuel_supply_id": 1,
        "fuel_type": "Diesel",
        "fuel_class": "Class 2",
        "quantity": 2000,
        "deleted": False,
    }
    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["fuel_supply_id"] == 1
    assert data["fuel_type"] == "Diesel"
    assert data["fuel_class"] == "Class 2"
    assert data["quantity"] == 2000


@pytest.mark.anyio
async def test_save_fuel_supply_row_delete(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("save_fuel_supply_row")
    payload = {"compliance_report_id": 1, "fuel_supply_id": 1, "deleted": True}
    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "message" in data
    assert data["message"] == "fuel supply row deleted successfully"


@pytest.mark.anyio
async def test_save_fuel_supply_row_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("save_fuel_supply_row")
    payload = {
        "compliance_report_id": 1,
        "fuel_supply_id": None,
        "fuel_type": "Gasoline",
        "fuel_class": "Class 1",
        "quantity": 1000,
        "deleted": False,
    }
    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_403_FORBIDDEN
