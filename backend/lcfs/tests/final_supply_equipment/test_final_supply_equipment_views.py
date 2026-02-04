import io
import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from starlette.responses import StreamingResponse
from unittest.mock import patch, MagicMock
from datetime import datetime
from lcfs.db.models import ComplianceReport, Organization, CompliancePeriod
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.web.api.final_supply_equipment.schema import (
    FinalSupplyEquipmentsSchema,
    FSEOptionsSchema,
    PortsEnum,
)


@pytest.mark.anyio
async def test_get_fse_options_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    with patch(
        "lcfs.web.api.final_supply_equipment.services.FinalSupplyEquipmentServices.get_fse_options"
    ) as mock_get_fse_options:
        mock_get_fse_options.return_value = FSEOptionsSchema(
            intended_user_types=[],
            ports=[],
            organization_names=[],
            intended_use_types=[],
            levels_of_equipment=[],
        )

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("get_fse_options")
        response = await client.get(url)
        assert response.status_code == 200
        assert isinstance(response.json(), dict)


@pytest.mark.anyio
async def test_get_fse_options_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    url = fastapi_app.url_path_for("get_fse_options")
    response = await client.get(url)
    assert response.status_code == 403


@pytest.mark.anyio
async def test_get_final_supply_equipments_paginated_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    with patch(
        "lcfs.web.api.final_supply_equipment.services."
        "FinalSupplyEquipmentServices.get_compliance_report_by_id",
        return_value=ComplianceReport(),
    ) as mock_get_compliance_report_by_id, patch(
        "lcfs.web.api.compliance_report.validation."
        "ComplianceReportValidation.validate_compliance_report_access",
        return_value=None,
    ) as mock_validate_report, patch(
        "lcfs.web.api.compliance_report.validation."
        "ComplianceReportValidation.validate_organization_access",
        return_value=ComplianceReport(),
    ) as mock_validate_report_2, patch(
        "lcfs.web.api.final_supply_equipment.services."
        "FinalSupplyEquipmentServices.get_fse_options",
        return_value=FinalSupplyEquipmentsSchema(),
    ) as mock_get_fse_options:
        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("get_final_supply_equipments")
        payload = {
            "complianceReportId": 1,
            "page": 1,
            "size": 10,
            "sortOrders": [],
            "filters": [],
        }
        response = await client.post(url, json=payload)
        assert response.status_code == 200
        assert "finalSupplyEquipments" in response.json()


@pytest.mark.anyio
async def test_get_final_supply_equipments_not_found(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
    url = fastapi_app.url_path_for("get_final_supply_equipments")
    payload = {
        "compliance_report_id": 999,
        "page": 1,
        "size": 10,
    }
    response = await client.post(url, json=payload)
    assert response.status_code == 404
    assert response.json()["detail"] == "Compliance report not found for this period"


@pytest.mark.anyio
async def test_save_final_supply_equipment_create_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    valid_final_supply_equipment_schema,
):
    with patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_report_access, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_report, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_editable"
    ) as mock_validate_editable, patch(
        "lcfs.web.api.final_supply_equipment.validation.FinalSupplyEquipmentValidation.check_equipment_uniqueness_and_overlap"
    ) as mock_validate_fse, patch(
        "lcfs.web.api.final_supply_equipment.services.FinalSupplyEquipmentServices.create_final_supply_equipment"
    ) as mock_create_fse:

        # Create a properly mocked compliance report with current_status
        mock_report = ComplianceReport(organization=Organization())
        mock_report.current_status = MagicMock()
        mock_report.current_status.status = ComplianceReportStatusEnum.Draft
        mock_validate_report.return_value = mock_report
        mock_validate_report_access.return_value = None
        mock_validate_editable.return_value = None
        mock_validate_fse.return_value = None
        mock_create_fse.return_value = valid_final_supply_equipment_schema

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

        url = fastapi_app.url_path_for("save_final_supply_equipment_row")
        payload = {
            "compliance_report_id": 456,
            "organization_name": "Example Organization",
            "supply_from_date": "2025-01-01",
            "supply_to_date": "2025-12-31",
            "kwh_usage": 250.5,
            "serial_nbr": "ABC123XYZ",
            "manufacturer": "Generic Manufacturer",
            "model": "Model X",
            "level_of_equipment": "Level 2",
            "ports": "Single port",
            "intended_use_types": ["public charging", "fleet management"],
            "intended_user_types": ["general public", "employees"],
            "street_address": "123 Main St",
            "city": "Anytown",
            "postal_code": "A1A 1A1",
            "latitude": 49.2827,
            "longitude": -123.1207,
            "notes": "Additional notes about the equipment",
        }
        response = await client.post(url, json=payload)
        assert response.status_code == 201
        assert "finalSupplyEquipmentId" in response.json()


