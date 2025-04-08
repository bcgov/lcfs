import pytest
from datetime import datetime
from typing import List
from unittest.mock import AsyncMock, MagicMock, Mock

from lcfs.db.models import ComplianceReport
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.web.api.compliance_report.schema import ComplianceReportSummaryRowSchema


def _assert_repo_calls(
    mock_repo, mock_trxn_repo, start_date, end_date, organization_id
):
    """Verify that repository methods are called as expected."""
    mock_repo.get_transferred_out_compliance_units.assert_called_once_with(
        start_date, end_date, organization_id
    )
    mock_repo.get_received_compliance_units.assert_called_once_with(
        start_date, end_date, organization_id
    )
    mock_repo.get_issued_compliance_units.assert_called_once_with(
        start_date, end_date, organization_id
    )
    mock_trxn_repo.calculate_available_balance_for_period.assert_called_once_with(
        organization_id, start_date.year
    )


def _get_line_values(summary: List[ComplianceReportSummaryRowSchema]) -> dict:
    """Helper to map summary rows' line numbers to their values."""
    return {item.line: item.value for item in summary}


def _assert_renewable_common(result: List[ComplianceReportSummaryRowSchema]):
    """Common assertions for renewable fuel summary tests."""
    assert len(result) == 11
    assert isinstance(result[0], ComplianceReportSummaryRowSchema)


@pytest.mark.anyio
@pytest.mark.parametrize(
    "description, reporting_frequency, fuel_supply_data",
    [
        (
            "Annual report using 'quantity'",
            None,  # Use default (annual) reporting
            [
                {
                    "target_ci": 100,
                    "eer": 1.0,
                    "ci_of_fuel": 80,
                    "quantity": 100000,
                    "energy_density": 10,
                },
                {
                    "target_ci": 90,
                    "eer": 1.2,
                    "ci_of_fuel": 70,
                    "quantity": 200000,
                    "energy_density": 8,
                },
                {
                    "target_ci": 80,
                    "eer": 0.5,
                    "ci_of_fuel": 60,
                    "quantity": 300000,
                    "energy_density": 8,
                },
            ],
        ),
        (
            "Quarterly report using Q1 quantities",
            ReportingFrequency.QUARTERLY,
            [
                {
                    "target_ci": 100,
                    "eer": 1.0,
                    "ci_of_fuel": 80,
                    "q1_quantity": 100000,
                    "energy_density": 10,
                },
                {
                    "target_ci": 90,
                    "eer": 1.2,
                    "ci_of_fuel": 70,
                    "q1_quantity": 200000,
                    "energy_density": 8,
                },
                {
                    "target_ci": 80,
                    "eer": 0.5,
                    "ci_of_fuel": 60,
                    "q1_quantity": 300000,
                    "energy_density": 8,
                },
            ],
        ),
        (
            "Quarterly report with multiple quarter fields",
            ReportingFrequency.QUARTERLY,
            [
                {
                    "target_ci": 100,
                    "eer": 1.0,
                    "ci_of_fuel": 80,
                    "q1_quantity": 50000,
                    "q2_quantity": 50000,
                    "energy_density": 10,
                },
                {
                    "target_ci": 90,
                    "eer": 1.2,
                    "ci_of_fuel": 70,
                    "q3_quantity": 200000,
                    "energy_density": 8,
                },
                {
                    "target_ci": 80,
                    "eer": 0.5,
                    "ci_of_fuel": 60,
                    "q4_quantity": 300000,
                    "energy_density": 8,
                },
            ],
        ),
    ],
)
async def test_calculate_low_carbon_fuel_target_summary_parametrized(
    compliance_report_summary_service,
    mock_trxn_repo,
    mock_repo,
    reporting_frequency,
    fuel_supply_data,
    description,
):
    # Common input data
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 1
    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.version = 0
    if reporting_frequency:
        compliance_report.reporting_frequency = reporting_frequency

    # Set up effective fuel supplies based on the parameterized fuel_supply_data.
    fuel_supplies = [MagicMock(**data) for data in fuel_supply_data]
    compliance_report_summary_service.get_effective_fuel_supplies = AsyncMock(
        return_value=fuel_supplies
    )

    # Setup repository responses and calculation method mocks.
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

    # Call the target method.
    summary, penalty = (
        await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )
    )

    # Common assertions for summary lines.
    assert isinstance(summary, list)
    assert len(summary) == 11
    assert all(isinstance(item, ComplianceReportSummaryRowSchema) for item in summary)
    line_values = _get_line_values(summary)
    # Expected common line values.
    assert line_values[12] == 500  # Transferred out
    assert line_values[13] == 300  # Received
    assert line_values[14] == 200  # Issued
    assert line_values[18] == 100
    assert line_values[19] == 100
    assert line_values[20] == 200
    assert line_values[21] == 0  # Not calculated yet
    assert line_values[22] == 1200  # Sum of above

    _assert_repo_calls(
        mock_repo,
        mock_trxn_repo,
        compliance_period_start,
        compliance_period_end,
        organization_id,
    )


