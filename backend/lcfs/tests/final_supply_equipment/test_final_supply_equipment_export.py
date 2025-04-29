from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from docutils.nodes import description
from starlette.responses import StreamingResponse

from lcfs.db.models import Organization
from lcfs.db.models.user.Role import RoleEnum
from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.web.api.final_supply_equipment.export import FinalSupplyEquipmentExporter
from lcfs.web.exception.exceptions import DataNotFoundException


@pytest.fixture
def exporter(repo_mock, compliance_report_repo_mock):
    return FinalSupplyEquipmentExporter(
        repo=repo_mock, compliance_report_repo=compliance_report_repo_mock
    )


@pytest.fixture
def repo_mock():
    with patch(
        "lcfs.web.api.final_supply_equipment.export.FinalSupplyEquipmentRepository"
    ) as mock:
        mock_instance = mock.return_value
        mock_instance.get_fse_options = AsyncMock(
            return_value=[
                [],
                [],
                [],
                ["Port1", "Port2"],
                ["Org1", "Org2"],
            ]
        )
        mock_instance.get_fse_paginated = AsyncMock(return_value=([],))
        return mock_instance


@pytest.fixture
def compliance_report_repo_mock():
    with patch(
        "lcfs.web.api.final_supply_equipment.export.ComplianceReportRepository"
    ) as mock:
        mock_instance = mock.return_value
        mock_instance.get_compliance_report_by_id = AsyncMock(
            return_value=AsyncMock(
                compliance_period=AsyncMock(
                    description="2023",
                    effective_date=datetime(2023, 1, 1),
                    expiration_date=datetime(2023, 12, 31),
                )
            )
        )
        return mock_instance


@pytest.mark.anyio
async def test_export_success(
    exporter, fastapi_app, client, set_mock_user, compliance_report_repo_mock
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    response = await exporter.export(
        compliance_report_id=1,
        organization=Organization(name="TestOrg"),
        include_data=True,
    )
    assert isinstance(response, StreamingResponse)
    assert response.status_code == 200
    assert (
        response.headers["Content-Disposition"]
        == 'attachment; filename="FSE_TestOrg-2023.xlsx"'
    )
    assert response.media_type == FILE_MEDIA_TYPE["XLSX"].value


@pytest.mark.anyio
async def test_export_no_data(
    exporter, fastapi_app, client, set_mock_user, compliance_report_repo_mock
):
    exporter.repo.get_fse_paginated = AsyncMock(return_value=([],))
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    response = await exporter.export(
        compliance_report_id=1,
        organization=Organization(name="TestOrg"),
        include_data=False,
    )
    assert isinstance(response, StreamingResponse)
    assert response.status_code == 200
    assert (
        response.headers["Content-Disposition"]
        == 'attachment; filename="FSE_TestOrg-2023.xlsx"'
    )
    assert response.media_type == FILE_MEDIA_TYPE["XLSX"].value


@pytest.mark.anyio
async def test_export_invalid_compliance_report_id(
    exporter, fastapi_app, client, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    exporter.compliance_report_repo.get_compliance_report_by_id = AsyncMock(
        return_value=None
    )
    with pytest.raises(DataNotFoundException) as exc_info:
        await exporter.export(
            compliance_report_id=999,
            organization=Organization(name="TestOrg"),
            include_data=True,
        )
    assert "Compliance report not found" in str(exc_info.value)
