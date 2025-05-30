import datetime
import json
import pytest
from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from httpx import AsyncClient
from unittest.mock import patch, MagicMock

from lcfs.db.models import ComplianceReport, Organization
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.web.api.fuel_export.schema import (
    FuelExportSchema,
    FuelExportCreateUpdateSchema,
    CommonPaginatedReportRequestSchema,
    FuelCategoryResponseSchema,
    ProvisionOfTheActSchema,
    FuelTypeSchema,
    FuelExportsSchema,
    FuelTypeOptionsResponse,
    DeleteFuelExportResponseSchema,
)


# get_fuel_export_table_options
@pytest.mark.anyio
async def test_get_fuel_export_table_options_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    with patch(
        "lcfs.web.api.fuel_export.views.FuelExportServices.get_fuel_export_options"
    ) as mock_get_fuel_export_options:

        mock_fuel_export_options = FuelTypeOptionsResponse(fuel_types=[])

        mock_get_fuel_export_options.return_value = mock_fuel_export_options

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

        url = fastapi_app.url_path_for("get_fuel_export_table_options")

        response = await client.get(url, params={"compliancePeriod": "2024"})

        assert response.status_code == 200

        expected_response = json.loads(mock_fuel_export_options.json(by_alias=True))

        assert response.json() == expected_response


# get_fuel_exports
@pytest.mark.anyio
async def test_get_fuel_exports_invalid_payload(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

    url = fastapi_app.url_path_for("get_fuel_exports")

    payload = {}

    response = await client.post(
        url,
        json=payload,
    )

    assert response.status_code == 422


@pytest.mark.anyio
async def test_get_fuel_exports_paginated_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    compliance_report_base_schema,
):
    with patch(
        "lcfs.web.api.fuel_export.views.FuelExportServices.get_fuel_exports_paginated"
    ) as mock_get_fuel_exports_paginated, patch(
        "lcfs.web.api.fuel_export.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.fuel_export.views.FuelExportServices.get_compliance_report_by_id"
    ) as mock_get_compliance_report_by_id:

        mock_get_fuel_exports_paginated.return_value = FuelExportsSchema(
            fuel_exports=[]
        )
        mock_validate_organization_access.return_value = True

        mock_compliance_report = compliance_report_base_schema()

        mock_get_compliance_report_by_id.return_value = mock_compliance_report
        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

        url = fastapi_app.url_path_for("get_fuel_exports")

        payload = CommonPaginatedReportRequestSchema(
            compliance_report_id=1, page=1, size=1, sort_orders=[], filters=[]
        ).dict()

        response = await client.post(
            url,
            json=payload,
        )

        assert response.status_code == 200


@pytest.mark.anyio
async def test_get_fuel_exports_list_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    compliance_report_base_schema,
):
    with patch(
        "lcfs.web.api.fuel_export.views.FuelExportServices.get_fuel_export_list"
    ) as mock_get_fuel_export_list, patch(
        "lcfs.web.api.fuel_export.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.fuel_export.views.FuelExportServices.get_compliance_report_by_id"
    ) as mock_get_compliance_report_by_id:

        mock_get_fuel_export_list.return_value = FuelExportsSchema(fuel_exports=[])
        mock_validate_organization_access.return_value = True

        mock_compliance_report = compliance_report_base_schema()

        mock_get_compliance_report_by_id.return_value = mock_compliance_report

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

        url = fastapi_app.url_path_for("get_fuel_exports")

        payload = CommonPaginatedReportRequestSchema(compliance_report_id=1).dict()

        response = await client.post(
            url,
            json=payload,
        )

        assert response.status_code == 200


# save_fuel_export_row
@pytest.mark.anyio
async def test_save_fuel_export_row_forbidden(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.TRANSFER])

    url = fastapi_app.url_path_for("save_fuel_export_row")

    payload = {
        "compliance_report_id": 1,
        "fuel_type": "",
        "fuel_type_id": 1,
        "fuel_category": "",
        "fuel_category_id": 1,
        "end_use_id": 1,
        "provision_of_the_act": "",
        "provision_of_the_act_id": 1,
        "quantity": 1,
        "units": "",
        "export_date": "2024-01-01",
    }

    response = await client.post(
        url,
        json=payload,
    )
    assert response.status_code == 403  # Forbidden


