import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from starlette import status


@pytest.fixture
async def setup_supplier_role(fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    yield
    # Add teardown logic if needed


@pytest.fixture
async def setup_government_role(fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Government"])
    yield
    # Add teardown logic if needed


# Base payloads
base_payload_fuel_export = {
    "compliancePeriod": "2024",
    "fuelTypeId": 3,
    "fuelType": "Electricity",
    "quantity": 1_000_000,
    "units": "L",
    "exportDate": "2024-09-04",
    "fuelCategoryId": 2,
    "fuelCategory": "Diesel",
    "provisionOfTheActId": 3,
    "provisionOfTheAct": "Default carbon intensity - section 19 (b) (ii)",
    "endUse": "Any",
    "modified": True,
    "validationStatus": "pending",
}

base_payload_fuel_export_no_pagination = {
    "compliance_report_id": 1,
}

base_payload_fuel_export_list = {
    "compliance_report_id": 1,
    "page": 1,
    "size": 10,
    "sort_orders": [],
    "filters": [],
}


@pytest.mark.anyio
async def test_get_fuel_export_table_options(
    client: AsyncClient, fastapi_app: FastAPI, setup_supplier_role
):
    url = fastapi_app.url_path_for("get_fuel_export_table_options")
    response = await client.get(url, params={"compliancePeriod": "2024"})

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "fuelTypes" in data
    assert isinstance(data["fuelTypes"], list)


@pytest.mark.anyio
async def test_get_fuel_export_list(
    client: AsyncClient, fastapi_app: FastAPI, setup_supplier_role
):
    url = fastapi_app.url_path_for("get_fuel_exports")
    response = await client.post(url, json=base_payload_fuel_export_list)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "pagination" in data
    assert "fuelExports" in data
    assert isinstance(data["fuelExports"], list)


@pytest.mark.anyio
async def test_get_fuel_export_list_without_pagination(
    client: AsyncClient, fastapi_app: FastAPI, setup_supplier_role
):
    url = fastapi_app.url_path_for("get_fuel_exports")
    response = await client.post(url, json=base_payload_fuel_export_no_pagination)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data.get("fuelExports"), list)


@pytest.mark.anyio
async def test_save_fuel_export_row_create(
    client: AsyncClient, fastapi_app: FastAPI, setup_supplier_role
):
    # Create compliance report
    url = fastapi_app.url_path_for("create_compliance_report", organization_id=1)
    compliance_report_payload = {
        "compliancePeriod": "2024",
        "organizationId": 1,
        "status": "Draft",
    }
    response = await client.post(url, json=compliance_report_payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()

    # Save fuel export row
    url = fastapi_app.url_path_for("save_fuel_export_row")
    payload = {
        **base_payload_fuel_export,
        "complianceReportId": data["complianceReportId"],
        "fuelExportId": None,
    }
    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["fuelType"]["fuelType"] == "Electricity"
    assert data["energy"] == 3_600_000
    assert data["quantity"] == 1_000_000
    assert data["complianceUnits"] == 1041


@pytest.mark.anyio
async def test_save_fuel_export_row_delete(
    client: AsyncClient, fastapi_app: FastAPI, setup_supplier_role
):
    # Create compliance report
    url = fastapi_app.url_path_for("create_compliance_report", organization_id=1)
    compliance_report_payload = {
        "compliancePeriod": "2024",
        "organizationId": 1,
        "status": "Draft",
    }
    response = await client.post(url, json=compliance_report_payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()

    # Save fuel export row
    url = fastapi_app.url_path_for("save_fuel_export_row")
    payload = {
        **base_payload_fuel_export,
        "complianceReportId": data["complianceReportId"],
        "fuelExportId": None,
    }
    response = await client.post(url, json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()

    # Delete fuel export row
    delete_payload = {
        **base_payload_fuel_export,
        "complianceReportId": data["complianceReportId"],
        "fuelExportId": data["fuelExportId"],
        "id": "d2f970db-8ec2-433f-be98-7f068021508e",
        "deleted": True,
    }
    response = await client.post(url, json=delete_payload)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "message" in data
    assert data["message"] == "fuel export row deleted successfully"


@pytest.mark.anyio
async def test_save_fuel_export_row_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, setup_government_role
):
    url = fastapi_app.url_path_for("save_fuel_export_row")
    payload = {
        **base_payload_fuel_export,
        "complianceReportId": 1,
        "fuelExportId": None,
    }
    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_403_FORBIDDEN
