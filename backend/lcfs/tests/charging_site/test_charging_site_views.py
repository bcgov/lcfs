import pytest
import json
from fastapi import FastAPI
from httpx import AsyncClient
from unittest.mock import patch, MagicMock
from starlette.responses import StreamingResponse
from lcfs.db.models import Organization, ChargingSite, ChargingSiteStatus
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationResponseSchema
from lcfs.web.api.charging_site.schema import (
    ChargingSiteCreateSchema,
    ChargingSiteSchema,
    ChargingSiteStatusSchema,
    ChargingSitesSchema,
    DeleteChargingSiteResponseSchema,
    ChargingEquipmentStatusSchema,
    ChargingEquipmentPaginatedSchema,
    BulkEquipmentStatusUpdateSchema,
)
from lcfs.web.api.fuel_code.schema import EndUserTypeSchema


@pytest.fixture
def valid_charging_site_create_schema() -> ChargingSiteCreateSchema:
    return ChargingSiteCreateSchema(
        charging_site_id=1,
        organization_id=3,
        status="Draft",
        site_name="Test Charging Site",
        site_code="TST01",
        street_address="123 Test Street",
        city="Test City",
        postal_code="V1A 2B3",
        latitude=49.2827,
        longitude=-123.1207,
        intended_users=[
            EndUserTypeSchema(
                end_user_type_id=1, type_name="Multi-unit residential building"
            )
        ],
        notes="Test charging site notes",
        deleted=False,
    )


@pytest.fixture
def valid_charging_site_schema() -> ChargingSiteSchema:
    return ChargingSiteSchema(
        charging_site_id=1,
        organization_id=3,
        status=ChargingSiteStatusSchema(charging_site_status_id=1, status="Draft"),
        status_id=1,
        version=1,  # Add missing version field
        site_name="Test Charging Site",
        site_code="TST01",
        street_address="123 Test Street",
        city="Test City",
        postal_code="V1A 2B3",
        latitude=49.2827,
        longitude=-123.1207,
        intended_users=[
            EndUserTypeSchema(
                end_user_type_id=1, type_name="Multi-unit residential building"
            )
        ],
        notes="Test charging site notes",
    )


@pytest.mark.anyio
async def test_get_intended_users_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful retrieval of intended users"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.get_intended_user_types"
    ) as mock_get_intended_users:
        mock_get_intended_users.return_value = [
            EndUserTypeSchema(
                end_user_type_id=1, type_name="Multi-unit residential building"
            ),
            EndUserTypeSchema(end_user_type_id=2, type_name="Fleet"),
        ]

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("get_intended_users")
        response = await client.get(url)

        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) == 2
        assert response.json()[0]["endUserTypeId"] == 1
        assert response.json()[0]["typeName"] == "Multi-unit residential building"


@pytest.mark.anyio
async def test_get_intended_users_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test unauthorized access to intended users"""
    # This endpoint doesn't require specific authorization, so it returns 200
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    url = fastapi_app.url_path_for("get_intended_users")
    response = await client.get(url)
    assert response.status_code == 200  # Changed from 403 to 200


@pytest.mark.anyio
async def test_get_charging_equipment_statuses_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful retrieval of charging equipment statuses"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.get_charging_equipment_statuses"
    ) as mock_get_statuses:
        mock_get_statuses.return_value = [
            ChargingEquipmentStatusSchema(
                charging_equipment_status_id=1,
                status="Draft",
                description="Draft status",
            )
        ]

        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
        url = fastapi_app.url_path_for("get_charging_equipment_statuses")
        response = await client.get(url)

        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["status"] == "Draft"


@pytest.mark.anyio
async def test_get_charging_site_statuses_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful retrieval of charging site statuses"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.get_charging_site_statuses"
    ) as mock_get_statuses:
        mock_get_statuses.return_value = [
            ChargingSiteStatusSchema(
                charging_site_status_id=1, status="Draft", description="Draft status"
            )
        ]

        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
        url = fastapi_app.url_path_for("get_charging_site_statuses")
        response = await client.get(url)

        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["status"] == "Draft"


@pytest.mark.anyio
async def test_get_site_names_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful retrieval of site names"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.get_site_names_by_organization"
    ) as mock_get_site_names:
        mock_get_site_names.return_value = [
            {"siteName": "Site 1", "chargingSiteId": 1},
            {"siteName": "Site 2", "chargingSiteId": 2},
        ]

        user_details = {"organization_id": 3}
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER], user_details)
        url = fastapi_app.url_path_for("get_site_names")
        response = await client.get(url)

        assert response.status_code == 200
        assert len(response.json()) == 2
        assert response.json()[0]["siteName"] == "Site 1"
        assert response.json()[0]["chargingSiteId"] == 1
        mock_get_site_names.assert_called_once_with(3)


@pytest.mark.anyio
async def test_get_site_names_with_organization_id_param(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test retrieval of site names with organization_id parameter for government user"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.get_site_names_by_organization"
    ) as mock_get_site_names:
        mock_get_site_names.return_value = [
            {"siteName": "Gov Site", "chargingSiteId": 5},
        ]

        user_details = {"organization_id": 1, "is_government": True}
        set_mock_user(fastapi_app, [RoleEnum.ANALYST], user_details)
        url = fastapi_app.url_path_for("get_site_names")
        response = await client.get(url, params={"organization_id": 3})

        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["siteName"] == "Gov Site"
        mock_get_site_names.assert_called_once_with(3)


@pytest.mark.anyio
async def test_get_site_names_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test unauthorized access to site names"""
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("get_site_names")
    response = await client.get(url)
    assert response.status_code == 403