@pytest.mark.anyio
async def test_supplemental_low_carbon_fuel_target_summary(
    compliance_report_summary_service, mock_trxn_repo, mock_repo
):
    # Input setup: supplemental version (version = 2)
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 1
    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.version = 2

    fuel_supplies = [
        MagicMock(
            target_ci=100, eer=1.0, ci_of_fuel=80, quantity=100000, energy_density=10
        ),
        MagicMock(
            target_ci=90, eer=1.2, ci_of_fuel=70, quantity=200000, energy_density=8
        ),
        MagicMock(
            target_ci=80, eer=0.5, ci_of_fuel=60, quantity=300000, energy_density=8
        ),
    ]
    compliance_report_summary_service.get_effective_fuel_supplies = AsyncMock(
        return_value=fuel_supplies
    )

    # Repository returns.
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

    summary, penalty = (
        await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )
    )

    # Assert supplemental summary lines.
    assert isinstance(summary, list)
    assert len(summary) == 11
    line_values = _get_line_values(summary)
    assert line_values[12] == 500
    assert line_values[13] == 300
    assert line_values[14] == 200
    assert line_values[15] == 15
    assert line_values[16] == 15
    assert line_values[18] == 100
    assert line_values[19] == 100
    assert line_values[20] == 170  # As per business logic
    assert line_values[21] == 0
    assert line_values[22] == 1170

    _assert_repo_calls(
        mock_repo,
        mock_trxn_repo,
        compliance_period_start,
        compliance_period_end,
        organization_id,
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "penalty_payable, exp_row1, exp_row2, exp_row3",
    [
        (0, 6000, 0, 6000),
        (-2, 6000, 1200, 7200),
    ],
)
async def test_calculate_non_compliance_penalty_summary_parametrized(
    compliance_report_summary_service,
    compliance_report_summary_row_schema,
    penalty_payable,
    exp_row1,
    exp_row2,
    exp_row3,
):
    mock_compliance_report_summary = [
        compliance_report_summary_row_schema(
            line=11, gasoline=1000, diesel=2000, jet_fuel=3000, total_value=6000
        )
    ]
    result = compliance_report_summary_service.calculate_non_compliance_penalty_summary(
        penalty_payable, mock_compliance_report_summary
    )
    assert len(result) == 3
    assert result[0].total_value == exp_row1
    assert result[1].total_value == exp_row2
    assert result[2].total_value == exp_row3


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

    # Assert each line value as expected.
    _assert_renewable_common(result)
    # Line 1
    assert result[0].gasoline == 100.0
    assert result[0].diesel == 100.0
    assert result[0].jet_fuel == 100.0
    # Line 2
    assert result[1].gasoline == 100.0
    assert result[1].diesel == 100.0
    assert result[1].jet_fuel == 100.0
    # Line 3
    assert result[2].gasoline == 200.0
    assert result[2].diesel == 200.0
    assert result[2].jet_fuel == 200.0
    # Line 4
    assert result[3].gasoline == 10.0
    assert result[3].diesel == 8.0
    assert result[3].jet_fuel == 0.0
    # Line 5
    assert result[4].gasoline == 100.0
    assert result[4].diesel == 100.0
    assert result[4].jet_fuel == 100.0
    # Line 6
    assert result[5].gasoline == 0.0
    assert result[5].diesel == 0.0
    assert result[5].jet_fuel == 0.0
    # Line 7
    assert result[6].gasoline == 100.0
    assert result[6].diesel == 100.0
    assert result[6].jet_fuel == 100.0
    # Line 8
    assert result[7].gasoline == 0.0
    assert result[7].diesel == 0.0
    assert result[7].jet_fuel == 0.0
    # Line 9
    assert result[8].gasoline == 100.0
    assert result[8].diesel == 100.0
    assert result[8].jet_fuel == 100.0
    # Line 10
    assert result[9].gasoline == 200.0
    assert result[9].diesel == 200.0
    assert result[9].jet_fuel == 200.0
    # Line 11
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

    _assert_renewable_common(result)
    # Line 1
    assert result[0].gasoline == 100.0
    assert result[0].diesel == 300.0
    assert result[0].jet_fuel == 500.0
    # Line 2
    assert result[1].gasoline == 200.0
    assert result[1].diesel == 400.0
    assert result[1].jet_fuel == 600.0
    # Line 3
    assert result[2].gasoline == 300.0
    assert result[2].diesel == 700.0
    assert result[2].jet_fuel == 1100.0
    # Line 4
    assert result[3].gasoline == 15.0
    assert result[3].diesel == 28.0
    assert result[3].jet_fuel == 11
    # Line 5
    assert result[4].gasoline == 500.0
    assert result[4].diesel == 100.0
    assert result[4].jet_fuel == 300.0
    # Line 6
    assert result[5].gasoline == 0.0
    assert result[5].diesel == 0.0
    assert result[5].jet_fuel == 0.0
    # Line 7
    assert result[6].gasoline == 300.0
    assert result[6].diesel == 500.0
    assert result[6].jet_fuel == 100.0
    # Line 8
    assert result[7].gasoline == 0.0
    assert result[7].diesel == 0.0
    assert result[7].jet_fuel == 0.0
    # Line 9
    assert result[8].gasoline == 400.0
    assert result[8].diesel == 600.0
    assert result[8].jet_fuel == 200.0
    # Line 10
    assert result[9].gasoline == 600.0
    assert result[9].diesel == 400.0
    assert result[9].jet_fuel == 800.0
    # Line 11
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

    _assert_renewable_common(result)
    # Line 1
    assert result[0].gasoline == 300.0
    assert result[0].diesel == 200.0
    assert result[0].jet_fuel == 100.0
    # Line 2
    assert result[1].gasoline == 100.0
    assert result[1].diesel == 300.0
    assert result[1].jet_fuel == 200.0
    # Line 3
    assert result[2].gasoline == 400.0
    assert result[2].diesel == 500.0
    assert result[2].jet_fuel == 300.0
    # Line 4
    assert result[3].gasoline == 20.0
    assert result[3].diesel == 20.0
    assert result[3].jet_fuel == 6.0
    # Line 5
    assert result[4].gasoline == 100.0
    assert result[4].diesel == 300.0
    assert result[4].jet_fuel == 200.0
    # Line 6
    assert result[5].gasoline == 0.0
    assert result[5].diesel == 0.0
    assert result[5].jet_fuel == 0.0
    # Line 7
    assert result[6].gasoline == 200.0
    assert result[6].diesel == 100.0
    assert result[6].jet_fuel == 300.0
    # Line 8
    assert result[7].gasoline == 0.0
    assert result[7].diesel == 0.0
    assert result[7].jet_fuel == 0.0
    # Line 9
    assert result[8].gasoline == 300.0
    assert result[8].diesel == 200.0
    assert result[8].jet_fuel == 100.0
    # Line 10
    assert result[9].gasoline == 100.0
    assert result[9].diesel == 500.0
    assert result[9].jet_fuel == 600.0
    # Line 11
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

    _assert_renewable_common(result)
    # Line 1
    assert result[0].gasoline == 100.0
    assert result[0].diesel == 200.0
    assert result[0].jet_fuel == 300.0
    # Line 2
    assert result[1].gasoline == 200.0
    assert result[1].diesel == 300.0
    assert result[1].jet_fuel == 100.0
    # Line 3
    assert result[2].gasoline == 300.0
    assert result[2].diesel == 500.0
    assert result[2].jet_fuel == 400.0
    # Line 4
    assert result[3].gasoline == 15.0
    assert result[3].diesel == 20.0
    assert result[3].jet_fuel == 12.0
    # Line 5
    assert result[4].gasoline == 200.0
    assert result[4].diesel == 300.0
    assert result[4].jet_fuel == 100.0
    # Line 6
    assert result[5].gasoline == 0.0
    assert result[5].diesel == 0.0
    assert result[5].jet_fuel == 0.0
    # Line 7
    assert result[6].gasoline == 300.0
    assert result[6].diesel == 100.0
    assert result[6].jet_fuel == 200.0
    # Line 8
    assert result[7].gasoline == 0.0
    assert result[7].diesel == 0.0
    assert result[7].jet_fuel == 0.0
    # Line 9
    assert result[8].gasoline == 100.0
    assert result[8].diesel == 200.0
    assert result[8].jet_fuel == 300.0
    # Line 10
    assert result[9].gasoline == 600.0
    assert result[9].diesel == 500.0
    assert result[9].jet_fuel == 100.0
    # Line 11
    assert result[10].gasoline == 0.0
    assert result[10].diesel == 0.0
    assert result[10].jet_fuel == 0.0


