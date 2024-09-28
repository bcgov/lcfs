import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime
from lcfs.web.api.compliance_report.schema import ComplianceReportSummaryRowSchema
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from typing import List, Dict, Any, Tuple


@pytest.mark.anyio
async def test_calculate_low_carbon_fuel_target_summary(
    compliance_report_summary_service, mock_trxn_repo, mock_repo
):

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
    compliance_report_summary_service.get_effective_fuel_supplies = AsyncMock(
        return_value=mock_fuel_supplies
    )

    # Mock repository method returns
    mock_repo.get_transferred_out_compliance_units.return_value = 500
    mock_repo.get_received_compliance_units.return_value = 300
    mock_repo.get_issued_compliance_units.return_value = 200
    mock_trxn_repo.calculate_available_balance_for_period.return_value = 1000
    compliance_report_summary_service.calculate_fuel_supply_compliance_units = (
        AsyncMock(return_value=100)
    )
    compliance_report_summary_service.calculate_fuel_export_compliance_units = (
        AsyncMock(return_value=100)
    )

    # Call the method
    summary, penalty = (
        await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start, compliance_period_end, organization_id, report_id
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
    assert line_values["18"] == 100
    assert line_values["19"] == 100
    assert line_values["20"] == 200
    assert line_values["21"] == 0  # Not calculated yet
    assert line_values["22"] == 1200  # Add all the above

    # Verify method calls
    mock_repo.get_transferred_out_compliance_units.assert_called_once_with(
        compliance_period_start, compliance_period_end, organization_id
    )
    mock_repo.get_received_compliance_units.assert_called_once_with(
        compliance_period_start, compliance_period_end, organization_id
    )
    mock_repo.get_issued_compliance_units.assert_called_once_with(
        compliance_period_start, compliance_period_end, organization_id
    )
    mock_trxn_repo.calculate_available_balance_for_period.assert_called_once_with(
        organization_id, compliance_period_start.year
    )


@pytest.mark.anyio
async def test_calculate_renewable_fuel_target_summary_2024(
    compliance_report_summary_service,
):

    fossil_quantities = {"gasoline": 100, "diesel": 100, "jet_fuel": 100}
    renewable_quantities = {"gasoline": 100, "diesel": 100, "jet_fuel": 100}
    previous_retained = {"gasoline": 100, "diesel": 100, "jet_fuel": 100}
    previous_obligation = {"gasoline": 100, "diesel": 100, "jet_fuel": 100}
    notional_transfers_sum = {"gasoline": 100, "diesel": 100, "jet_fuel": 100}
    compliance_period = 2024
    summary_model = ComplianceReportSummary(
        line_8_obligation_deferred_gasoline=100,
        line_8_obligation_deferred_diesel=100,
        line_8_obligation_deferred_jet_fuel=100,
    )

    result = compliance_report_summary_service.calculate_renewable_fuel_target_summary(
        fossil_quantities,
        renewable_quantities,
        previous_retained,
        previous_obligation,
        notional_transfers_sum,
        compliance_period,
        summary_model,
    )

    assert len(result) == 11
    assert isinstance(result[0], ComplianceReportSummaryRowSchema)
    assert result[2].gasoline == 200
    assert result[3].diesel == 8.0
    assert result[7].gasoline == 0.5
    assert result[9].gasoline == 200.5


@pytest.mark.anyio
async def test_calculate_renewable_fuel_target_summary_2028(
    compliance_report_summary_service,
):

    fossil_quantities = {"gasoline": 100, "diesel": 300, "jet_fuel": 500}
    renewable_quantities = {"gasoline": 200, "diesel": 400, "jet_fuel": 600}
    previous_retained = {"gasoline": 300, "diesel": 500, "jet_fuel": 100}
    previous_obligation = {"gasoline": 400, "diesel": 600, "jet_fuel": 200}
    notional_transfers_sum = {"gasoline": 500, "diesel": 100, "jet_fuel": 300}
    compliance_period = 2028
    summary_model = ComplianceReportSummary(
        line_6_renewable_fuel_retained_gasoline=100,
        line_6_renewable_fuel_retained_diesel=200,
        line_6_renewable_fuel_retained_jet_fuel=300,
        line_8_obligation_deferred_gasoline=300,
        line_8_obligation_deferred_diesel=200,
        line_8_obligation_deferred_jet_fuel=100,
    )

    result = compliance_report_summary_service.calculate_renewable_fuel_target_summary(
        fossil_quantities,
        renewable_quantities,
        previous_retained,
        previous_obligation,
        notional_transfers_sum,
        compliance_period,
        summary_model,
    )

    assert len(result) == 11
    assert isinstance(result[0], ComplianceReportSummaryRowSchema)

    assert result[2].diesel == 700
    assert result[3].jet_fuel == 11
    assert result[5].gasoline == 0.75
    assert result[9].diesel == 398.6


@pytest.mark.anyio
async def test_calculate_renewable_fuel_target_summary_2029(
    compliance_report_summary_service,
):

    fossil_quantities = {"gasoline": 300, "diesel": 200, "jet_fuel": 100}
    renewable_quantities = {"gasoline": 100, "diesel": 300, "jet_fuel": 200}
    previous_retained = {"gasoline": 200, "diesel": 100, "jet_fuel": 300}
    previous_obligation = {"gasoline": 300, "diesel": 200, "jet_fuel": 100}
    notional_transfers_sum = {"gasoline": 100, "diesel": 300, "jet_fuel": 200}
    compliance_period = 2029
    summary_model = ComplianceReportSummary(
        line_6_renewable_fuel_retained_gasoline=100,
        line_6_renewable_fuel_retained_diesel=200,
        line_6_renewable_fuel_retained_jet_fuel=300,
        line_8_obligation_deferred_gasoline=300,
        line_8_obligation_deferred_diesel=200,
        line_8_obligation_deferred_jet_fuel=100,
    )

    result = compliance_report_summary_service.calculate_renewable_fuel_target_summary(
        fossil_quantities,
        renewable_quantities,
        previous_retained,
        previous_obligation,
        notional_transfers_sum,
        compliance_period,
        summary_model,
    )

    assert len(result) == 11
    assert isinstance(result[0], ComplianceReportSummaryRowSchema)

    assert result[2].diesel == 500
    assert result[3].jet_fuel == 6
    assert result[5].gasoline == 0
    assert result[7].gasoline == 1
    assert result[9].jet_fuel == 599.7


@pytest.mark.anyio
async def test_calculate_renewable_fuel_target_summary_2030(
    compliance_report_summary_service,
):

    fossil_quantities = {"gasoline": 100, "diesel": 200, "jet_fuel": 300}
    renewable_quantities = {"gasoline": 200, "diesel": 300, "jet_fuel": 100}
    previous_retained = {"gasoline": 300, "diesel": 100, "jet_fuel": 200}
    previous_obligation = {"gasoline": 100, "diesel": 200, "jet_fuel": 300}
    notional_transfers_sum = {"gasoline": 200, "diesel": 300, "jet_fuel": 100}
    compliance_period = 2030
    summary_model = ComplianceReportSummary(
        line_6_renewable_fuel_retained_gasoline=300,
        line_6_renewable_fuel_retained_diesel=200,
        line_6_renewable_fuel_retained_jet_fuel=100,
        line_8_obligation_deferred_gasoline=100,
        line_8_obligation_deferred_diesel=100,
        line_8_obligation_deferred_jet_fuel=100,
    )

    result = compliance_report_summary_service.calculate_renewable_fuel_target_summary(
        fossil_quantities,
        renewable_quantities,
        previous_retained,
        previous_obligation,
        notional_transfers_sum,
        compliance_period,
        summary_model,
    )

    assert len(result) == 11
    assert isinstance(result[0], ComplianceReportSummaryRowSchema)
    assert result[2].gasoline == 300
    assert result[3].diesel == 20
    assert result[5].gasoline == 0.75
    assert result[9].diesel == 499


@pytest.mark.anyio
async def test_calculate_non_compliance_penalty_summary_without_penalty_payable(
    compliance_report_summary_service, compliance_report_summary_row_schema
):
    mock_compliance_report_summary = [
        compliance_report_summary_row_schema(
            line="11",
            gasoline=1000,
            diesel=2000,
            jet_fuel=3000,
        )
    ]

    result = compliance_report_summary_service.calculate_non_compliance_penalty_summary(
        0, mock_compliance_report_summary
    )

    assert len(result) == 3
    assert result[0].total_value == 6000
    assert result[1].total_value == 0
    assert result[2].total_value == 6000


@pytest.mark.anyio
async def test_calculate_non_compliance_penalty_summary_with_penalty_payable(
    compliance_report_summary_service, compliance_report_summary_row_schema
):
    mock_compliance_report_summary = [
        compliance_report_summary_row_schema(
            line="11",
            gasoline=1000,
            diesel=2000,
            jet_fuel=3000,
        )
    ]

    result = compliance_report_summary_service.calculate_non_compliance_penalty_summary(
        -2, mock_compliance_report_summary
    )

    assert len(result) == 3
    assert result[0].total_value == 6000
    assert result[1].total_value == 1200
    assert result[2].total_value == 7200