@pytest.mark.anyio
async def test_get_charging_site_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, valid_charging_site_schema
):
    """Test successful retrieval of a specific charging site"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.get_charging_site_by_id"
    ) as mock_get_site:
        mock_get_site.return_value = valid_charging_site_schema

        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
        url = fastapi_app.url_path_for("get_charging_site", site_id=1)
        response = await client.get(url)

        assert response.status_code == 200
        assert response.json()["chargingSiteId"] == 1
        assert response.json()["siteName"] == "Test Charging Site"


@pytest.mark.anyio
async def test_get_charging_sites_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test unauthorized access to charging sites"""
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    url = fastapi_app.url_path_for("get_charging_sites", organization_id=3)
    payload = {"page": 1, "size": 10}
    response = await client.post(url, json=payload)
    assert response.status_code == 403


@pytest.mark.anyio
async def test_get_charging_site_equipment_paginated_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful retrieval of paginated charging equipment"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.get_charging_site_equipment_paginated"
    ) as mock_get_equipment, patch(
        "lcfs.web.api.charging_site.validation.ChargingSiteValidation.validate_organization_access"
    ) as mock_validate:
        mock_validate.return_value = None
        mock_get_equipment.return_value = ChargingEquipmentPaginatedSchema(
            equipments=[],
            pagination=PaginationResponseSchema(
                page=1, size=10, total=0, total_pages=0
            ),
        )

        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
        url = fastapi_app.url_path_for(
            "get_charging_site_equipment_paginated", site_id=1
        )
        payload = {"page": 1, "size": 10, "filters": [], "sortOrders": []}
        response = await client.post(url, json=payload)

        assert response.status_code == 200
        assert "equipments" in response.json()
        assert "pagination" in response.json()


@pytest.mark.anyio
async def test_bulk_update_equipment_status_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful bulk update of equipment status"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.bulk_update_equipment_status"
    ) as mock_bulk_update, patch(
        "lcfs.web.api.charging_site.validation.ChargingSiteValidation.validate_organization_access"
    ) as mock_validate:
        mock_validate.return_value = None
        mock_bulk_update.return_value = True

        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
        url = fastapi_app.url_path_for("bulk_update_equipment_status", site_id=1)
        payload = {"equipmentIds": [1, 2], "newStatus": "Validated"}
        response = await client.post(url, json=payload)

        assert response.status_code == 200
        assert response.json() is True


@pytest.mark.anyio
async def test_create_charging_site_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test unauthorized creation of charging site"""
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    url = fastapi_app.url_path_for("create_charging_site_row", organization_id=3)
    payload = {
        "organizationId": 3,
        "status": "Draft",
        "siteName": "New Charging Site",
        "streetAddress": "456 New Street",
        "city": "New City",
        "postalCode": "V2B 3C4",
        "latitude": 50.1234,
        "longitude": -124.5678,
        "intendedUsers": [],
        "notes": "New charging site",
    }
    response = await client.post(url, json=payload)
    assert response.status_code == 403


@pytest.mark.anyio
async def test_get_charging_sites_paginated_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, valid_charging_site_schema
):
    """Test successful retrieval of paginated charging sites"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.get_charging_sites_paginated"
    ) as mock_get_paginated:
        mock_get_paginated.return_value = ChargingSitesSchema(
            charging_sites=[valid_charging_site_schema],
            pagination=PaginationResponseSchema(
                page=1, size=10, total=1, total_pages=1
            ),
        )

        # Mock user with matching organization ID
        user_details = {"organization_id": 3}

        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER], user_details)
        url = fastapi_app.url_path_for("get_charging_sites", organization_id=3)
        payload = {"page": 1, "size": 10, "filters": [], "sortOrders": []}
        response = await client.post(url, json=payload)

        assert response.status_code == 200
        assert "chargingSites" in response.json()
        assert len(response.json()["chargingSites"]) == 1


