from datetime import datetime
from typing import List
from unittest.mock import AsyncMock, MagicMock, Mock

import pytest

from lcfs.db.models import FuelSupply, ComplianceReport, UserProfile
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportSummaryRowSchema,
)


@pytest.mark.anyio
async def test_calculate_low_carbon_fuel_target_summary(
    compliance_report_summary_service, mock_trxn_repo, mock_repo
):

    # Mock input data
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 1
    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.version = 0

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
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )
    )

    # Assertions
    assert isinstance(summary, list)
    assert all(isinstance(item, ComplianceReportSummaryRowSchema) for item in summary)
    assert len(summary) == 11  # Ensure all 11 lines are present

    # Check specific line values
    line_values = {item.line: item.value for item in summary}
    assert line_values[12] == 500  # Transferred out
    assert line_values[13] == 300  # Received
    assert line_values[14] == 200  # Issued
    assert line_values[18] == 100
    assert line_values[19] == 100
    assert line_values[20] == 200
    assert line_values[21] == 0  # Not calculated yet
    assert line_values[22] == 1200  # Add all the above

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
async def test_supplemental_low_carbon_fuel_target_summary(
    compliance_report_summary_service, mock_trxn_repo, mock_repo
):
    # Mock input data
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 1
    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.version = 2

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

    previous_summary = Mock()
    previous_summary.line_15_banked_units_used = 0
    previous_summary.line_16_banked_units_remaining = 0
    previous_summary.line_18_units_to_be_banked = 15
    previous_summary.line_19_units_to_be_exported = 15

    mock_repo.get_previous_summary.return_value = previous_summary
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
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )
    )

    # Assertions
    assert isinstance(summary, list)
    assert all(isinstance(item, ComplianceReportSummaryRowSchema) for item in summary)
    assert len(summary) == 11  # Ensure all 11 lines are present

    # Check specific line values
    line_values = {item.line: item.value for item in summary}
    assert line_values[12] == 500  # Transferred out
    assert line_values[13] == 300  # Received
    assert line_values[14] == 200  # Issued
    assert line_values[15] == 15  # Previously Issued
    assert line_values[16] == 15  # Previously Issued
    assert line_values[18] == 100
    assert line_values[19] == 100
    assert line_values[20] == 170  # Wrong
    assert line_values[21] == 0  # Not calculated yet
    assert line_values[22] == 1170  # Add all the above

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
        line_6_renewable_fuel_retained_gasoline=100,
        line_6_renewable_fuel_retained_diesel=200,
        line_6_renewable_fuel_retained_jet_fuel=300,
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

    # Line 1: Volume of fossil-derived base fuel supplied
    assert result[0].gasoline == 100.0
    assert result[0].diesel == 100.0
    assert result[0].jet_fuel == 100.0

    # Line 2: Volume of eligible renewable fuel supplied
    assert result[1].gasoline == 100.0
    assert result[1].diesel == 100.0
    assert result[1].jet_fuel == 100.0

    # Line 3: Total volume of tracked fuel supplied (Line 1 + Line 2)
    assert result[2].gasoline == 200.0
    assert result[2].diesel == 200.0
    assert result[2].jet_fuel == 200.0

    # Line 4: Volume of eligible renewable fuel required
    assert result[3].gasoline == 10.0  # 5% of 200
    assert result[3].diesel == 8.0  # 4% of 200
    assert result[3].jet_fuel == 0.0  # Jet fuel percentage is 0 in 2024

    # Line 5: Net volume of eligible renewable fuel notionally transferred
    assert result[4].gasoline == 100.0
    assert result[4].diesel == 100.0
    assert result[4].jet_fuel == 100.0

    # Line 6: Volume of eligible renewable fuel retained
    assert result[5].gasoline == 0.0
    assert result[5].diesel == 0.0
    assert result[5].jet_fuel == 0.0

    # Line 7: Volume of eligible renewable fuel previously retained
    assert result[6].gasoline == 100.0
    assert result[6].diesel == 100.0
    assert result[6].jet_fuel == 100.0

    # Line 8: Volume of eligible renewable obligation deferred
    assert result[7].gasoline == 0.0
    assert result[7].diesel == 0.0
    assert result[7].jet_fuel == 0.0

    # Line 9: Volume of renewable obligation added
    assert result[8].gasoline == 100.0
    assert result[8].diesel == 100.0
    assert result[8].jet_fuel == 100.0

    # Line 10: Net volume of eligible renewable fuel supplied
    assert result[9].gasoline == 200.0
    assert result[9].diesel == 200.0
    assert result[9].jet_fuel == 200.0

    # Line 11: Non-compliance penalty payable
    assert result[10].gasoline == 0.0
    assert result[10].diesel == 0.0
    assert result[10].jet_fuel == 0.0


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

    # Line 1: Volume of fossil-derived base fuel supplied
    assert result[0].gasoline == 100.0
    assert result[0].diesel == 300.0
    assert result[0].jet_fuel == 500.0

    # Line 2: Volume of eligible renewable fuel supplied
    assert result[1].gasoline == 200.0
    assert result[1].diesel == 400.0
    assert result[1].jet_fuel == 600.0

    # Line 3: Total volume of tracked fuel supplied (Line 1 + Line 2)
    assert result[2].gasoline == 300.0
    assert result[2].diesel == 700.0
    assert result[2].jet_fuel == 1100.0

    # Line 4: Volume of eligible renewable fuel required
    assert result[3].gasoline == 15.0  # 5% of 300
    assert result[3].diesel == 28.0  # 4% of 700
    assert result[3].jet_fuel == 11  # 1% of 1100

    # Line 5: Net volume of eligible renewable fuel notionally transferred
    assert result[4].gasoline == 500.0
    assert result[4].diesel == 100.0
    assert result[4].jet_fuel == 300.0

    # Line 6: Volume of eligible renewable fuel retained
    assert result[5].gasoline == 0.0
    assert result[5].diesel == 0.0
    assert result[5].jet_fuel == 0.0

    # Line 7: Volume of eligible renewable fuel previously retained
    assert result[6].gasoline == 300.0
    assert result[6].diesel == 500.0
    assert result[6].jet_fuel == 100.0

    # Line 8: Volume of eligible renewable obligation deferred
    assert result[7].gasoline == 0.0
    assert result[7].diesel == 0.0
    assert result[7].jet_fuel == 0.0

    # Line 9: Volume of renewable obligation added
    assert result[8].gasoline == 400.0
    assert result[8].diesel == 600.0
    assert result[8].jet_fuel == 200.0

    # Line 10: Net volume of eligible renewable fuel supplied
    assert result[9].gasoline == 600.0
    assert result[9].diesel == 400.0
    assert result[9].jet_fuel == 800.0

    # Line 11: Non-compliance penalty payable
    assert result[10].gasoline == 0.0
    assert result[10].diesel == 0.0
    assert result[10].jet_fuel == 0.0


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

    # Line 1: Volume of fossil-derived base fuel supplied
    assert result[0].gasoline == 300.0
    assert result[0].diesel == 200.0
    assert result[0].jet_fuel == 100.0

    # Line 2: Volume of eligible renewable fuel supplied
    assert result[1].gasoline == 100.0
    assert result[1].diesel == 300.0
    assert result[1].jet_fuel == 200.0

    # Line 3: Total volume of tracked fuel supplied (Line 1 + Line 2)
    assert result[2].gasoline == 400.0
    assert result[2].diesel == 500.0
    assert result[2].jet_fuel == 300.0

    # Line 4: Volume of eligible renewable fuel required
    assert result[3].gasoline == 20.0  # 5% of 400
    assert result[3].diesel == 20.0  # 4% of 500
    assert result[3].jet_fuel == 6.0  # 2% of 300

    # Line 5: Net volume of eligible renewable fuel notionally transferred
    assert result[4].gasoline == 100.0
    assert result[4].diesel == 300.0
    assert result[4].jet_fuel == 200.0

    # Line 6: Volume of eligible renewable fuel retained
    assert result[5].gasoline == 0.0
    assert result[5].diesel == 0.0
    assert result[5].jet_fuel == 0.0

    # Line 7: Volume of eligible renewable fuel previously retained
    assert result[6].gasoline == 200.0
    assert result[6].diesel == 100.0
    assert result[6].jet_fuel == 300.0

    # Line 8: Volume of eligible renewable obligation deferred
    assert result[7].gasoline == 0.0
    assert result[7].diesel == 0.0
    assert result[7].jet_fuel == 0.0

    # Line 9: Volume of renewable obligation added
    assert result[8].gasoline == 300.0
    assert result[8].diesel == 200.0
    assert result[8].jet_fuel == 100.0

    # Line 10: Net volume of eligible renewable fuel supplied
    assert result[9].gasoline == 100.0
    assert result[9].diesel == 500.0
    assert result[9].jet_fuel == 600.0

    # Line 11: Non-compliance penalty payable
    assert result[10].gasoline == 0.0
    assert result[10].diesel == 0.0
    assert result[10].jet_fuel == 0.0


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

    # Line 1: Volume of fossil-derived base fuel supplied
    assert result[0].gasoline == 100.0
    assert result[0].diesel == 200.0
    assert result[0].jet_fuel == 300.0

    # Line 2: Volume of eligible renewable fuel supplied
    assert result[1].gasoline == 200.0
    assert result[1].diesel == 300.0
    assert result[1].jet_fuel == 100.0

    # Line 3: Total volume of tracked fuel supplied (Line 1 + Line 2)
    assert result[2].gasoline == 300.0
    assert result[2].diesel == 500.0
    assert result[2].jet_fuel == 400.0

    # Line 4: Volume of eligible renewable fuel required
    assert result[3].gasoline == 15.0  # 5% of 300
    assert result[3].diesel == 20.0  # 4% of 500
    assert result[3].jet_fuel == 12.0

    # Line 5: Net volume of eligible renewable fuel notionally transferred
    assert result[4].gasoline == 200.0
    assert result[4].diesel == 300.0
    assert result[4].jet_fuel == 100.0

    # Line 6: Volume of eligible renewable fuel retained
    assert result[5].gasoline == 0.0
    assert result[5].diesel == 0.0
    assert result[5].jet_fuel == 0.0

    # Line 7: Volume of eligible renewable fuel previously retained
    assert result[6].gasoline == 300.0
    assert result[6].diesel == 100.0
    assert result[6].jet_fuel == 200.0

    # Line 8: Volume of eligible renewable obligation deferred
    assert result[7].gasoline == 0.0
    assert result[7].diesel == 0.0
    assert result[7].jet_fuel == 0.0

    # Line 9: Volume of renewable obligation added
    assert result[8].gasoline == 100.0
    assert result[8].diesel == 200.0
    assert result[8].jet_fuel == 300.0

    # Line 10: Net volume of eligible renewable fuel supplied
    assert result[9].gasoline == 600.0
    assert result[9].diesel == 500.0
    assert result[9].jet_fuel == 100.0

    # Line 11: Non-compliance penalty payable
    assert result[10].gasoline == 0.0
    assert result[10].diesel == 0.0
    assert result[10].jet_fuel == 0.0


