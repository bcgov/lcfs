import io
import json
import pytest
from httpx import AsyncClient
from fastapi import FastAPI
from starlette import status
from starlette.responses import StreamingResponse

from lcfs.db.models.user.Role import RoleEnum
from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.web.api.charging_equipment.export import ChargingEquipmentExporter
from lcfs.web.api.charging_equipment.importer import ChargingEquipmentImporter


class FakeChargingEquipmentExporter:
    last_export_filtered_args = None

    async def export(self, organization_id, user, organization, include_data=True):
        content = b"excel-bytes"
        headers = {"Content-Disposition": 'attachment; filename="CE_Test.xlsx"'}
        return StreamingResponse(
            io.BytesIO(content),
            media_type=FILE_MEDIA_TYPE["XLSX"].value,
            headers=headers,
        )

    async def export_filtered(self, user, pagination, organization_id=None):
        filters = getattr(pagination, "filters", []) or []
        sort_orders = getattr(pagination, "sort_orders", []) or []
        FakeChargingEquipmentExporter.last_export_filtered_args = {
            "is_government": getattr(user, "is_government", False),
            "organization_id": organization_id,
            "page": getattr(pagination, "page", None),
            "size": getattr(pagination, "size", None),
            "filters": [f.model_dump() for f in filters],
            "sort_orders": [s.model_dump() for s in sort_orders],
        }
        content = b"excel-filtered-bytes"
        headers = {
            "Content-Disposition": 'attachment; filename="fse_index_2026-02-18.xlsx"'
        }
        return StreamingResponse(
            io.BytesIO(content),
            media_type=FILE_MEDIA_TYPE["XLSX"].value,
            headers=headers,
        )


class FakeChargingEquipmentImporter:
    async def import_data(self, organization_id, user, org_code, file, overwrite):
        return "job-123"

    async def get_status(self, job_id: str) -> dict:
        return {
            "progress": 50,
            "status": "Processing",
            "created": 10,
            "rejected": 2,
            "errors": ["Row 5: Invalid level"],
        }


@pytest.fixture(autouse=True)
def override_dependencies(fastapi_app: FastAPI):
    FakeChargingEquipmentExporter.last_export_filtered_args = None
    fastapi_app.dependency_overrides[ChargingEquipmentExporter] = (
        lambda: FakeChargingEquipmentExporter()
    )
    fastapi_app.dependency_overrides[ChargingEquipmentImporter] = (
        lambda: FakeChargingEquipmentImporter()
    )
    yield
    fastapi_app.dependency_overrides = {}


@pytest.mark.anyio
async def test_export_charging_equipment_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    url = "/api/charging-equipment/export/1"
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.headers.get("Content-Type") == FILE_MEDIA_TYPE["XLSX"].value
    cd = response.headers.get("Content-Disposition")
    assert cd == 'attachment; filename="CE_Test.xlsx"'
    body = await response.aread()
    assert body == b"excel-bytes"


@pytest.mark.anyio
async def test_template_charging_equipment_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    url = "/api/charging-equipment/template/1"
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.headers.get("Content-Type") == FILE_MEDIA_TYPE["XLSX"].value
    cd = response.headers.get("Content-Disposition")
    assert cd == 'attachment; filename="CE_Test.xlsx"'


@pytest.mark.anyio
async def test_export_charging_equipment_wrong_org_forbidden(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    # Supplier attempting to export another organization's equipment should be forbidden
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    url = "/api/charging-equipment/export/999"
    response = await client.get(url)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_export_filtered_charging_equipment_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    response = await client.post(
        "/api/charging-equipment/export",
        json={
            "page": 1,
            "size": 25,
            "sortOrders": [],
            "filters": [],
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.headers.get("Content-Type") == FILE_MEDIA_TYPE["XLSX"].value
    assert (
        response.headers.get("Content-Disposition")
        == 'attachment; filename="fse_index_2026-02-18.xlsx"'
    )
    body = await response.aread()
    assert body == b"excel-filtered-bytes"
    assert FakeChargingEquipmentExporter.last_export_filtered_args == {
        "is_government": False,
        "organization_id": None,
        "page": 1,
        "size": 25,
        "filters": [],
        "sort_orders": [],
    }


@pytest.mark.anyio
async def test_export_filtered_charging_equipment_with_org_filter_for_government(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    response = await client.post(
        "/api/charging-equipment/export",
        json={
            "page": 1,
            "size": 25,
            "sortOrders": [{"field": "registrationNumber", "direction": "asc"}],
            "filters": [{"field": "manufacturer", "filterType": "text", "type": "contains", "filter": "Tesla"}],
            "organization_id": 9,
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.headers.get("Content-Type") == FILE_MEDIA_TYPE["XLSX"].value
    assert FakeChargingEquipmentExporter.last_export_filtered_args == {
        "is_government": True,
        "organization_id": 9,
        "page": 1,
        "size": 25,
        "filters": [
            {
                "filter_type": "text",
                "type": "contains",
                "filter": "Tesla",
                "values": None,
                "field": "manufacturer",
                "date_from": "",
                "date_to": "",
            }
        ],
        "sort_orders": [
            {"field": "registration_number", "direction": "asc"}
        ],
    }


@pytest.mark.anyio
async def test_import_charging_equipment_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    url = "/api/charging-equipment/import/1"
    files = {
        "file": (
            "upload.xlsx",
            io.BytesIO(b"xlsx-bytes"),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
    }
    data = {"overwrite": "true"}
    response = await client.post(url, files=files, data=data)

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert payload["jobId"] == "job-123"


@pytest.mark.anyio
async def test_import_charging_equipment_wrong_org_forbidden(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    url = "/api/charging-equipment/import/999"
    files = {
        "file": (
            "upload.xlsx",
            io.BytesIO(b"xlsx-bytes"),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
    }
    data = {"overwrite": "false"}
    response = await client.post(url, files=files, data=data)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_get_import_job_status_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    url = "/api/charging-equipment/status/job-123"
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["progress"] == 50
    assert data["status"] == "Processing"
    assert data["created"] == 10
    assert data["rejected"] == 2
    assert isinstance(data["errors"], list)