@pytest.mark.anyio
async def test_save_final_supply_equipment_delete_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    with patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_report_access, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_report, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_editable"
    ) as mock_validate_editable:
        # Create a properly mocked compliance report with current_status
        mock_report = ComplianceReport(organization=Organization())
        mock_report.current_status = MagicMock()
        mock_report.current_status.status = ComplianceReportStatusEnum.Draft
        mock_validate_report.return_value = mock_report
        mock_validate_report_access.return_value = None
        mock_validate_editable.return_value = None

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_final_supply_equipment_row")
        payload = {
            "final_supply_equipment_id": 123,
            "compliance_report_id": 456,
            "organization_name": "Example Organization",
            "supply_from_date": "2025-01-01",
            "supply_to_date": "2025-12-31",
            "kwh_usage": 250.5,
            "serial_nbr": "ABC123XYZ",
            "manufacturer": "Generic Manufacturer",
            "model": "Model X",
            "level_of_equipment": "Level 2",
            "ports": PortsEnum.SINGLE,
            "intended_use_types": ["public charging", "fleet management"],
            "intended_user_types": ["general public", "employees"],
            "street_address": "123 Main St",
            "city": "Anytown",
            "postal_code": "A1A 1A1",
            "latitude": 49.2827,
            "longitude": -123.1207,
            "notes": "Additional notes about the equipment",
            "deleted": True,
        }
        response = await client.post(url, json=payload)
        assert response.status_code == 201
        assert (
            response.json()["message"]
            == "Final supply equipment row deleted successfully"
        )


