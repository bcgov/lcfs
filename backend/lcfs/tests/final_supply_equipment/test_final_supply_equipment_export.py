from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.responses import StreamingResponse

from lcfs.db.models import Organization
from lcfs.db.models.user.Role import RoleEnum
from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.web.api.final_supply_equipment.export import FinalSupplyEquipmentExporter
from lcfs.web.exception.exceptions import DataNotFoundException


def _build_compliance_period(year: str = "2023"):
    return MagicMock(
        description=year,
        effective_date=datetime(int(year), 1, 1),
        expiration_date=datetime(int(year), 12, 31),
    )


def _build_services_mock():
    svc = MagicMock()
    svc.get_compliance_report_by_id = AsyncMock(
        return_value=MagicMock(compliance_period=_build_compliance_period())
    )
    return svc


@pytest.fixture
def repo_mock():
    with patch(
        "lcfs.web.api.final_supply_equipment.export.FinalSupplyEquipmentRepository"
    ) as cls:
        repo = cls.return_value
        repo.get_fse_options = AsyncMock(
            return_value=[[], [], [], ["Port1", "Port2"], ["Org1", "Org2"]]
        )
        repo.get_fse_paginated = AsyncMock(return_value=([],))
        return repo


@pytest.fixture
def exporter(repo_mock):
    exp = FinalSupplyEquipmentExporter(repo=repo_mock)
    exp.compliance_report_services = _build_services_mock()
    return exp


@pytest.mark.anyio
async def test_export_success(exporter, fastapi_app, set_mock_user):
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
        == 'attachment; filename="FSE_TestOrg-2023.xlsx"'
    )
    assert response.media_type == FILE_MEDIA_TYPE["XLSX"].value


@pytest.mark.anyio
async def test_export_no_data(exporter, fastapi_app, set_mock_user):
    # Force empty dataset
    exporter.repo.get_fse_paginated = AsyncMock(return_value=([],))

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
        == 'attachment; filename="FSE_TestOrg-2023.xlsx"'
    )
    assert response.media_type == FILE_MEDIA_TYPE["XLSX"].value


@pytest.mark.anyio
async def test_export_invalid_compliance_report_id(
    exporter, fastapi_app, set_mock_user
):
    user = set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    # Simulate “not found”
    exporter.compliance_report_services.get_compliance_report_by_id = AsyncMock(
        side_effect=DataNotFoundException("Report not found")
    )

    with pytest.raises(DataNotFoundException):
        await exporter.export(
            compliance_report_id=999,
            user=user,
            organization=Organization(name="TestOrg"),
            include_data=True,
        )
