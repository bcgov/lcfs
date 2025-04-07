from datetime import datetime
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from starlette.responses import StreamingResponse

from lcfs.db.models import Organization
from lcfs.db.models.user.Role import RoleEnum
from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.web.api.allocation_agreement.export import AllocationAgreementExporter
from lcfs.web.exception.exceptions import DataNotFoundException
from types import SimpleNamespace


@pytest.fixture
def exporter(repo_mock, compliance_report_services_mock):
    return AllocationAgreementExporter(
        repo=repo_mock, compliance_report_services=compliance_report_services_mock
    )


@pytest.fixture
def repo_mock():
    with patch(
        "lcfs.web.api.allocation_agreement.export.AllocationAgreementRepository"
    ) as mock:
        mock_instance = mock.return_value
        mock_instance.get_allocation_agreement_options = AsyncMock(
            return_value=[
                ["Option1", "Option2"],
                ["Org1", "Org2"],
            ]
        )
        # Create mock objects with type attribute
        type1 = MagicMock()
        type1.type = "Type1"
        type2 = MagicMock()
        type2.type = "Type2"
        # Create fuel types as dicts instead of MagicMocks so that subscripting works.
        fuel_type1 = {"fuel_type": "Gasoline"}
        fuel_type2 = {"fuel_type": "Diesel"}
        # Return all required table options
        mock_instance.get_table_options = AsyncMock(
            return_value={
                "allocation_transaction_types": [type1, type2],
                "fuel_types": [fuel_type1, fuel_type2],
                "fuel_categories": [],
                "provisions_of_the_act": [],
                "trading_partners": ["Partner1", "Partner2"],
                "organization_names": ["Org1", "Org2"],
            }
        )
        mock_instance.get_allocation_agreements_paginated = AsyncMock(
            return_value=([], 0)
        )
        # Ensure that get_allocation_agreements is an async method.
        mock_instance.get_allocation_agreements = AsyncMock(return_value=[])
        mock_instance.load_allocation_agreement_data = AsyncMock(return_value=[])
        return mock_instance


@pytest.fixture
def compliance_report_services_mock():
    with patch(
        "lcfs.web.api.allocation_agreement.export.ComplianceReportServices"
    ) as mock:
        mock_instance = mock.return_value
        # Create a plain object for compliance_period (all datetimes are naive)
        compliance_period = SimpleNamespace(
            description="2023",
            effective_date=datetime(2023, 1, 1),
            expiration_date=datetime(2023, 12, 31),
        )
        mock_instance.get_compliance_report_by_id = AsyncMock(
            return_value=SimpleNamespace(compliance_period=compliance_period)
        )
        return mock_instance


@pytest.mark.anyio
async def test_export_success(
    exporter, fastapi_app, client, set_mock_user, compliance_report_services_mock
):
    user = set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    response = await exporter.export(
        compliance_report_id=1,
        user=user,
        organization=Organization(name="TestOrg"),
        include_data=True,
    )
    assert isinstance(response, StreamingResponse)
    assert response.status_code == 200
    assert (
        response.headers["Content-Disposition"]
        == 'attachment; filename="AllocationAgreements_TestOrg-2023.xlsx"'
    )
    assert response.media_type == FILE_MEDIA_TYPE["XLSX"].value


@pytest.mark.anyio
async def test_export_no_data(
    exporter, fastapi_app, client, set_mock_user, compliance_report_services_mock
):
    exporter.repo.get_allocation_agreements_paginated = AsyncMock(return_value=([], 0))
    user = set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    response = await exporter.export(
        compliance_report_id=1,
        user=user,
        organization=Organization(name="TestOrg"),
        include_data=False,
    )
    assert isinstance(response, StreamingResponse)
    assert response.status_code == 200
    assert (
        response.headers["Content-Disposition"]
        == 'attachment; filename="AllocationAgreements_TestOrg-2023.xlsx"'
    )
    assert response.media_type == FILE_MEDIA_TYPE["XLSX"].value


@pytest.mark.anyio
async def test_export_invalid_compliance_report_id(
    exporter, fastapi_app, client, set_mock_user
):
    user = set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    exporter.compliance_report_services.get_compliance_report_by_id = AsyncMock(
        side_effect=DataNotFoundException("Report not found")
    )
    with pytest.raises(DataNotFoundException) as exc_info:
        await exporter.export(
            compliance_report_id=999,
            user=user,
            organization=Organization(name="TestOrg"),
            include_data=True,
        )
    assert str(exc_info.value) == "Report not found"