@pytest.mark.anyio
async def test_calculate_renewable_fuel_target_summary_no_renewables(
    compliance_report_summary_service,
):
    # Test case with no renewable quantities
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

    _assert_renewable_common(result)
    # Penalty is expected due to no renewables.
    assert result[10].gasoline == 15.0
    assert result[10].diesel == 36.0
    assert result[10].jet_fuel == 45.0
    assert result[10].total_value == 96.0


@pytest.mark.anyio
async def test_calculate_renewable_fuel_target_summary_high_renewables(
    compliance_report_summary_service,
):
    # Renewable quantities exceed the requirements, so no penalty is applied.
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

    _assert_renewable_common(result)
    # No penalty expected.
    assert result[10].gasoline == 0
    assert result[10].diesel == 0
    assert result[10].jet_fuel == 0


@pytest.mark.anyio
async def test_calculate_renewable_fuel_target_summary_copy_lines_6_and_8(
    compliance_report_summary_service,
):
    # Test when the required renewable quantities have not changed so that Lines 6 and 8 are simply copied.
    fossil_quantities = {"gasoline": 100, "diesel": 200, "jet_fuel": 300}
    renewable_quantities = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
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
    # Set required renewable fuel values to match the summary model.
    expected_eligible_renewable_fuel_required = {
        "gasoline": 5.0,
        "diesel": 8.0,
        "jet_fuel": 9.0,
    }
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
        {"gasoline": 0, "diesel": 0, "jet_fuel": 0},
        {"gasoline": 0, "diesel": 0, "jet_fuel": 0},
        notional_transfers_sum,
        compliance_period,
        summary_model,
    )

    _assert_renewable_common(result)
    # Lines 6 & 8 should be copied.
    assert result[5].gasoline == 10.0
    assert result[5].diesel == 20.0
    assert result[5].jet_fuel == 30.0
    assert result[7].gasoline == 5.0
    assert result[7].diesel == 10.0
    assert result[7].jet_fuel == 15.0