@pytest.mark.anyio
async def test_save_fuel_export_row_invalid_payload(
    client: AsyncClient, fastapi_app: FastAPI
):

    url = fastapi_app.url_path_for("save_fuel_export_row")

    payload = {}

    response = await client.post(
        url,
        json=payload,
    )
    assert response.status_code == 422


@pytest.mark.anyio
async def test_save_fuel_export_row_delete_success(client, fastapi_app, set_mock_user):

    with patch(
        "lcfs.web.api.fuel_export.actions_service.FuelExportActionService.delete_fuel_export"
    ) as mock_delete_fuel_export, patch(
        "lcfs.web.api.fuel_export.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.fuel_export.views.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_compliance_report_access:
        mock_validate_organization_access.return_value = ComplianceReport()
        mock_delete_response = DeleteFuelExportResponseSchema(
            success=True, message="fuel export row deleted successfully"
        )

        mock_delete_fuel_export.return_value = mock_delete_response

        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_fuel_export_row")

        # Create payload using the schema with all required fields
        payload = FuelExportCreateUpdateSchema(
            fuel_export_id=1,
            compliance_report_id=1,
            fuel_type_id=1,
            fuel_category_id=1,
            end_use_id=1,
            provision_of_the_act_id=1,
            quantity=100,
            units="L",
            deleted=True,
            export_date=datetime.date(2024, 1, 1),
        ).dict(exclude_none=True)

        response = await client.post(url, json=jsonable_encoder(payload))

        assert response.status_code == 201
        assert response.json() == mock_delete_response.dict()
        mock_delete_fuel_export.assert_called_once()


@pytest.mark.anyio
async def test_save_fuel_export_row_update_success(client, fastapi_app, set_mock_user):
    with patch(
        "lcfs.web.api.fuel_export.actions_service.FuelExportActionService.update_fuel_export"
    ) as mock_update_fuel_export, patch(
        "lcfs.web.api.fuel_export.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.fuel_export.views.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_compliance_report_access:
        mock_validate_organization_access.return_value = ComplianceReport()

        # Create mock classes if not already defined at module level
        class MockCompliancePeriod:
            def __init__(self, description: str):
                self.description = description

        class MockComplianceReport:
            def __init__(self, compliance_period: MockCompliancePeriod):
                self.compliance_period = compliance_period

        # Set up mock return value for validate_organization_access
        mock_compliance_report = MockComplianceReport(
            compliance_period=MockCompliancePeriod(description="2024")
        )

        mock_fuel_export = FuelExportSchema(
            fuel_export_id=1,
            compliance_report_id=1,
            fuel_type_id=1,
            fuel_type=FuelTypeSchema(
                fuel_type_id=1,
                fuel_type="Diesel",
                units="L",
                default_carbon_intensity=1,
            ),
            quantity=1,
            units="L",
            export_date=datetime.date(2024, 1, 1),
            fuel_category_id=1,
            end_use_id=1,
            fuel_category=FuelCategoryResponseSchema(category="Diesel"),
            compliance_period="2024",
            provision_of_the_act_id=1,
            provision_of_the_act=ProvisionOfTheActSchema(
                provision_of_the_act_id=1,
                name="Test Provision",
            ),
        )

        # Create update payload with all required fields
        update_payload = FuelExportCreateUpdateSchema(
            fuel_export_id=1,
            compliance_report_id=1,
            fuel_type_id=1,
            fuel_category_id=1,
            end_use_id=1,
            provision_of_the_act_id=1,
            quantity=1,
            units="L",
            export_date=datetime.date(2024, 1, 1),
        )

        mock_validate_organization_access.return_value = mock_compliance_report
        mock_update_fuel_export.return_value = mock_fuel_export

        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])

        url = fastapi_app.url_path_for("save_fuel_export_row")

        response = await client.post(
            url, json=jsonable_encoder(update_payload.dict(exclude_none=True))
        )

        assert response.status_code == 201
        mock_update_fuel_export.assert_called_once()


