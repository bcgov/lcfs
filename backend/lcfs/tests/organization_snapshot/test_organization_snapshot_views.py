from unittest.mock import AsyncMock

import pytest
from fastapi import status
from httpx import AsyncClient

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.organization_snapshot.schema import OrganizationSnapshotSchema
from lcfs.web.api.organization_snapshot.services import OrganizationSnapshotService


@pytest.fixture
def mock_org_snapshot_service(fastapi_app):
    org_service = AsyncMock(spec=OrganizationSnapshotService)
    fastapi_app.dependency_overrides[OrganizationSnapshotService] = lambda: org_service
    return org_service


@pytest.fixture
def mock_report_validation(fastapi_app):
    validation_service = AsyncMock(spec=ComplianceReportValidation)
    fastapi_app.dependency_overrides[ComplianceReportValidation] = (
        lambda: validation_service
    )
    return validation_service


@pytest.mark.anyio
async def test_get_snapshot_by_compliance_report_id(
    client: AsyncClient,
    fastapi_app,
    mock_org_snapshot_service,
    mock_report_validation,
    set_mock_user,
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    compliance_report_id = "1"
    url = fastapi_app.url_path_for(
        "get_snapshot_by_compliance_report_id",
        compliance_report_id=compliance_report_id,
    )
    response = OrganizationSnapshotSchema(
        compliance_report_id=1,
        is_edited=True,
        name="Example Name",
        operating_name="Example Operating Name",
        email="example@example.com",
        phone="123-456-7890",
        head_office_address="123 BC St.",
        records_address="789 BC St.",
        service_address="456 Service Rd.",
    )
    mock_org_snapshot_service.get_by_compliance_report_id = AsyncMock(
        return_value=response
    )

    expected_response = {
        "complianceReportId": 1,
        "isEdited": True,
        "name": "Example Name",
        "operatingName": "Example Operating Name",
        "email": "example@example.com",
        "phone": "123-456-7890",
        "headOfficeAddress": "123 BC St.",
        "recordsAddress": "789 BC St.",
        "serviceAddress": "456 Service Rd.",
    }

    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == expected_response

    mock_report_validation.validate_organization_access.assert_awaited_once_with(
        int(compliance_report_id)
    )
    mock_org_snapshot_service.get_by_compliance_report_id.assert_awaited_once_with(
        int(compliance_report_id)
    )


@pytest.mark.anyio
async def test_update_compliance_report_snapshot(
    client: AsyncClient,
    fastapi_app,
    mock_org_snapshot_service,
    mock_report_validation,
    set_mock_user,
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    compliance_report_id = 1

    url = fastapi_app.url_path_for(
        "update_compliance_report_snapshot", compliance_report_id=compliance_report_id
    )

    request_data = OrganizationSnapshotSchema(
        compliance_report_id=compliance_report_id,
        is_edited=True,
        name="Updated Name",
        operating_name="Updated Operating Name",
        email="updated@example.com",
        phone="987-654-3210",
        head_office_address="789 Updated BC St.",
        records_address="756 Updated BC St.",
        service_address="321 Updated Service Rd.",
    ).model_dump()

    expected_response = {
        "complianceReportId": compliance_report_id,
        "isEdited": True,
        "name": "Updated Name",
        "operatingName": "Updated Operating Name",
        "email": "updated@example.com",
        "phone": "987-654-3210",
        "headOfficeAddress": "789 Updated BC St.",
        "recordsAddress": "756 Updated BC St.",
        "serviceAddress": "321 Updated Service Rd.",
    }

    mock_org_snapshot_service.update = AsyncMock(return_value=request_data)

    response = await client.put(url, json=request_data)

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == expected_response

    mock_report_validation.validate_organization_access.assert_awaited_once_with(
        compliance_report_id
    )