@pytest.mark.anyio
async def test_calculate_non_compliance_penalty_summary_without_penalty_payable(
    compliance_report_summary_service, compliance_report_summary_row_schema
):
    mock_compliance_report_summary = [
        compliance_report_summary_row_schema(
            line=11, gasoline=1000, diesel=2000, jet_fuel=3000, total_value=6000
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
            line=11, gasoline=1000, diesel=2000, jet_fuel=3000, total_value=6000
        )
    ]

    result = compliance_report_summary_service.calculate_non_compliance_penalty_summary(
        -2, mock_compliance_report_summary
    )

    assert len(result) == 3
    assert result[0].total_value == 6000
    assert result[1].total_value == 1200
    assert result[2].total_value == 7200


@pytest.mark.anyio
async def test_calculate_renewable_fuel_target_summary_no_renewables(
    compliance_report_summary_service,
):
    # Test case where there are no renewable quantities
    fossil_quantities = {"gasoline": 1000, "diesel": 2000, "jet_fuel": 3000}
    renewable_quantities = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    previous_retained = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    previous_obligation = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    notional_transfers_sum = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    compliance_period = 2030
    summary_model = ComplianceReportSummary(
        line_6_renewable_fuel_retained_gasoline=0,
        line_6_renewable_fuel_retained_diesel=0,
        line_6_renewable_fuel_retained_jet_fuel=0,
        line_8_obligation_deferred_gasoline=0,
        line_8_obligation_deferred_diesel=0,
        line_8_obligation_deferred_jet_fuel=0,
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
    # Penalty should be applied due to no renewables
    assert result[10].gasoline == 15.0
    assert result[10].diesel == 36.0
    assert result[10].jet_fuel == 45.0
    assert result[10].total_value == 96.0


@pytest.mark.anyio
async def test_calculate_renewable_fuel_target_summary_high_renewables(
    compliance_report_summary_service,
):
    # Test case where renewable quantities exceed requirements
    fossil_quantities = {"gasoline": 100, "diesel": 200, "jet_fuel": 300}
    renewable_quantities = {"gasoline": 500, "diesel": 600, "jet_fuel": 700}
    previous_retained = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    previous_obligation = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    notional_transfers_sum = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    compliance_period = 2030
    summary_model = ComplianceReportSummary(
        line_6_renewable_fuel_retained_gasoline=0,
        line_6_renewable_fuel_retained_diesel=0,
        line_6_renewable_fuel_retained_jet_fuel=0,
        line_8_obligation_deferred_gasoline=0,
        line_8_obligation_deferred_diesel=0,
        line_8_obligation_deferred_jet_fuel=0,
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
    # No penalty since renewables exceed requirements
    assert result[10].gasoline == 0
    assert result[10].diesel == 0
    assert result[10].jet_fuel == 0


@pytest.mark.anyio
async def test_calculate_renewable_fuel_target_summary_copy_lines_6_and_8(
    compliance_report_summary_service,
):
    # Test case where required renewable quantities have not changed, so lines 6 and 8 should be copied
    fossil_quantities = {"gasoline": 100, "diesel": 200, "jet_fuel": 300}
    renewable_quantities = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    previous_retained = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    previous_obligation = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    notional_transfers_sum = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    compliance_period = 2030
    summary_model = ComplianceReportSummary(
        line_6_renewable_fuel_retained_gasoline=10,
        line_6_renewable_fuel_retained_diesel=20,
        line_6_renewable_fuel_retained_jet_fuel=30,
        line_8_obligation_deferred_gasoline=5,
        line_8_obligation_deferred_diesel=10,
        line_8_obligation_deferred_jet_fuel=15,
    )

    # Set the expected eligible renewable fuel required to match the summary model
    expected_eligible_renewable_fuel_required = {
        "gasoline": 5.0,  # 100 * 0.05
        "diesel": 8.0,  # 200 * 0.04
        "jet_fuel": 9.0,  # 300 * 0.03
    }

    # Mock the summary model's line 4 values to match the expected required values
    summary_model.line_4_eligible_renewable_fuel_required_gasoline = (
        expected_eligible_renewable_fuel_required["gasoline"]
    )
    summary_model.line_4_eligible_renewable_fuel_required_diesel = (
        expected_eligible_renewable_fuel_required["diesel"]
    )
    summary_model.line_4_eligible_renewable_fuel_required_jet_fuel = (
        expected_eligible_renewable_fuel_required["jet_fuel"]
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

    # Line 6: Volume of eligible renewable fuel retained
    assert result[5].gasoline == 10.0  # Should be copied if conditions are met
    assert result[5].diesel == 20.0
    assert result[5].jet_fuel == 30.0

    # Line 8: Volume of eligible renewable obligation deferred
    assert result[7].gasoline == 5.0  # Should be copied if conditions are met
    assert result[7].diesel == 10.0
    assert result[7].jet_fuel == 15.0


@pytest.mark.anyio
async def test_calculate_renewable_fuel_target_summary_no_copy_lines_6_and_8(
    compliance_report_summary_service,
):
    # Test case where required renewable quantities have changed, so lines 6 and 8 should not be copied
    fossil_quantities = {"gasoline": 100, "diesel": 200, "jet_fuel": 300}
    renewable_quantities = {"gasoline": 50, "diesel": 150, "jet_fuel": 50}
    previous_retained = {"gasoline": 20, "diesel": 30, "jet_fuel": 40}
    previous_obligation = {"gasoline": 10, "diesel": 20, "jet_fuel": 30}
    notional_transfers_sum = {"gasoline": 5, "diesel": 10, "jet_fuel": 15}
    compliance_period = 2030
    summary_model = ComplianceReportSummary(
        line_6_renewable_fuel_retained_gasoline=10,
        line_6_renewable_fuel_retained_diesel=20,
        line_6_renewable_fuel_retained_jet_fuel=30,
        line_8_obligation_deferred_gasoline=5,
        line_8_obligation_deferred_diesel=10,
        line_8_obligation_deferred_jet_fuel=15,
    )

    # Set the expected eligible renewable fuel required to differ from the summary model
    expected_eligible_renewable_fuel_required = {
        "gasoline": 10.0,  # Different from summary model
        "diesel": 16.0,  # Different from summary model
        "jet_fuel": 18.0,  # Different from summary model
    }

    # Mock the summary model's line 4 values to differ from the expected required values
    summary_model.line_4_eligible_renewable_fuel_required_gasoline = (
        expected_eligible_renewable_fuel_required["gasoline"] + 1
    )
    summary_model.line_4_eligible_renewable_fuel_required_diesel = (
        expected_eligible_renewable_fuel_required["diesel"] + 1
    )
    summary_model.line_4_eligible_renewable_fuel_required_jet_fuel = (
        expected_eligible_renewable_fuel_required["jet_fuel"] + 1
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
    assert result[5].gasoline == 0  # Line 6 should not be copied
    assert result[5].diesel == 0
    assert result[5].jet_fuel == 0
    assert result[7].gasoline == 0  # Line 8 should not be copied
    assert result[7].diesel == 0
    assert result[7].jet_fuel == 0


@pytest.mark.anyio
async def test_can_sign_flag_logic(
    compliance_report_summary_service, mock_repo, mock_trxn_repo
):
    # Scenario 1: All conditions met
    mock_effective_fuel_supplies = [MagicMock()]
    mock_notional_transfers = MagicMock(notional_transfers=[MagicMock()])
    mock_fuel_exports = [MagicMock()]
    mock_allocation_agreements = [MagicMock()]

    # Create a mock summary with real numeric values
    mock_summary = MagicMock(
        is_locked=False,
        # Add all the required attributes with real numbers
        line_6_renewable_fuel_retained_gasoline=10,
        line_6_renewable_fuel_retained_diesel=20,
        line_6_renewable_fuel_retained_jet_fuel=30,
        line_7_previously_retained_gasoline=10,
        line_7_previously_retained_diesel=20,
        line_7_previously_retained_jet_fuel=30,
        line_8_obligation_deferred_gasoline=5,
        line_8_obligation_deferred_diesel=10,
        line_8_obligation_deferred_jet_fuel=15,
        line_9_obligation_added_gasoline=5,
        line_9_obligation_added_diesel=10,
        line_9_obligation_added_jet_fuel=15,
        line_4_eligible_renewable_fuel_required_gasoline=25,
        line_4_eligible_renewable_fuel_required_diesel=50,
        line_4_eligible_renewable_fuel_required_jet_fuel=10,
    )

    mock_compliance_report = MagicMock(
        version=0,
        compliance_report_group_uuid="mock-group-uuid",
        compliance_period=MagicMock(
            effective_date=MagicMock(year=2024), description="2024"
        ),
        nickname="test-report",
        organization_id=1,
        compliance_report_id=1,
        summary=mock_summary,
    )

    mock_trxn_repo.calculate_available_balance_for_period.return_value = 1000

    # Mock previous retained and obligation dictionaries
    previous_retained = {"gasoline": 10, "diesel": 20, "jet_fuel": 30}
    previous_obligation = {"gasoline": 5, "diesel": 10, "jet_fuel": 15}

    # Mock repository methods
    mock_repo.get_compliance_report_by_id = AsyncMock(
        return_value=mock_compliance_report
    )
    mock_repo.calculate_fuel_quantities = AsyncMock(
        return_value={
            "gasoline": 100,
            "diesel": 50,
            "jet_fuel": 25,
        }
    )
    mock_repo.aggregate_other_uses_quantity = AsyncMock(
        return_value={
            "gasoline": 50,
            "diesel": 25,
            "jet_fuel": 10,
        }
    )
    mock_repo.get_assessed_compliance_report_by_period = AsyncMock(
        return_value=MagicMock(
            summary=MagicMock(
                line_6_renewable_fuel_retained_gasoline=previous_retained["gasoline"],
                line_6_renewable_fuel_retained_diesel=previous_retained["diesel"],
                line_6_renewable_fuel_retained_jet_fuel=previous_retained["jet_fuel"],
                line_8_obligation_deferred_gasoline=previous_obligation["gasoline"],
                line_8_obligation_deferred_diesel=previous_obligation["diesel"],
                line_8_obligation_deferred_jet_fuel=previous_obligation["jet_fuel"],
            )
        )
    )

    compliance_report_summary_service.fuel_supply_repo.get_effective_fuel_supplies = AsyncMock(
        return_value=mock_effective_fuel_supplies
    )
    compliance_report_summary_service.notional_transfer_service.calculate_notional_transfers = AsyncMock(
        return_value=mock_notional_transfers
    )
    compliance_report_summary_service.fuel_export_repo.get_effective_fuel_exports = AsyncMock(
        return_value=mock_fuel_exports
    )
    compliance_report_summary_service.allocation_agreement_repo.get_allocation_agreements = AsyncMock(
        return_value=mock_allocation_agreements
    )

    # Mock calculation methods with real dictionaries
    compliance_report_summary_service.calculate_fossil_fuel_quantities = AsyncMock(
        return_value={"gasoline": 100, "diesel": 200, "jet_fuel": 50}
    )
    compliance_report_summary_service.calculate_renewable_fuel_quantities = AsyncMock(
        return_value={"gasoline": 50, "diesel": 100, "jet_fuel": 20}
    )
    compliance_report_summary_service.calculate_notional_transfers_sum = AsyncMock(
        return_value={"gasoline": 10, "diesel": 20, "jet_fuel": 5}
    )

    def mock_calculate_renewable_fuel_target_summary(*args, **kwargs):
        # Create test summary rows with safe values
        result = []
        for line in range(1, 12):  # Lines 1-11
            row = ComplianceReportSummaryRowSchema(
                line=line,
                line_type="test",
                description="test description",
                gasoline=10.0,
                diesel=10.0,
                jet_fuel=10.0,
                total_value=30.0
            )
            result.append(row)
        return result

    # Replace the method completely
    compliance_report_summary_service.calculate_renewable_fuel_target_summary = mock_calculate_renewable_fuel_target_summary

    # Call the method
    result = await compliance_report_summary_service.calculate_compliance_report_summary(1)

    # Assert that `can_sign` is True
    assert result.can_sign is True

    # Scenario 2: No conditions met
    compliance_report_summary_service.fuel_supply_repo.get_effective_fuel_supplies = AsyncMock(
        return_value=[]
    )
    compliance_report_summary_service.notional_transfer_service.calculate_notional_transfers = AsyncMock(
        return_value=MagicMock(notional_transfers=[])
    )
    compliance_report_summary_service.fuel_export_repo.get_effective_fuel_exports = AsyncMock(
        return_value=[]
    )
    compliance_report_summary_service.allocation_agreement_repo.get_allocation_agreements = AsyncMock(
        return_value=[]
    )

    # Call the method again
    result = await compliance_report_summary_service.calculate_compliance_report_summary(1)

    # Assert that `can_sign` is False
    assert result.can_sign is False


@pytest.mark.anyio
async def test_calculate_fuel_quantities_fossil_derived(
    compliance_report_summary_service,
    mock_repo,
    mock_trxn_repo,
    mock_fuel_supply_repo,
):
    # Create a mock repository
    mock_repo.aggregate_quantities.return_value = {"diesel": 100.0}
    mock_repo.aggregate_other_uses_quantity.return_value = {"gasoline": 50.0}

    # Define test inputs
    compliance_report_id = 1
    effective_fuel_supplies: List[FuelSupply] = (
        []
    )  # Add mock FuelSupply objects as needed
    fossil_derived = True

    # Call the method under test
    result = await compliance_report_summary_service.calculate_fuel_quantities(
        compliance_report_id, effective_fuel_supplies, fossil_derived
    )

    # Assertions
    assert result == {"diesel": 100.0, "gasoline": 50.0}
    mock_repo.aggregate_quantities.assert_called_once_with(
        effective_fuel_supplies, fossil_derived
    )
    mock_repo.aggregate_other_uses_quantity.assert_awaited_once_with(
        compliance_report_id, fossil_derived
    )
    mock_repo.aggregate_allocation_agreements.assert_not_called()


@pytest.mark.anyio
async def test_calculate_fuel_quantities_renewable(
    compliance_report_summary_service,
    mock_repo,
    mock_trxn_repo,
    mock_fuel_supply_repo,
):
    # Create a mock repository
    mock_repo.aggregate_quantities.return_value = {"gasoline": 200.0}
    mock_repo.aggregate_other_uses_quantity.return_value = {
        "diesel": 75.0,
        "jet-fuel": 25.0,
    }

    # Define test inputs
    compliance_report_id = 2
    effective_fuel_supplies: List[FuelSupply] = []
    fossil_derived = False

    # Call the method under test
    result = await compliance_report_summary_service.calculate_fuel_quantities(
        compliance_report_id, effective_fuel_supplies, fossil_derived
    )

    # Assertions
    mock_repo.aggregate_quantities.assert_called_once_with(
        effective_fuel_supplies, fossil_derived
    )
    mock_repo.aggregate_other_uses_quantity.assert_awaited_once_with(
        compliance_report_id, fossil_derived
    )
    assert result == {"gasoline": 200.0, "diesel": 75.0, "jet-fuel": 25.0}


@pytest.mark.anyio
async def test_calculate_fuel_supply_compliance_units_positive(
    compliance_report_summary_service,
):
    """
    Test calculate_fuel_supply_compliance_units with a record that yields a positive value.
    For TCI=100, EER=1, RCI=80, UCI=10, Q=1_000_000, ED=1:
    (100*1 - (80+10)) * ((1_000_000*1)/1_000_000) = (100 - 90) * 1 = 10.
    Expected result: 10.
    """
    mock_fuel_supply = MagicMock()
    mock_fuel_supply.target_ci = 100
    mock_fuel_supply.eer = 1
    mock_fuel_supply.ci_of_fuel = 80
    mock_fuel_supply.uci = 10
    mock_fuel_supply.quantity = 1_000_000
    mock_fuel_supply.energy_density = 1

    # Patch the repo call to return our single mock record.
    compliance_report_summary_service.fuel_supply_repo.get_effective_fuel_supplies = (
        AsyncMock(return_value=[mock_fuel_supply])
    )
    dummy_report = MagicMock()
    dummy_report.compliance_report_group_uuid = "dummy-group"

    result = (
        await compliance_report_summary_service.calculate_fuel_supply_compliance_units(
            dummy_report
        )
    )
    assert result == 10


@pytest.mark.anyio
async def test_calculate_fuel_supply_compliance_units_negative(
    compliance_report_summary_service,
):
    """
    Test calculate_fuel_supply_compliance_units with a record that yields a negative value.
    For TCI=80, EER=1, RCI=90, UCI=5, Q=1_000_000, ED=1:
    (80*1 - (90+5)) * ((1_000_000*1)/1_000_000) = (80 - 95) = -15.
    Expected result: -15.
    """
    mock_fuel_supply = MagicMock()
    mock_fuel_supply.target_ci = 80
    mock_fuel_supply.eer = 1
    mock_fuel_supply.ci_of_fuel = 90
    mock_fuel_supply.uci = 5
    mock_fuel_supply.quantity = 1_000_000
    mock_fuel_supply.energy_density = 1

    compliance_report_summary_service.fuel_supply_repo.get_effective_fuel_supplies = (
        AsyncMock(return_value=[mock_fuel_supply])
    )
    dummy_report = MagicMock()
    dummy_report.compliance_report_group_uuid = "dummy-group"

    result = (
        await compliance_report_summary_service.calculate_fuel_supply_compliance_units(
            dummy_report
        )
    )
    assert result == -15


@pytest.mark.anyio
async def test_calculate_fuel_export_compliance_units_positive(
    compliance_report_summary_service,
):
    """
    Test calculate_fuel_export_compliance_units with a record where the underlying compliance_units is positive.
    Using TCI=100, EER=1, RCI=80, UCI=10, Q=1_000_000, ED=1:
    - The raw compliance_units = 10.
    - After negation: -10, which is negative.
    Expected result: -10.
    """
    mock_fuel_export = MagicMock()
    mock_fuel_export.target_ci = 100
    mock_fuel_export.eer = 1
    mock_fuel_export.ci_of_fuel = 80
    mock_fuel_export.uci = 10
    mock_fuel_export.quantity = 1_000_000
    mock_fuel_export.energy_density = 1

    compliance_report_summary_service.fuel_export_repo.get_effective_fuel_exports = (
        AsyncMock(return_value=[mock_fuel_export])
    )
    dummy_report = MagicMock()
    dummy_report.compliance_report_group_uuid = "dummy-group"

    result = (
        await compliance_report_summary_service.calculate_fuel_export_compliance_units(
            dummy_report
        )
    )
    assert result == -10


@pytest.mark.anyio
async def test_calculate_fuel_export_compliance_units_negative(
    compliance_report_summary_service,
):
    """
    Test calculate_fuel_export_compliance_units with a record where the underlying compliance_units is negative.
    For TCI=80, EER=1, RCI=90, UCI=5, Q=1_000_000, ED=1:
    - The raw compliance_units = (80 - (90+5)) = -15.
    - After negation: -(-15) = 15, which is not negative, so the method returns 0.
    Expected result: 0.
    """
    mock_fuel_export = MagicMock()
    mock_fuel_export.target_ci = 80
    mock_fuel_export.eer = 1
    mock_fuel_export.ci_of_fuel = 90
    mock_fuel_export.uci = 5
    mock_fuel_export.quantity = 1_000_000
    mock_fuel_export.energy_density = 1

    compliance_report_summary_service.fuel_export_repo.get_effective_fuel_exports = (
        AsyncMock(return_value=[mock_fuel_export])
    )
    dummy_report = MagicMock()
    dummy_report.compliance_report_group_uuid = "dummy-group"

    result = (
        await compliance_report_summary_service.calculate_fuel_export_compliance_units(
            dummy_report
        )
    )
    assert result == 0