@pytest.mark.anyio
async def test_save_fuel_export_row_create_success(client, fastapi_app, set_mock_user):
    with patch(
        "lcfs.web.api.fuel_export.actions_service.FuelExportActionService.create_fuel_export"
    ) as mock_create_fuel_export, patch(
        "lcfs.web.api.fuel_export.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.fuel_export.views.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_compliance_report_access:
        mock_validate_organization_access.return_value = ComplianceReport()

        # Create mock classes
        class MockCompliancePeriod:
            def __init__(self, description: str):
                self.description = description

        class MockComplianceReport:
            def __init__(self, compliance_period: MockCompliancePeriod):
                self.compliance_period = compliance_period

        # Set up mock return value for validate_organization_access
        mock_compliance_report = MockComplianceReport(
            compliance_period=MockCompliancePeriod(description="2024")
        )

        # Create payload with all required fields
        create_payload = FuelExportCreateUpdateSchema(
            compliance_report_id=1,
            fuel_type_id=1,
            fuel_category_id=1,
            end_use_id=1,
            provision_of_the_act_id=1,
            quantity=1,
            units="L",
            export_date=datetime.date(2024, 1, 1),
            compliance_period="2024",
        )

        mock_fuel_export = FuelExportSchema(
            compliance_report_id=1,
            fuel_type_id=1,
            fuel_type=FuelTypeSchema(
                fuel_type_id=1,
                fuel_type="Diesel",
                units="L",
                default_carbon_intensity=1,
            ),
            quantity=1,
            units="L",
            export_date=datetime.date(2024, 1, 1),
            fuel_category_id=1,
            end_use_id=1,
            fuel_category=FuelCategoryResponseSchema(category="Diesel"),
            compliance_period="2024",
            provision_of_the_act_id=1,
            provision_of_the_act=ProvisionOfTheActSchema(
                provision_of_the_act_id=1,
                name="Test Provision",
            ),
        )

        mock_validate_organization_access.return_value = mock_compliance_report
        mock_create_fuel_export.return_value = mock_fuel_export
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_fuel_export_row")

        response = await client.post(
            url, json=jsonable_encoder(create_payload.dict(exclude_none=True))
        )

        assert response.status_code == 201
        mock_create_fuel_export.assert_called_once()


# Tests for editable validation
@pytest.mark.anyio
async def test_save_fuel_export_draft_status_allowed(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
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
        "lcfs.web.api.fuel_export.actions_service.FuelExportActionService.create_fuel_export"
    ) as mock_create:

        mock_validate_org.return_value = mock_report
        mock_validate_access.return_value = None
        mock_validate_editable.return_value = None  # Should not raise exception
        mock_create.return_value = {
            "fuel_export_id": 1,
            "compliance_report_id": 1,
            "fuel_type": "Gasoline",
            "quantity": 1000,
        }

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_fuel_export_row")
        payload = {
            "compliance_report_id": 1,
            "fuel_type_id": 1,
            "fuel_category_id": 1,
            "end_use_id": 24,
            "provision_of_the_act_id": 1,
            "quantity": 1000,
            "units": "L",
            "export_date": "2024-01-01",
        }
        response = await client.post(url, json=payload)
        assert response.status_code == 201
        mock_validate_editable.assert_called_once()


@pytest.mark.anyio
async def test_save_fuel_export_submitted_status_blocked(
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
            detail="Compliance report cannot be edited in Submitted status",
        )

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_fuel_export_row")
        payload = {
            "compliance_report_id": 1,
            "fuel_type_id": 1,
            "fuel_category_id": 1,
            "end_use_id": 24,
            "provision_of_the_act_id": 1,
            "quantity": 1000,
            "units": "L",
            "export_date": "2024-01-01",
        }
        response = await client.post(url, json=payload)
        assert response.status_code == 403
        assert "cannot be edited" in response.json()["detail"]
        mock_validate_editable.assert_called_once()
