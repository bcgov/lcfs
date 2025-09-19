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
    async def export(self, organization_id, user, organization, include_data=True):
        content = b"excel-bytes"
        headers = {"Content-Disposition": 'attachment; filename="CE_Test.xlsx"'}
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

    url = "/charging-equipment/export/1"
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

    url = "/charging-equipment/template/1"
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

    url = "/charging-equipment/export/999"
    response = await client.get(url)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_import_charging_equipment_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    url = "/charging-equipment/import/1"
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

    url = "/charging-equipment/import/999"
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

    url = "/charging-equipment/status/job-123"
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["progress"] == 50
    assert data["status"] == "Processing"
    assert data["created"] == 10
    assert data["rejected"] == 2
    assert isinstance(data["errors"], list)