@pytest.mark.anyio
async def test_search_table_options_with_manufacturer(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
    url = fastapi_app.url_path_for("search_table_options")
    params = {"manufacturer": "TestManufacturer"}
    response = await client.get(url, params=params)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.anyio
async def test_search_table_options_without_manufacturer(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
    url = fastapi_app.url_path_for("search_table_options")
    response = await client.get(url)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_export_success(client: AsyncClient, fastapi_app: FastAPI, set_mock_user):
    compliance_period_mock = MagicMock(spec=CompliancePeriod)
    compliance_period_mock.description = "2023"
    compliance_period_mock.effective_date = datetime(2023, 1, 1)
    compliance_period_mock.expiration_date = datetime(2023, 12, 31)

    compliance_report_mock = MagicMock(spec=ComplianceReport)
    compliance_report_mock.compliance_period = compliance_period_mock

    with patch(
        "lcfs.web.api.compliance_report.services.ComplianceReportServices.get_compliance_report_by_id"
    ) as mock_cr, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_report:
        mock_cr.return_value = compliance_report_mock
        mock_validate_report.return_value = compliance_report_mock

        with patch(
            "lcfs.web.api.final_supply_equipment.export.FinalSupplyEquipmentExporter.export"
        ) as mock_export:
            headers = {"Content-Disposition": f'attachment; filename="Cats"'}
            mock_export.return_value = StreamingResponse(
                io.BytesIO(),
                media_type=FILE_MEDIA_TYPE.XLSX.value,
                headers=headers,
            )
            set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
            url = fastapi_app.url_path_for("export", report_id="1")
            response = await client.get(url)
            assert response.status_code == 200
            assert (
                response.headers["content-type"]
                == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )


@pytest.mark.anyio
async def test_export_invalid_report_id(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
    url = fastapi_app.url_path_for("export", report_id="invalid")
    response = await client.get(url)
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid report id. Must be an integer."


# Tests for editable validation
@pytest.mark.anyio
async def test_save_final_supply_equipment_draft_status_allowed(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    valid_final_supply_equipment_schema,
):
    """Test that saving is allowed when compliance report is in Draft status"""
    mock_report = ComplianceReport(organization=Organization())
    mock_report.current_status = MagicMock()
    mock_report.current_status.status = ComplianceReportStatusEnum.Draft

    with patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_org, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_access, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_editable"
    ) as mock_validate_editable, patch(
        "lcfs.web.api.final_supply_equipment.validation.FinalSupplyEquipmentValidation.check_equipment_uniqueness_and_overlap"
    ) as mock_validate_fse, patch(
        "lcfs.web.api.final_supply_equipment.services.FinalSupplyEquipmentServices.create_final_supply_equipment"
    ) as mock_create_fse:

        mock_validate_org.return_value = mock_report
        mock_validate_access.return_value = None
        mock_validate_editable.return_value = None  # Should not raise exception
        mock_validate_fse.return_value = None
        mock_create_fse.return_value = valid_final_supply_equipment_schema

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_final_supply_equipment_row")
        payload = {
            "compliance_report_id": 456,
            "organization_name": "Example Organization",
            "supply_from_date": "2025-01-01",
            "supply_to_date": "2025-12-31",
            "kwh_usage": 250.5,
            "serial_nbr": "ABC123XYZ",
            "manufacturer": "Generic Manufacturer",
            "model": "Model X",
            "level_of_equipment": "Level 2",
            "ports": "Single port",
            "intended_use_types": ["public charging"],
            "intended_user_types": ["general public"],
            "street_address": "123 Main St",
            "city": "Anytown",
            "postal_code": "A1A 1A1",
            "latitude": 49.2827,
            "longitude": -123.1207,
            "notes": "Test equipment",
        }
        response = await client.post(url, json=payload)
        assert response.status_code == 201
        mock_validate_editable.assert_called_once()


@pytest.mark.anyio
async def test_save_final_supply_equipment_analyst_adjustment_status_allowed(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    valid_final_supply_equipment_schema,
):
    """Test that saving is allowed when compliance report is in Analyst_adjustment status"""
    mock_report = ComplianceReport(organization=Organization())
    mock_report.current_status = MagicMock()
    mock_report.current_status.status = ComplianceReportStatusEnum.Analyst_adjustment

    with patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_org, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_access, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_editable"
    ) as mock_validate_editable, patch(
        "lcfs.web.api.final_supply_equipment.validation.FinalSupplyEquipmentValidation.check_equipment_uniqueness_and_overlap"
    ) as mock_validate_fse, patch(
        "lcfs.web.api.final_supply_equipment.services.FinalSupplyEquipmentServices.create_final_supply_equipment"
    ) as mock_create_fse:

        mock_validate_org.return_value = mock_report
        mock_validate_access.return_value = None
        mock_validate_editable.return_value = None  # Should not raise exception
        mock_validate_fse.return_value = None
        mock_create_fse.return_value = valid_final_supply_equipment_schema

        set_mock_user(fastapi_app, [RoleEnum.ANALYST])
        url = fastapi_app.url_path_for("save_final_supply_equipment_row")
        payload = {
            "compliance_report_id": 456,
            "organization_name": "Example Organization",
            "supply_from_date": "2025-01-01",
            "supply_to_date": "2025-12-31",
            "kwh_usage": 250.5,
            "serial_nbr": "ABC123XYZ",
            "manufacturer": "Generic Manufacturer",
            "model": "Model X",
            "level_of_equipment": "Level 2",
            "ports": "Single port",
            "intended_use_types": ["public charging"],
            "intended_user_types": ["general public"],
            "street_address": "123 Main St",
            "city": "Anytown",
            "postal_code": "A1A 1A1",
            "latitude": 49.2827,
            "longitude": -123.1207,
            "notes": "Test equipment",
        }
        response = await client.post(url, json=payload)
        assert response.status_code == 201
        mock_validate_editable.assert_called_once()


@pytest.mark.anyio
async def test_save_final_supply_equipment_submitted_status_blocked(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test that saving is blocked when compliance report is in Submitted status"""
    from fastapi import HTTPException

    mock_report = ComplianceReport(organization=Organization())
    mock_report.current_status = MagicMock()
    mock_report.current_status.status = ComplianceReportStatusEnum.Submitted

    with patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_org, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_access, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_editable"
    ) as mock_validate_editable:

        mock_validate_org.return_value = mock_report
        mock_validate_access.return_value = None
        mock_validate_editable.side_effect = HTTPException(
            status_code=403,
            detail="Forbidden resource",
        )

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_final_supply_equipment_row")
        payload = {
            "compliance_report_id": 456,
            "organization_name": "Example Organization",
            "supply_from_date": "2025-01-01",
            "supply_to_date": "2025-12-31",
            "kwh_usage": 250.5,
            "serial_nbr": "ABC123XYZ",
            "manufacturer": "Generic Manufacturer",
            "model": "Model X",
            "level_of_equipment": "Level 2",
            "ports": "Single port",
            "intended_use_types": ["public charging"],
            "intended_user_types": ["general public"],
            "street_address": "123 Main St",
            "city": "Anytown",
            "postal_code": "A1A 1A1",
            "latitude": 49.2827,
            "longitude": -123.1207,
            "notes": "Test equipment",
        }
        response = await client.post(url, json=payload)
        assert response.status_code == 403
        assert "Forbidden resource" in response.json()["detail"]
        mock_validate_editable.assert_called_once()


@pytest.mark.anyio
async def test_get_fse_reporting_list_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful retrieval of FSE reporting list"""
    with patch(
        "lcfs.web.api.final_supply_equipment.services.FinalSupplyEquipmentServices.get_fse_reporting_list_paginated"
    ) as mock_get_reporting:
        mock_get_reporting.return_value = {
            "finalSupplyEquipments": [
                {
                    "charging_equipment_id": 1,
                    "serial_number": "SER123",
                    "manufacturer": "TestMfg",
                    "supply_from_date": "2024-01-01",
                    "supply_to_date": "2024-12-31",
                    "status": "Validated",
                }
            ],
            "pagination": {"page": 1, "size": 10, "total": 1, "total_pages": 1},
        }

        user_details = {"organization_id": 3}
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER], user_details)
        url = fastapi_app.url_path_for("get_fse_reporting_list")
        payload = {"page": 1, "size": 10, "filters": [], "sortOrders": []}
        response = await client.post(url, json=payload)

        assert response.status_code == 200
        assert "finalSupplyEquipments" in response.json()
        assert response.json()["finalSupplyEquipments"][0]["status"] == "Validated"
        # The payload gets converted to PaginationRequestSchema, so we check the call differently
        mock_get_reporting.assert_called_once()
        args = mock_get_reporting.call_args[0]
        assert args[0] == 3  # organization_id
        assert args[2] is None  # compliance_report_id
        assert args[3] is None  # mode


