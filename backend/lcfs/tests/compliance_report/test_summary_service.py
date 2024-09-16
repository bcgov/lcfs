import pytest
from unittest.mock import AsyncMock, MagicMock
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from datetime import datetime
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.compliance_report.schema import ComplianceReportSummaryRowSchema


@pytest.fixture
def mock_repo():
    return AsyncMock()


@pytest.fixture
def mock_notional_transfer_service():
    return AsyncMock()


@pytest.fixture
def trxn_repo():
    return AsyncMock()


@pytest.fixture
def summary_service(mock_repo, mock_notional_transfer_service, trxn_repo):
    return ComplianceReportSummaryService(
        repo=mock_repo,
        notional_transfer_service=mock_notional_transfer_service,
        trxn_repo=trxn_repo,
    )


@pytest.fixture
def compliance_report_repo(dbsession):
    return ComplianceReportRepository(db=dbsession)


@pytest.fixture
def compliance_report_service(compliance_report_repo):
    return ComplianceReportServices(repo=compliance_report_repo)


@pytest.mark.anyio
async def test_calculate_low_carbon_fuel_target_summary(summary_service, trxn_repo):
    # Mock input data
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 1
    report_id = 1

    # Mock fuel supply records
    mock_fuel_supplies = [
        MagicMock(
            target_ci=100, eer=1.0, ci_of_fuel=80, quantity=100000, energy_density=10
        ),  # Expected units: 20
        MagicMock(
            target_ci=90, eer=1.2, ci_of_fuel=70, quantity=200000, energy_density=8
        ),  # Expected units: 60.8
        MagicMock(
            target_ci=80, eer=0.5, ci_of_fuel=60, quantity=300000, energy_density=8
        ),  # Expected units: -48
    ]
    summary_service.get_effective_fuel_supplies = AsyncMock(
        return_value=mock_fuel_supplies
    )

    # Mock repository method returns
    summary_service.repo.get_transferred_out_compliance_units.return_value = 500
    summary_service.repo.get_received_compliance_units.return_value = 300
    summary_service.repo.get_issued_compliance_units.return_value = 200
    trxn_repo.calculate_available_balance_for_period.return_value = 1000

    # Call the method
    summary, penalty_unit = (
        await summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start, compliance_period_end, organization_id
        )
    )

    # Assertions
    assert isinstance(summary, list)
    assert all(isinstance(item, ComplianceReportSummaryRowSchema) for item in summary)
    assert len(summary) == 11  # Ensure all 11 lines are present

    # Check specific line values
    line_values = {item.line: item.value for item in summary}
    assert line_values["12"] == 500  # Transferred out
    assert line_values["13"] == 300  # Received
    assert line_values["14"] == 200  # Issued
    assert line_values["18"] == 0  # Not calculated yet
    assert line_values["19"] == 0  # Not calculated yet
    assert line_values["20"] == 0  # Not calculated yet
    assert line_values["21"] == 0  # Not calculated yet
    assert line_values["22"] == 1000  # Add all the above

    # Verify method calls
    summary_service.repo.get_transferred_out_compliance_units.assert_called_once_with(
        compliance_period_start, compliance_period_end, organization_id
    )
    summary_service.repo.get_received_compliance_units.assert_called_once_with(
        compliance_period_start, compliance_period_end, organization_id
    )
    summary_service.repo.get_issued_compliance_units.assert_called_once_with(
        compliance_period_start, compliance_period_end, organization_id
    )
    trxn_repo.calculate_available_balance_for_period.assert_called_once_with(
        organization_id, compliance_period_start.year
    )