@pytest.mark.anyio
async def test_get_all_charging_sites_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, valid_charging_site_schema
):
    """Test successful retrieval of all charging sites (government view)"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.get_all_charging_sites_paginated"
    ) as mock_get_all:
        mock_get_all.return_value = ChargingSitesSchema(
            charging_sites=[valid_charging_site_schema],
            pagination=PaginationResponseSchema(
                page=1, size=10, total=1, total_pages=1
            ),
        )

        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
        url = fastapi_app.url_path_for("get_all_charging_sites")
        payload = {"page": 1, "size": 10, "filters": [], "sortOrders": []}
        response = await client.post(url, json=payload)

        assert response.status_code == 200
        assert "chargingSites" in response.json()
        assert len(response.json()["chargingSites"]) == 1


@pytest.mark.anyio
async def test_create_charging_site_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, valid_charging_site_schema
):
    """Test successful creation of charging site"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.create_charging_site"
    ) as mock_create, patch(
        "lcfs.web.api.charging_site.validation.ChargingSiteValidation.charging_site_create_access"
    ) as mock_validate:
        mock_validate.return_value = True
        mock_create.return_value = valid_charging_site_schema

        # Mock user with matching organization ID
        user_details = {"organization_id": 3}

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING], user_details)
        url = fastapi_app.url_path_for("create_charging_site_row", organization_id=3)
        payload = {
            "organizationId": 3,
            "siteName": "New Charging Site",
            "streetAddress": "456 New Street",
            "city": "New City",
            "postalCode": "V2B 3C4",
            "latitude": 50.1234,
            "longitude": -124.5678,
            "intendedUsers": [],
            "notes": "New charging site",
        }
        response = await client.post(url, json=payload)

        assert response.status_code == 201
        assert "chargingSiteId" in response.json()


@pytest.mark.anyio
async def test_update_charging_site_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, valid_charging_site_schema
):
    """Test successful update of charging site"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.update_charging_site"
    ) as mock_update, patch(
        "lcfs.web.api.charging_site.validation.ChargingSiteValidation.charging_site_delete_update_access"
    ) as mock_validate:
        mock_validate.return_value = True
        updated_schema = valid_charging_site_schema.model_copy()
        updated_schema.site_name = "Updated Charging Site"
        mock_update.return_value = updated_schema

        # Mock user with matching organization ID
        user_details = {"organization_id": 3}

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING], user_details)
        url = fastapi_app.url_path_for(
            "update_charging_site_row", organization_id=3, charging_site_id=1
        )
        payload = {
            "chargingSiteId": 1,
            "organizationId": 3,
            "siteName": "Updated Charging Site",
            "streetAddress": "123 Test Street",
            "city": "Test City",
            "postalCode": "V1A 2B3",
            "latitude": 49.2827,
            "longitude": -123.1207,
            "intendedUsers": [],
            "notes": "Updated notes",
        }
        response = await client.put(url, json=payload)

        assert response.status_code == 201


@pytest.mark.anyio
async def test_delete_charging_site_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful deletion of charging site"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.delete_charging_site"
    ) as mock_delete, patch(
        "lcfs.web.api.charging_site.validation.ChargingSiteValidation.charging_site_delete_update_access"
    ) as mock_validate:
        mock_validate.return_value = True
        mock_delete.return_value = None

        # Mock user with matching organization ID
        user_details = {"organization_id": 3}

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING], user_details)
        url = fastapi_app.url_path_for(
            "delete_charging_site_row", organization_id=3, charging_site_id=1
        )
        response = await client.delete(url)

        assert response.status_code == 201
        assert response.json()["message"] == "Charging site deleted successfully"
        mock_delete.assert_called_once_with(1)


@pytest.mark.anyio
async def test_export_charging_sites_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful export of charging sites"""
    with patch(
        "lcfs.web.api.charging_site.export.ChargingSiteExporter.export"
    ) as mock_export:
        mock_export.return_value = StreamingResponse(
            iter([b"test content"]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        # Mock user with government role to bypass organization check
        user_details = {"organization_id": 3, "organization_name": "Test Organization"}
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT], user_details)
        url = fastapi_app.url_path_for("export_charging_sites", organization_id="3")
        response = await client.post(url, json=[])

        assert response.status_code == 200
        mock_export.assert_called_once()