@pytest.mark.anyio
async def test_calculate_renewable_fuel_target_summary_no_copy_lines_6_and_8(
    compliance_report_summary_service,
):
    # Test when the required renewable quantities differ so that Lines 6 and 8 are not copied.
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
    # Set required values that differ from the summary model.
    expected_eligible_renewable_fuel_required = {
        "gasoline": 10.0,
        "diesel": 16.0,
        "jet_fuel": 18.0,
    }
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

    _assert_renewable_common(result)
    # Lines 6 & 8 should not be copied; expect 0.
    assert result[5].gasoline == 0
    assert result[5].diesel == 0
    assert result[5].jet_fuel == 0
    assert result[7].gasoline == 0
    assert result[7].diesel == 0
    assert result[7].jet_fuel == 0


@pytest.mark.anyio
async def test_can_sign_flag_logic(
    compliance_report_summary_service, mock_repo, mock_trxn_repo
):
    # Scenario 1: All conditions met.
    mock_effective_fuel_supplies = [MagicMock()]
    mock_notional_transfers = MagicMock(notional_transfers=[MagicMock()])
    mock_fuel_exports = [MagicMock()]
    mock_allocation_agreements = [MagicMock()]

    mock_summary = MagicMock(
        is_locked=False,
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
    previous_retained = {"gasoline": 10, "diesel": 20, "jet_fuel": 30}
    previous_obligation = {"gasoline": 5, "diesel": 10, "jet_fuel": 15}

    mock_repo.get_compliance_report_by_id = AsyncMock(
        return_value=mock_compliance_report
    )
    mock_repo.calculate_fuel_quantities = AsyncMock(
        return_value={"gasoline": 100, "diesel": 50, "jet_fuel": 25}
    )
    mock_repo.aggregate_other_uses_quantity = AsyncMock(
        return_value={"gasoline": 50, "diesel": 25, "jet_fuel": 10}
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

    compliance_report_summary_service.fuel_supply_repo.get_effective_fuel_supplies = (
        AsyncMock(return_value=mock_effective_fuel_supplies)
    )
    compliance_report_summary_service.notional_transfer_service.calculate_notional_transfers = AsyncMock(
        return_value=mock_notional_transfers
    )
    compliance_report_summary_service.fuel_export_repo.get_effective_fuel_exports = (
        AsyncMock(return_value=mock_fuel_exports)
    )
    compliance_report_summary_service.allocation_agreement_repo.get_allocation_agreements = AsyncMock(
        return_value=mock_allocation_agreements
    )
    compliance_report_summary_service.calculate_fossil_fuel_quantities = AsyncMock(
        return_value={"gasoline": 100, "diesel": 200, "jet_fuel": 50}
    )
    compliance_report_summary_service.calculate_renewable_fuel_quantities = AsyncMock(
        return_value={"gasoline": 50, "diesel": 100, "jet_fuel": 20}
    )
    compliance_report_summary_service.calculate_notional_transfers_sum = AsyncMock(
        return_value={"gasoline": 10, "diesel": 20, "jet_fuel": 5}
    )

    # Replace the renewable summary method with a dummy implementation.
    def mock_calculate_renewable_fuel_target_summary(*args, **kwargs):
        result = []
        for line in range(1, 12):
            row = ComplianceReportSummaryRowSchema(
                line=line,
                line_type="test",
                description="test description",
                gasoline=10.0,
                diesel=10.0,
                jet_fuel=10.0,
                total_value=30.0,
            )
            result.append(row)
        return result

    compliance_report_summary_service.calculate_renewable_fuel_target_summary = (
        mock_calculate_renewable_fuel_target_summary
    )

    result = (
        await compliance_report_summary_service.calculate_compliance_report_summary(1)
    )
    # Expect can_sign True when all conditions met.
    assert result.can_sign is True

    # Scenario 2: When no conditions are met.
    compliance_report_summary_service.fuel_supply_repo.get_effective_fuel_supplies = (
        AsyncMock(return_value=[])
    )
    compliance_report_summary_service.notional_transfer_service.calculate_notional_transfers = AsyncMock(
        return_value=MagicMock(notional_transfers=[])
    )
    compliance_report_summary_service.fuel_export_repo.get_effective_fuel_exports = (
        AsyncMock(return_value=[])
    )
    compliance_report_summary_service.allocation_agreement_repo.get_allocation_agreements = AsyncMock(
        return_value=[]
    )
    result = (
        await compliance_report_summary_service.calculate_compliance_report_summary(1)
    )
    assert result.can_sign is False


@pytest.mark.anyio
@pytest.mark.parametrize(
    "fossil_derived, agg_quantities_return, agg_other_uses_return, compliance_report_id, expected_result",
    [
        (
            True,
            {"diesel": 100.0},
            {"gasoline": 50.0},
            1,
            {"diesel": 100.0, "gasoline": 50.0},
        ),
        (
            False,
            {"gasoline": 200.0},
            {"diesel": 75.0, "jet-fuel": 25.0},
            2,
            {"gasoline": 200.0, "diesel": 75.0, "jet-fuel": 25.0},
        ),
    ],
)
async def test_calculate_fuel_quantities_parametrized(
    compliance_report_summary_service,
    mock_repo,
    mock_trxn_repo,
    mock_fuel_supply_repo,
    fossil_derived,
    agg_quantities_return,
    agg_other_uses_return,
    compliance_report_id,
    expected_result,
):
    mock_repo.aggregate_quantities.return_value = agg_quantities_return
    mock_repo.aggregate_other_uses_quantity.return_value = agg_other_uses_return
    result = await compliance_report_summary_service.calculate_fuel_quantities(
        compliance_report_id, [], fossil_derived
    )
    if fossil_derived:
        mock_repo.aggregate_allocation_agreements.assert_not_called()
    assert result == expected_result


@pytest.mark.anyio
@pytest.mark.parametrize(
    "fuel_data, expected_result",
    [
        # Fuel Supply: positive
        (
            {
                "target_ci": 100,
                "eer": 1,
                "ci_of_fuel": 80,
                "uci": 10,
                "quantity": 1_000_000,
                "q1_quantity": 0,
                "q2_quantity": 0,
                "q3_quantity": 0,
                "q4_quantity": 0,
                "energy_density": 1,
            },
            10,
        ),
        # Fuel Supply: positive - 2 quartetrs
        (
            {
                "target_ci": 100,
                "eer": 1,
                "ci_of_fuel": 80,
                "uci": 10,
                "quantity": 500_000,
                "q1_quantity": 0,
                "q2_quantity": 500_000,
                "q3_quantity": 0,
                "q4_quantity": 0,
                "energy_density": 1,
            },
            10,
        ),
        # Fuel Supply: negative
        (
            {
                "target_ci": 80,
                "eer": 1,
                "ci_of_fuel": 90,
                "uci": 5,
                "quantity": 1_000_000,
                "q1_quantity": 0,
                "q2_quantity": 0,
                "q3_quantity": 0,
                "q4_quantity": 0,
                "energy_density": 1,
            },
            -15,
        ),
    ],
)
async def test_calculate_fuel_supply_compliance_units_parametrized(
    compliance_report_summary_service, fuel_data, expected_result
):
    mock_fuel_supply = Mock(**fuel_data)
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
    assert result == expected_result


@pytest.mark.anyio
@pytest.mark.parametrize(
    "fuel_export_data, expected_result",
    [
        (
            {
                "target_ci": 100,
                "eer": 1,
                "ci_of_fuel": 80,
                "uci": 10,
                "quantity": 1_000_000,
                "energy_density": 1,
            },
            -10,
        ),
        (
            {
                "target_ci": 80,
                "eer": 1,
                "ci_of_fuel": 90,
                "uci": 5,
                "quantity": 1_000_000,
                "energy_density": 1,
            },
            0,
        ),
    ],
)
async def test_calculate_fuel_export_compliance_units_parametrized(
    compliance_report_summary_service, fuel_export_data, expected_result
):
    mock_fuel_export = MagicMock(**fuel_export_data)
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
    assert result == expected_result
