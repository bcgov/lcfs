from unittest.mock import MagicMock, AsyncMock

import pytest
from fastapi import Request

from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import FuelSupplyCreateUpdateSchema
from lcfs.web.api.fuel_supply.validation import FuelSupplyValidation


@pytest.fixture
def fuel_supply_validation():
    mock_fs_repo = MagicMock(spec=FuelSupplyRepository)
    mock_report_repo = MagicMock(spec=ComplianceReportRepository)
    request = MagicMock(spec=Request)
    validation = FuelSupplyValidation(
        request=request, fs_repo=mock_fs_repo, report_repo=mock_report_repo
    )
    return validation, mock_fs_repo, mock_report_repo


@pytest.mark.anyio
async def test_check_duplicate(fuel_supply_validation):
    validation, mock_fs_repo, _ = fuel_supply_validation
    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
    )
    mock_fs_repo.check_duplicate = AsyncMock(return_value=True)

    result = await validation.check_duplicate(fuel_supply_data)

    assert result is True
    mock_fs_repo.check_duplicate.assert_awaited_once_with(fuel_supply_data)