@pytest.mark.anyio
async def test_get_fse_reporting_list_with_params(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test FSE reporting list with organization and compliance report parameters"""
    with patch(
        "lcfs.web.api.final_supply_equipment.services.FinalSupplyEquipmentServices.get_fse_reporting_list_paginated"
    ) as mock_get_reporting:
        mock_get_reporting.return_value = {
            "finalSupplyEquipments": [],
            "pagination": {"page": 1, "size": 10, "total": 0, "total_pages": 0},
        }

        user_details = {"organization_id": 1, "is_government": True}
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT], user_details)
        url = fastapi_app.url_path_for("get_fse_reporting_list")
        params = {"organizationId": 5, "complianceReportId": 10, "mode": "current"}
        payload = {"page": 1, "size": 10, "filters": [], "sortOrders": []}
        response = await client.post(url, json=payload, params=params)

        assert response.status_code == 200
        # Check the call was made with correct parameters
        mock_get_reporting.assert_called_once()
        args = mock_get_reporting.call_args[0]
        assert args[0] == 5  # organization_id
        assert args[2] == 10  # compliance_report_id
        assert args[3] == "current"  # mode


@pytest.mark.anyio
async def test_create_fse_reporting_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful creation of FSE reporting batch"""
    with patch(
        "lcfs.web.api.final_supply_equipment.services.FinalSupplyEquipmentServices.create_fse_reporting_batch"
    ) as mock_create:
        mock_create.return_value = {"message": "FSE reporting created successfully"}

        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
        url = fastapi_app.url_path_for("create_fse_reporting")
        payload = {
            "fseReports": [
                {
                    "chargingEquipmentId": 1,
                    "complianceReportId": 10,
                    "organizationId": 1,
                    "compliancePeriodId": 1,
                    "supplyFromDate": "2024-01-01",
                    "supplyToDate": "2024-12-31",
                    "kwhUsage": 1000.0,
                }
            ],
            "complianceReportId": 10,
            "organizationId": 1,
        }
        response = await client.post(url, json=payload)

        assert response.status_code == 201
        assert "message" in response.json()


@pytest.mark.anyio
async def test_update_fse_reporting_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful update of FSE reporting"""
    with patch(
        "lcfs.web.api.final_supply_equipment.services.FinalSupplyEquipmentServices.update_fse_reporting"
    ) as mock_update:
        mock_update.return_value = {
            "id": 1,
            "supply_from_date": "2024-01-01",
            "supply_to_date": "2024-12-31",
            "kwh_usage": 1500.0,
        }

        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
        url = fastapi_app.url_path_for("update_fse_reporting", reporting_id=1)
        payload = {
            "chargingEquipmentId": 1,
            "complianceReportId": 10,
            "organizationId": 1,
            "compliancePeriodId": 1,
            "supplyFromDate": "2024-01-01",
            "supplyToDate": "2024-12-31",
            "kwhUsage": 1500.0,
        }
        response = await client.put(url, json=payload)

        assert response.status_code == 200
        assert response.json()["id"] == 1
        mock_update.assert_called_once()


@pytest.mark.anyio
async def test_delete_fse_reporting_batch_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful batch deletion of FSE reporting"""
    with patch(
        "lcfs.web.api.final_supply_equipment.services.FinalSupplyEquipmentServices.delete_fse_reporting_batch"
    ) as mock_delete:
        mock_delete.return_value = {
            "message": "2 FSE reporting records deleted successfully"
        }

        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
        url = fastapi_app.url_path_for("delete_fse_reporting_batch")
        payload = {
            "reportingIds": [1, 2],
            "complianceReportId": 10,
            "organizationId": 1,
        }
        response = await client.request("DELETE", url, json=payload)

        assert response.status_code == 200
        assert "message" in response.json()
        mock_delete.assert_called_once_with([1, 2])


@pytest.mark.anyio
async def test_set_default_dates_fse_reporting_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful setting of default dates for FSE reporting"""
    with patch(
        "lcfs.web.api.final_supply_equipment.services.FinalSupplyEquipmentServices.set_default_dates_fse_reporting"
    ) as mock_set_dates:
        mock_set_dates.return_value = {"updated": 3}

        user_details = {"organization_id": 5}
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER], user_details)
        url = fastapi_app.url_path_for("set_default_dates_fse_reporting")
        payload = {
            "equipmentIds": [1, 2, 3],
            "complianceReportId": 10,
            "organizationId": 5,
            "supplyFromDate": "2024-01-01",
            "supplyToDate": "2024-12-31",
        }
        response = await client.post(url, json=payload)

        assert response.status_code == 200
        assert response.json()["updated"] == 3
        # The payload gets converted to FSEReportingDefaultDates schema, so we just check it was called
        mock_set_dates.assert_called_once()


@pytest.mark.anyio
async def test_set_default_dates_fse_reporting_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test unauthorized access to set default dates"""
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("set_default_dates_fse_reporting")
    payload = {
        "equipmentIds": [1, 2],
        "complianceReportId": 10,
        "organizationId": 5,
        "supplyFromDate": "2024-01-01",
        "supplyToDate": "2024-12-31",
    }
    response = await client.post(url, json=payload)
    assert response.status_code == 403


# Schema validation tests for required fields
@pytest.mark.anyio
async def test_save_fse_fails_with_empty_intended_use_types(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test that saving FSE fails when intended_use_types is empty."""
    with patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_organization_access"
    ), patch(
        "lcfs.web.api.final_supply_equipment.validation.FinalSupplyEquipmentValidation.validate_fse_record"
    ):
        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_final_supply_equipment_row")
        payload = {
            "complianceReportId": 1,
            "organizationName": "Test Org",
            "supplyFromDate": "2024-01-01",
            "supplyToDate": "2024-12-31",
            "serialNbr": "ABC123",
            "manufacturer": "Test Mfg",
            "levelOfEquipment": "Level 2",
            "intendedUseTypes": [],  # Empty - should fail
            "intendedUserTypes": ["general public"],
            "streetAddress": "123 Main St",
            "city": "Anytown",
            "postalCode": "A1A 1A1",
            "latitude": 49.2827,
            "longitude": -123.1207,
        }
        response = await client.post(url, json=payload)
        assert response.status_code == 422
        data = response.json()
        assert "intendedUseTypes" in str(data) or "intended_use_types" in str(data)


@pytest.mark.anyio
async def test_save_fse_fails_with_empty_intended_user_types(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test that saving FSE fails when intended_user_types is empty."""
    with patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_organization_access"
    ), patch(
        "lcfs.web.api.final_supply_equipment.validation.FinalSupplyEquipmentValidation.validate_fse_record"
    ):
        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_final_supply_equipment_row")
        payload = {
            "complianceReportId": 1,
            "organizationName": "Test Org",
            "supplyFromDate": "2024-01-01",
            "supplyToDate": "2024-12-31",
            "serialNbr": "ABC123",
            "manufacturer": "Test Mfg",
            "levelOfEquipment": "Level 2",
            "intendedUseTypes": ["public charging"],
            "intendedUserTypes": [],  # Empty - should fail
            "streetAddress": "123 Main St",
            "city": "Anytown",
            "postalCode": "A1A 1A1",
            "latitude": 49.2827,
            "longitude": -123.1207,
        }
        response = await client.post(url, json=payload)
        assert response.status_code == 422
        data = response.json()
        assert "intendedUserTypes" in str(data) or "intended_user_types" in str(data)