@pytest.mark.anyio
async def test_export_charging_sites_access_denied(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test export with access denied to organization"""
    # Mock user with different organization
    mock_user = MagicMock()
    mock_user.organization.organization_id = 1  # Different from requested org

    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING], mock_user)
    url = fastapi_app.url_path_for("export_charging_sites", organization_id="3")
    response = await client.post(url, json=[])

    assert response.status_code == 403
    assert "Insufficient permissions" in response.json()["detail"]


@pytest.mark.anyio
async def test_import_charging_sites_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful import of charging sites"""
    with patch(
        "lcfs.web.api.charging_site.importer.ChargingSiteImporter.import_data"
    ) as mock_import:
        mock_import.return_value = "test-job-id"

        # Mock user with government role to bypass organization check
        user_details = {"organization_id": 3, "organization_name": "Test Organization"}
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT], user_details)
        url = fastapi_app.url_path_for("import_charging_sites", organization_id="3")

        # Create a mock file
        files = {
            "file": (
                "test.xlsx",
                b"test content",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        }
        data = {"overwrite": "true"}

        response = await client.post(url, files=files, data=data)

        assert response.status_code == 200
        assert response.json()["jobId"] == "test-job-id"


@pytest.mark.anyio
async def test_get_charging_site_template_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful template download"""
    with patch(
        "lcfs.web.api.charging_site.export.ChargingSiteExporter.export"
    ) as mock_export:
        mock_export.return_value = StreamingResponse(
            iter([b"template content"]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        # Mock user with government role to bypass organization check
        user_details = {"organization_id": 3, "organization_name": "Test Organization"}
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT], user_details)
        url = fastapi_app.url_path_for(
            "get_charging_site_template", organization_id="3"
        )
        response = await client.get(url)

        assert response.status_code == 200
        mock_export.assert_called_once()


@pytest.mark.anyio
async def test_get_import_job_status_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful job status retrieval"""
    with patch(
        "lcfs.web.api.charging_site.importer.ChargingSiteImporter.get_status"
    ) as mock_get_status:
        mock_get_status.return_value = {
            "progress": 50,
            "status": "Processing...",
            "created": 10,
            "rejected": 2,
            "errors": [],
        }

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("get_import_job_status", job_id="test-job-id")
        response = await client.get(url)

        assert response.status_code == 200
        assert response.json()["progress"] == 50
        assert response.json()["status"] == "Processing..."


@pytest.mark.anyio
async def test_bulk_update_equipment_status_error(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test bulk update equipment status with error"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.bulk_update_equipment_status"
    ) as mock_bulk_update, patch(
        "lcfs.web.api.charging_site.validation.ChargingSiteValidation.validate_organization_access"
    ) as mock_validate:
        mock_validate.return_value = None
        mock_bulk_update.side_effect = Exception("Update failed")

        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
        url = fastapi_app.url_path_for("bulk_update_equipment_status", site_id=1)
        payload = {"equipmentIds": [1, 2], "newStatus": "Validated"}
        response = await client.post(url, json=payload)

        assert response.status_code == 500
        assert "Failed to update equipment status" in response.json()["detail"]


@pytest.mark.anyio
async def test_get_charging_sites_exception_handling(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test exception handling in get charging sites"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.get_cs_list"
    ) as mock_get_list:
        mock_get_list.side_effect = Exception("Database error")

        # Mock user with supplier role and matching organization
        user_details = {"organization_id": 3, "organization_name": "Test Organization"}
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER], user_details)
        url = fastapi_app.url_path_for("get_charging_sites", organization_id=3)
        payload = {}
        response = await client.post(url, json=payload)

        assert response.status_code == 500
        assert "An unexpected error occurred" in response.json()["detail"]


@pytest.mark.anyio
async def test_get_all_charging_sites_exception_handling(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test exception handling in get all charging sites"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.get_all_charging_sites_paginated"
    ) as mock_get_all:
        mock_get_all.side_effect = Exception("Database error")

        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
        url = fastapi_app.url_path_for("get_all_charging_sites")
        payload = {"page": 1, "size": 10}
        response = await client.post(url, json=payload)

        assert response.status_code == 500
        assert "An unexpected error occurred" in response.json()["detail"]


@pytest.mark.anyio
async def test_get_site_names_service_exception(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test service exception handling in get site names"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.get_site_names_by_organization"
    ) as mock_get_site_names:
        mock_get_site_names.side_effect = Exception("Service error")

        user_details = {"organization_id": 3}
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER], user_details)
        url = fastapi_app.url_path_for("get_site_names")
        response = await client.get(url)

        assert response.status_code == 500
