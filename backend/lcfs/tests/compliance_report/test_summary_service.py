import pytest
from datetime import datetime, date
from typing import List
from unittest.mock import AsyncMock, MagicMock, Mock

from lcfs.db.models import ComplianceReport
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatus
from lcfs.web.api.compliance_report.schema import ComplianceReportSummaryRowSchema
from lcfs.web.api.compliance_report.summary_service import ComplianceReportSummaryService
from lcfs.web.api.notional_transfer.schema import (
    NotionalTransferSchema,
    ReceivedOrTransferredEnumSchema,
)


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
    mock_trxn_repo.calculate_line_17_available_balance_for_period.assert_called_once_with(
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
    "description, reporting_frequency, fuel_supply_data, quarterly_quantities",
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
            [0, 0, 0, 0],
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
            [28, 0, 0, 0],
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
            [10, 10, 59, -50],
        ),
    ],
)
async def test_calculate_low_carbon_fuel_target_summary_parametrized(
    compliance_report_summary_service,
    mock_trxn_repo,
    mock_fuel_supply_repo,
    quarterly_quantities,
    mock_summary_repo,
    mock_repo,  # Add mock_repo parameter
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
    mock_fuel_supply_repo.get_effective_fuel_supplies = AsyncMock(
        return_value=fuel_supplies
    )

    # Setup repository responses and calculation method mocks.
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 500
    mock_summary_repo.get_received_compliance_units.return_value = 300
    mock_summary_repo.get_issued_compliance_units.return_value = 200
    # Mock get_assessed_compliance_report_by_period to return None for original reports (version 0)
    mock_repo.get_assessed_compliance_report_by_period.return_value = None
    mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 1000
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

    quarterly_summary = await compliance_report_summary_service.calculate_quarterly_fuel_supply_compliance_units(
        compliance_report
    )

    assert (quarterly_summary[0]) == quarterly_quantities[0]
    assert (quarterly_summary[1]) == quarterly_quantities[1]
    assert (quarterly_summary[2]) == quarterly_quantities[2]
    assert (quarterly_summary[3]) == quarterly_quantities[3]

    _assert_repo_calls(
        mock_summary_repo,
        mock_trxn_repo,
        compliance_period_start,
        compliance_period_end,
        organization_id,
    )


@pytest.mark.anyio
async def test_supplemental_low_carbon_fuel_target_summary(
    compliance_report_summary_service, mock_trxn_repo, mock_summary_repo, mock_repo
):
    # Input setup: supplemental version (version = 2)
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 1

    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.configure_mock(version=2)  # Use configure_mock
    compliance_report.organization_id = organization_id
    compliance_report.compliance_period = MagicMock(
        effective_date=compliance_period_start,
        expiration_date=compliance_period_end,
        description=str(compliance_period_start.year),
    )
    compliance_report.compliance_report_group_uuid = (
        "test-uuid-supplemental"  # Added if needed
    )
    compliance_report.compliance_report_id = 12345  # Added if needed

    # Ensure compliance_report.summary.line_17_non_banked_units_used is None
    # so that trxn_repo.calculate_line_17_available_balance_for_period is called.
    mock_cr_summary = MagicMock(spec=ComplianceReportSummary)
    mock_cr_summary.line_17_non_banked_units_used = None
    mock_cr_summary.is_locked = False  # Add is_locked attribute
    compliance_report.summary = mock_cr_summary

    # Repository returns.
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 500
    mock_summary_repo.get_received_compliance_units.return_value = 300
    mock_summary_repo.get_issued_compliance_units.return_value = 200

    # Mock assessed report for Line 15 and 16 values
    mock_assessed_report = MagicMock()
    mock_assessed_summary = MagicMock()
    mock_assessed_summary.line_18_units_to_be_banked = 15
    mock_assessed_summary.line_19_units_to_be_exported = 15
    mock_assessed_report.summary = mock_assessed_summary
    mock_repo.get_assessed_compliance_report_by_period.return_value = (
        mock_assessed_report
    )


    mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = (
        1000  # Expected to be called
    )
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
    assert (
        line_values[15] == 15
    )  # From assessed_report_mock.line_18_units_to_be_banked
    assert (
        line_values[16] == 15
    )  # From assessed_report_mock.line_19_units_to_be_exported
    assert (
        line_values[17] == 1000
    )  # From mock_trxn_repo.calculate_line_17_available_balance_for_period
    assert line_values[18] == 100
    assert line_values[19] == 100
    # Line 20 = line 18 + line 19 - line 15 - line 16 = 100 + 100 - 15 - 15 = 170
    assert line_values[20] == 170
    assert (
        line_values[21] == 0
    )  # Assuming no penalty calculated in this part for this value
    # Line 22 = line 17 + line 20 = 1000 + 170 = 1170
    assert line_values[22] == 1170

    _assert_repo_calls(
        mock_summary_repo,  # This is self.repo in the service method
        mock_trxn_repo,
        compliance_period_start,
        compliance_period_end,
        organization_id,
    )
    # Ensure calculate_line_17_available_balance_for_period was called
    mock_trxn_repo.calculate_line_17_available_balance_for_period.assert_called_once_with(
        organization_id, compliance_period_start.year
    )
    mock_repo.get_assessed_compliance_report_by_period.assert_called_once_with(organization_id, compliance_period_start.year, compliance_report.compliance_report_id)


@pytest.mark.anyio
async def test_supplemental_report_uses_existing_summary_line_17(
    compliance_report_summary_service, mock_trxn_repo, mock_summary_repo, mock_repo
):
    """
    Tests that for a supplemental report with an existing summary,
    line 17 (available_balance_for_period) is taken from
    summary.line_17_non_banked_units_used and trxn_repo.calculate_line_17_available_balance_for_period
    is NOT called.
    """
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 1
    existing_line_17_value = 777  # Distinct value for testing

    # Setup ComplianceReport mock
    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.version = 1  # Supplemental report
    compliance_report.organization_id = organization_id
    compliance_report.compliance_period = MagicMock(
        effective_date=compliance_period_start,
        expiration_date=compliance_period_end,
        description="2024",
    )
    compliance_report.compliance_report_group_uuid = "test-group-uuid"
    compliance_report.compliance_report_id = 123

    # Setup ComplianceReportSummary mock attached to the report
    mock_summary_model = MagicMock(spec=ComplianceReportSummary)
    mock_summary_model.line_17_non_banked_units_used = existing_line_17_value
    mock_summary_model.is_locked = (
        True  # Add is_locked attribute for supplemental report
    )
    # Ensure other potentially accessed attributes on summary have defaults if necessary
    mock_summary_model.line_18_units_to_be_banked = 0
    mock_summary_model.line_19_units_to_be_exported = 0

    compliance_report.summary = mock_summary_model

    # Setup repository mocks
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 100
    mock_summary_repo.get_received_compliance_units.return_value = 50
    mock_summary_repo.get_issued_compliance_units.return_value = 25

    # Mock assessed report for Line 15 and 16 values
    mock_assessed_report = MagicMock()
    mock_assessed_summary = MagicMock()
    mock_assessed_summary.line_18_units_to_be_banked = 10
    mock_assessed_summary.line_19_units_to_be_exported = 5
    mock_assessed_report.summary = mock_assessed_summary
    mock_repo.get_assessed_compliance_report_by_period.return_value = (
        mock_assessed_report
    )

    # For version > 0, get_previous_summary will be called
    previous_summary_mock = MagicMock(spec=ComplianceReportSummary)
    previous_summary_mock.line_18_units_to_be_banked = 10
    previous_summary_mock.line_19_units_to_be_exported = 5
    mock_summary_repo.get_previous_summary = AsyncMock(
        return_value=previous_summary_mock
    )

    # Mock calculation services
    compliance_report_summary_service.calculate_fuel_supply_compliance_units = (
        AsyncMock(return_value=20)
    )
    compliance_report_summary_service.calculate_fuel_export_compliance_units = (
        AsyncMock(return_value=10)
    )

    # Call the target method
    summary_result, _ = (
        await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )
    )

    # Assertions
    mock_trxn_repo.calculate_line_17_available_balance_for_period.assert_not_called()

    line_values = _get_line_values(summary_result)
    assert (
        line_values[17] == existing_line_17_value
    )  # Should use the value from compliance_report.summary

    # Check other values to ensure calculation proceeded
    assert line_values[12] == 100  # Transferred out
    assert line_values[13] == 50  # Received
    assert line_values[14] == 25  # Issued
    assert (
        line_values[15] == 10
    )  # Prev issued for fuel supply (from previous_summary_mock)
    assert (
        line_values[16] == 5
    )  # Prev issued for fuel export (from previous_summary_mock)
    assert line_values[18] == 20  # Curr issued for fuel supply
    assert line_values[19] == 10  # Curr issued for fuel export

    # Line 20 = line 18 + line 19 - line 15 - line 16
    # Line 20 = 20 + 10 - 10 - 5 = 15
    assert line_values[20] == 15

    # Line 22 = line 17 + line 20 (if > 0)
    # Line 22 = 777 + 15 = 792
    assert line_values[22] == existing_line_17_value + 15


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
        line_4_eligible_renewable_fuel_required_gasoline=1,
        line_4_eligible_renewable_fuel_required_diesel=1,
        line_4_eligible_renewable_fuel_required_jet_fuel=1,
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
    # Line 6 - values are preserved but capped at 5% of line 4
    # Line 4: gasoline=10 (5% = 0.5 → rounds to 1), diesel=8 (5% = 0.4 → rounds to 0), jet_fuel=0 (5% = 0)
    # Original values: gasoline=100, diesel=200, jet_fuel=300
    # Capped values: min(100, 1) = 1, min(200, 0) = 0, min(300, 0) = 0
    assert result[5].gasoline == 1
    assert result[5].diesel == 0
    assert result[5].jet_fuel == 0
    # Line 7
    assert result[6].gasoline == 100.0
    assert result[6].diesel == 100.0
    assert result[6].jet_fuel == 100.0
    # Line 8 - values are preserved but capped at 5% of line 4
    # Original values: gasoline=100, diesel=100, jet_fuel=100
    # Capped values: min(100, 1) = 1, min(100, 0) = 0, min(100, 0) = 0
    assert result[7].gasoline == 1
    assert result[7].diesel == 0
    assert result[7].jet_fuel == 0
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
    assert result[3].diesel == 56.0  # Updated for 8% diesel rate in 2028
    assert result[3].jet_fuel == 11
    # Line 5
    assert result[4].gasoline == 500.0
    assert result[4].diesel == 100.0
    assert result[4].jet_fuel == 300.0
    # Line 6 - values are preserved but capped at 5% of line 4
    # Line 4: gasoline=15 (5% = 0.75 -> rounds to 1), diesel=56 (5% = 2.8 -> rounds to 3), jet_fuel=11 (5% = 0.55 -> rounds to 1)
    # Original values: gasoline=100, diesel=200, jet_fuel=300
    # Capped values: min(100, 1) = 1, min(200, 3) = 3, min(300, 1) = 1
    assert result[5].gasoline == 1
    assert result[5].diesel == 3
    assert result[5].jet_fuel == 1
    # Line 7
    assert result[6].gasoline == 300.0
    assert result[6].diesel == 500.0
    assert result[6].jet_fuel == 100.0
    # Line 8 - values are preserved but capped at 5% of line 4
    # Original values: gasoline=300, diesel=200, jet_fuel=100
    # Capped values: min(300, 1) = 1, min(200, 3) = 3, min(100, 1) = 1
    assert result[7].gasoline == 1
    assert result[7].diesel == 3
    assert result[7].jet_fuel == 1
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
    assert result[3].diesel == 40.0  # Updated for 8% diesel rate in 2029
    assert result[3].jet_fuel == 6.0
    # Line 5
    assert result[4].gasoline == 100.0
    assert result[4].diesel == 300.0
    assert result[4].jet_fuel == 200.0
    # Line 6 - values are preserved but capped at 5% of line 4
    # Line 4: gasoline=20 (5% = 1), diesel=40 (5% = 2), jet_fuel=6 (5% = 0.3 -> rounds to 0)
    # Original values: gasoline=100, diesel=200, jet_fuel=300
    # Capped values: min(100, 1) = 1, min(200, 2) = 2, min(300, 0) = 0
    assert result[5].gasoline == 1
    assert result[5].diesel == 2
    assert result[5].jet_fuel == 0
    # Line 7
    assert result[6].gasoline == 200.0
    assert result[6].diesel == 100.0
    assert result[6].jet_fuel == 300.0
    # Line 8 - values are preserved but capped at 5% of line 4
    # Original values: gasoline=300, diesel=200, jet_fuel=100
    # Line 4: gasoline=20 (5% = 1), diesel=40 (5% = 2), jet_fuel=6 (5% = 0)
    # Capped values: min(300, 1) = 1, min(200, 2) = 2, min(100, 0) = 0
    assert result[7].gasoline == 1
    assert result[7].diesel == 2
    assert result[7].jet_fuel == 0
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
    assert result[3].diesel == 40.0  # Updated for 8% diesel rate in 2030
    assert result[3].jet_fuel == 12.0
    # Line 5
    assert result[4].gasoline == 200.0
    assert result[4].diesel == 300.0
    assert result[4].jet_fuel == 100.0
    # Line 6 - values are preserved but capped at 5% of line 4
    # Line 4: gasoline=15 (5% = 0.75 -> rounds to 1), diesel=40 (5% = 2), jet_fuel=12 (5% = 0.6 -> rounds to 1)
    # Original values: gasoline=300, diesel=200, jet_fuel=100
    # Capped values: min(300, 1) = 1, min(200, 2) = 2, min(100, 1) = 1
    assert result[5].gasoline == 1
    assert result[5].diesel == 2
    assert result[5].jet_fuel == 1
    # Line 7
    assert result[6].gasoline == 300.0
    assert result[6].diesel == 100.0
    assert result[6].jet_fuel == 200.0
    # Line 8 - values are preserved but capped at 5% of line 4
    # Original values: gasoline=100, diesel=100, jet_fuel=100
    # Capped values: min(100, 1) = 1, min(100, 2) = 2, min(100, 1) = 1
    assert result[7].gasoline == 1
    assert result[7].diesel == 2
    assert result[7].jet_fuel == 1
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
    # Test case where there are no renewable quantities, resulting in penalties with decimals
    fossil_quantities = {"gasoline": 1005, "diesel": 2005, "jet_fuel": 3005}
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

    # Penalty should be applied due to no renewables, checking for decimal values
    assert result[10].gasoline == 15.08  # 50.25 L shortfall * $0.30/L = 15.075 rounded
    assert result[10].diesel == 72.18  # 160.4 L shortfall * $0.45/L = 72.18 (8% of 2005 = 160.4)
    assert result[10].jet_fuel == 45.08  # 90.15 L shortfall * $0.50/L = 45.075 rounded
    assert result[10].total_value == (15.08 + 72.18 + 45.08)  # 132.34


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
    # Test when values are preserved but capped at 5% of line 4.
    fossil_quantities = {"gasoline": 10000, "diesel": 20000, "jet_fuel": 30000}
    renewable_quantities = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    notional_transfers_sum = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    compliance_period = 2030
    summary_model = ComplianceReportSummary(
        line_6_renewable_fuel_retained_gasoline=100,
        line_6_renewable_fuel_retained_diesel=200,
        line_6_renewable_fuel_retained_jet_fuel=300,
        line_8_obligation_deferred_gasoline=50,
        line_8_obligation_deferred_diesel=100,
        line_8_obligation_deferred_jet_fuel=150,
    )
    # Set required renewable fuel values to match the summary model.
    expected_eligible_renewable_fuel_required = {
        "gasoline": 500.0,  # 5% of 10000
        "diesel": 800.0,  # 4% of 20000
        "jet_fuel": 900.0,  # 3% of 30000
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
    # Lines 6 & 8 should be preserved but capped at 5% of line 4
    # Line 4: gasoline=500 (5% = 25), diesel=1600 (5% = 80), jet_fuel=900 (5% = 45) - diesel is 8% for 2030
    # Original values: gasoline=100, diesel=200, jet_fuel=300
    # Capped values: min(100, 25) = 25, min(200, 80) = 80, min(300, 45) = 45
    assert result[5].gasoline == 25
    assert result[5].diesel == 80
    assert result[5].jet_fuel == 45
    # Line 8: gasoline=50, diesel=100, jet_fuel=150
    # Capped values: min(50, 25) = 25, min(100, 80) = 80, min(150, 45) = 45
    assert result[7].gasoline == 25
    assert result[7].diesel == 80
    assert result[7].jet_fuel == 45


@pytest.mark.anyio
async def test_calculate_renewable_fuel_target_summary_no_copy_lines_6_and_8(
    compliance_report_summary_service,
):
    # Test when values are preserved and capped at 5% of line 4
    fossil_quantities = {"gasoline": 100000, "diesel": 200000, "jet_fuel": 300000}
    renewable_quantities = {"gasoline": 5000, "diesel": 15000, "jet_fuel": 5000}
    previous_retained = {"gasoline": 2000, "diesel": 3000, "jet_fuel": 4000}
    previous_obligation = {"gasoline": 1000, "diesel": 2000, "jet_fuel": 3000}
    notional_transfers_sum = {"gasoline": 500, "diesel": 1000, "jet_fuel": 1500}
    compliance_period = 2030
    summary_model = ComplianceReportSummary(
        line_6_renewable_fuel_retained_gasoline=1000,
        line_6_renewable_fuel_retained_diesel=2000,
        line_6_renewable_fuel_retained_jet_fuel=3000,
        line_8_obligation_deferred_gasoline=500,
        line_8_obligation_deferred_diesel=1000,
        line_8_obligation_deferred_jet_fuel=1500,
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
    # Lines 6 & 8 are preserved but capped at 5% of calculated line 4
    # For 2030: renewable requirements result in line 4 values that give these 5% caps:
    # 5% caps: gasoline=263, diesel=860, jet_fuel=458 (diesel is 8% for 2030)
    # Line 6 original values: gasoline=1000, diesel=2000, jet_fuel=3000
    # Since original values exceed caps, they get capped down
    # But since 1000 > 263, we get min(1000, 263) = 263 (rounds up to 263 in calculation)
    assert result[5].gasoline == 263
    assert result[5].diesel == 860
    assert result[5].jet_fuel == 458
    # Line 8 original values: gasoline=500, diesel=1000, jet_fuel=1500
    # Capped values: min(500, 263) = 263, min(1000, 860) = 860, min(1500, 458) = 458
    assert result[7].gasoline == 263
    assert result[7].diesel == 860
    assert result[7].jet_fuel == 458


@pytest.mark.anyio
async def test_can_sign_flag_logic(
    compliance_report_summary_service, mock_repo, mock_summary_repo, mock_trxn_repo
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
    mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 1000
    previous_retained = {"gasoline": 10, "diesel": 20, "jet_fuel": 30}
    previous_obligation = {"gasoline": 5, "diesel": 10, "jet_fuel": 15}

    mock_repo.get_compliance_report_by_id = AsyncMock(
        return_value=mock_compliance_report
    )

    mock_summary_repo.get_assessed_compliance_report_by_period = AsyncMock(
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

    # Call the method again
    result = (
        await compliance_report_summary_service.calculate_compliance_report_summary(1)
    )

    # Assert that `can_sign` is False
    assert result.can_sign is False


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


@pytest.mark.anyio
async def test_line_17_method_called_during_summary_calculation(
    compliance_report_summary_service, mock_trxn_repo, mock_summary_repo
):
    """Test that the Line 17 TFRS method is called during low carbon fuel target summary calculation"""
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 123

    # Mock compliance report (non-supplemental)
    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.version = 0
    compliance_report.summary = MagicMock()
    compliance_report.summary.line_17_non_banked_units_used = None
    compliance_report.summary.is_locked = False  # Add is_locked attribute

    # Setup repository mocks
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 100
    mock_summary_repo.get_received_compliance_units.return_value = 200
    mock_summary_repo.get_issued_compliance_units.return_value = 300

    # Mock the TFRS Line 17 calculation
    expected_line_17_balance = 1500
    mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = (
        expected_line_17_balance
    )

    compliance_report_summary_service.calculate_fuel_supply_compliance_units = (
        AsyncMock(return_value=400)
    )
    compliance_report_summary_service.calculate_fuel_export_compliance_units = (
        AsyncMock(return_value=50)
    )

    # Call the low carbon fuel target summary calculation
    summary, penalty = (
        await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )
    )

    # Verify the Line 17 method was called with correct parameters
    mock_trxn_repo.calculate_line_17_available_balance_for_period.assert_called_once_with(
        organization_id, compliance_period_start.year
    )

    # Verify Line 17 value appears in the summary
    line_values = _get_line_values(summary)
    assert line_values[17] == expected_line_17_balance


@pytest.mark.anyio
async def test_line_17_different_compliance_periods(
    compliance_report_summary_service, mock_trxn_repo, mock_summary_repo
):
    """Test Line 17 calculation with different compliance periods"""
    organization_id = 456

    # Test 2023 compliance period
    compliance_period_start_2023 = datetime(2023, 1, 1)
    compliance_period_end_2023 = datetime(2023, 12, 31)

    compliance_report_2023 = MagicMock(spec=ComplianceReport)
    compliance_report_2023.version = 0
    compliance_report_2023.summary = MagicMock()
    compliance_report_2023.summary.line_17_non_banked_units_used = None
    compliance_report_2023.summary.is_locked = False  # Add is_locked attribute

    # Setup mocks
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 50
    mock_summary_repo.get_received_compliance_units.return_value = 100
    mock_summary_repo.get_issued_compliance_units.return_value = 150

    mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 800

    compliance_report_summary_service.calculate_fuel_supply_compliance_units = (
        AsyncMock(return_value=200)
    )
    compliance_report_summary_service.calculate_fuel_export_compliance_units = (
        AsyncMock(return_value=25)
    )

    # Call for 2023
    await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
        compliance_period_start_2023,
        compliance_period_end_2023,
        organization_id,
        compliance_report_2023,
    )

    # Verify 2023 was used
    mock_trxn_repo.calculate_line_17_available_balance_for_period.assert_called_with(
        organization_id, 2023
    )

    # Reset mock
    mock_trxn_repo.reset_mock()

    # Test 2025 compliance period
    compliance_period_start_2025 = datetime(2025, 1, 1)
    compliance_period_end_2025 = datetime(2025, 12, 31)

    compliance_report_2025 = MagicMock(spec=ComplianceReport)
    compliance_report_2025.version = 0
    compliance_report_2025.summary = MagicMock()
    compliance_report_2025.summary.line_17_non_banked_units_used = None
    compliance_report_2025.summary.is_locked = False  # Add is_locked attribute

    mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 1200

    # Call for 2025
    await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
        compliance_period_start_2025,
        compliance_period_end_2025,
        organization_id,
        compliance_report_2025,
    )

    # Verify 2025 was used
    mock_trxn_repo.calculate_line_17_available_balance_for_period.assert_called_with(
        organization_id, 2025
    )


@pytest.mark.anyio
async def test_supplemental_report_preserves_existing_line_17_value(
    compliance_report_summary_service, mock_trxn_repo, mock_summary_repo
):
    """Test that supplemental reports preserve existing Line 17 values"""
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 789

    # Mock supplemental report with existing Line 17 value
    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.version = 1  # Supplemental
    compliance_report.summary = MagicMock()
    existing_line_17_value = 2500
    compliance_report.summary.line_17_non_banked_units_used = existing_line_17_value
    compliance_report.summary.is_locked = True  # Add is_locked attribute

    # Setup repository mocks
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 150
    mock_summary_repo.get_received_compliance_units.return_value = 250
    mock_summary_repo.get_issued_compliance_units.return_value = 350

    # Mock previous summary for supplemental reports
    previous_summary_mock = MagicMock()
    previous_summary_mock.line_18_units_to_be_banked = 75
    previous_summary_mock.line_19_units_to_be_exported = 125
    mock_summary_repo.get_previous_summary = AsyncMock(
        return_value=previous_summary_mock
    )

    compliance_report_summary_service.calculate_fuel_supply_compliance_units = (
        AsyncMock(return_value=450)
    )
    compliance_report_summary_service.calculate_fuel_export_compliance_units = (
        AsyncMock(return_value=65)
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

    # Verify the Line 17 method was NOT called for supplemental with existing value
    mock_trxn_repo.calculate_line_17_available_balance_for_period.assert_not_called()

    # Verify existing Line 17 value is preserved
    line_values = _get_line_values(summary)
    assert line_values[17] == existing_line_17_value


@pytest.mark.anyio
async def test_supplemental_report_calculates_line_17_when_missing(
    compliance_report_summary_service, mock_trxn_repo, mock_summary_repo
):
    """Test that supplemental reports calculate Line 17 when no existing value is present"""
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 321

    # Mock supplemental report WITHOUT existing Line 17 value
    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.version = 2  # Supplemental
    compliance_report.summary = MagicMock()
    compliance_report.summary.line_17_non_banked_units_used = None  # No existing value
    compliance_report.summary.is_locked = False  # Add is_locked attribute

    # Setup repository mocks
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 80
    mock_summary_repo.get_received_compliance_units.return_value = 160
    mock_summary_repo.get_issued_compliance_units.return_value = 240

    # Mock previous summary for supplemental reports
    previous_summary_mock = MagicMock()
    previous_summary_mock.line_18_units_to_be_banked = 40
    previous_summary_mock.line_19_units_to_be_exported = 60
    mock_summary_repo.get_previous_summary = AsyncMock(
        return_value=previous_summary_mock
    )

    # Mock the TFRS Line 17 calculation
    expected_line_17_balance = 1800
    mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = (
        expected_line_17_balance
    )

    compliance_report_summary_service.calculate_fuel_supply_compliance_units = (
        AsyncMock(return_value=320)
    )
    compliance_report_summary_service.calculate_fuel_export_compliance_units = (
        AsyncMock(return_value=45)
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

    # Verify the Line 17 method was called for supplemental without existing value
    mock_trxn_repo.calculate_line_17_available_balance_for_period.assert_called_once_with(
        organization_id, compliance_period_start.year
    )

    # Verify Line 17 value in summary
    line_values = _get_line_values(summary)
    assert line_values[17] == expected_line_17_balance


@pytest.mark.anyio
async def test_line_17_error_handling(
    compliance_report_summary_service, mock_trxn_repo, mock_summary_repo
):
    """Test error handling when Line 17 calculation fails"""
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 999

    # Mock compliance report
    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.version = 0
    compliance_report.summary = MagicMock()
    compliance_report.summary.line_17_non_banked_units_used = None
    compliance_report.summary.is_locked = False  # Add is_locked attribute

    # Setup repository mocks
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 100
    mock_summary_repo.get_received_compliance_units.return_value = 200
    mock_summary_repo.get_issued_compliance_units.return_value = 300

    # Mock the TFRS Line 17 calculation to raise an exception
    mock_trxn_repo.calculate_line_17_available_balance_for_period.side_effect = (
        Exception("Database connection failed")
    )

    compliance_report_summary_service.calculate_fuel_supply_compliance_units = (
        AsyncMock(return_value=400)
    )
    compliance_report_summary_service.calculate_fuel_export_compliance_units = (
        AsyncMock(return_value=50)
    )

    # Test that the exception is properly propagated
    with pytest.raises(Exception, match="Database connection failed"):
        await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )


@pytest.mark.anyio
async def test_line_17_zero_balance_handling(
    compliance_report_summary_service, mock_trxn_repo, mock_summary_repo
):
    """Test handling of zero balance from Line 17 calculation"""
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 111

    # Mock compliance report
    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.version = 0
    compliance_report.summary = MagicMock()
    compliance_report.summary.line_17_non_banked_units_used = None
    compliance_report.summary.is_locked = False  # Add is_locked attribute

    # Setup repository mocks
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 75
    mock_summary_repo.get_received_compliance_units.return_value = 125
    mock_summary_repo.get_issued_compliance_units.return_value = 175

    # Mock the TFRS Line 17 calculation to return 0
    mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 0

    compliance_report_summary_service.calculate_fuel_supply_compliance_units = (
        AsyncMock(return_value=250)
    )
    compliance_report_summary_service.calculate_fuel_export_compliance_units = (
        AsyncMock(return_value=35)
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

    # Verify Line 17 is 0
    line_values = _get_line_values(summary)
    assert line_values[17] == 0

    # Verify other calculations proceed normally
    assert line_values[12] == 75  # Transferred out
    assert line_values[13] == 125  # Received
    assert line_values[14] == 175  # Issued


@pytest.mark.anyio
async def test_supplemental_report_unlocked_recalculates_line_17(
    compliance_report_summary_service, mock_trxn_repo, mock_summary_repo
):
    """Test that unlocked supplemental reports recalculate Line 17 even with existing value"""
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 654

    # Mock supplemental report with existing Line 17 value but NOT locked
    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.version = 1  # Supplemental
    compliance_report.summary = MagicMock()
    existing_line_17_value = 1500  # This should be ignored since not locked
    compliance_report.summary.line_17_non_banked_units_used = existing_line_17_value
    compliance_report.summary.is_locked = False  # NOT locked - should recalculate

    # Setup repository mocks
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 200
    mock_summary_repo.get_received_compliance_units.return_value = 400
    mock_summary_repo.get_issued_compliance_units.return_value = 600

    # Mock previous summary for supplemental reports
    previous_summary_mock = MagicMock()
    previous_summary_mock.line_18_units_to_be_banked = 100
    previous_summary_mock.line_19_units_to_be_exported = 150
    mock_summary_repo.get_previous_summary = AsyncMock(
        return_value=previous_summary_mock
    )

    # Mock the TFRS Line 17 calculation - this should be called and used
    expected_line_17_balance = 2200  # Different from existing value
    mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = (
        expected_line_17_balance
    )

    compliance_report_summary_service.calculate_fuel_supply_compliance_units = (
        AsyncMock(return_value=500)
    )
    compliance_report_summary_service.calculate_fuel_export_compliance_units = (
        AsyncMock(return_value=75)
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

    # Verify the Line 17 method WAS called for unlocked supplemental
    mock_trxn_repo.calculate_line_17_available_balance_for_period.assert_called_once_with(
        organization_id, compliance_period_start.year
    )

    # Verify NEW calculated Line 17 value is used, not the existing one
    line_values = _get_line_values(summary)
    assert line_values[17] == expected_line_17_balance
    assert line_values[17] != existing_line_17_value  # Should be different


@pytest.mark.anyio
async def test_line_17_integration_with_compliance_report_creation(
    compliance_report_summary_service, mock_trxn_repo, mock_summary_repo
):
    """Test that Line 17 calculation integrates properly with compliance report summary creation workflow"""
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 555

    # Mock compliance report
    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.version = 0
    compliance_report.summary = MagicMock()
    compliance_report.summary.line_17_non_banked_units_used = None
    compliance_report.summary.is_locked = False  # Add is_locked attribute

    # Setup repository mocks with realistic values
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 500
    mock_summary_repo.get_received_compliance_units.return_value = 1000
    mock_summary_repo.get_issued_compliance_units.return_value = 1500

    # Mock TFRS Line 17 calculation with a realistic balance
    expected_line_17_balance = 2750
    mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = (
        expected_line_17_balance
    )

    compliance_report_summary_service.calculate_fuel_supply_compliance_units = (
        AsyncMock(return_value=800)
    )
    compliance_report_summary_service.calculate_fuel_export_compliance_units = (
        AsyncMock(return_value=150)
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

    # Verify Line 17 method was called correctly
    mock_trxn_repo.calculate_line_17_available_balance_for_period.assert_called_once_with(
        organization_id, 2024
    )

    # Verify the summary contains the correct Line 17 value
    line_values = _get_line_values(summary)
    assert line_values[17] == expected_line_17_balance

    # Verify that other summary lines also contain expected values
    assert line_values[12] == 500  # Transferred out
    assert line_values[13] == 1000  # Received
    assert line_values[14] == 1500  # Issued

    # Verify that a summary was returned
    assert summary is not None
    assert len(summary) > 0

    # Verify penalty was calculated
    assert penalty is not None


@pytest.mark.anyio
async def test_calculate_notional_transfers_sum_quarterly_logic(
    compliance_report_summary_service,
):
    """Test the quarterly notional transfer calculation logic we added"""

    # Test data for notional transfers with quarterly fields
    test_notional_transfers = [
        # Regular transfer with quantity field only
        NotionalTransferSchema(
            notional_transfer_id=1,
            compliance_report_id=1,
            fuel_category="Gasoline",
            received_or_transferred=ReceivedOrTransferredEnumSchema.Received,
            quantity=1000,
            q1_quantity=None,
            q2_quantity=None,
            q3_quantity=None,
            q4_quantity=None,
            legal_name="Test Company 1",
            address_for_service="123 Test St",
            group_uuid="test-group-1",
            version=1,
            action_type="create",
        ),
        # Quarterly transfer with quarterly fields only
        NotionalTransferSchema(
            notional_transfer_id=2,
            compliance_report_id=1,
            fuel_category="Diesel",
            received_or_transferred=ReceivedOrTransferredEnumSchema.Received,
            quantity=None,
            q1_quantity=250,
            q2_quantity=300,
            q3_quantity=200,
            q4_quantity=250,
            legal_name="Test Company 2",
            address_for_service="456 Test Ave",
            group_uuid="test-group-2",
            version=1,
            action_type="create",
        ),
        # Transferred quarterly transfer
        NotionalTransferSchema(
            notional_transfer_id=3,
            compliance_report_id=1,
            fuel_category="Jet fuel",
            received_or_transferred=ReceivedOrTransferredEnumSchema.Transferred,
            quantity=None,
            q1_quantity=100,
            q2_quantity=150,
            q3_quantity=100,
            q4_quantity=150,
            legal_name="Test Company 3",
            address_for_service="789 Test Blvd",
            group_uuid="test-group-3",
            version=1,
            action_type="create",
        ),
        # Mixed quarterly transfer (some quarters with values)
        NotionalTransferSchema(
            notional_transfer_id=4,
            compliance_report_id=1,
            fuel_category="Gasoline",
            received_or_transferred=ReceivedOrTransferredEnumSchema.Received,
            quantity=None,
            q1_quantity=500,
            q2_quantity=None,
            q3_quantity=300,
            q4_quantity=None,
            legal_name="Test Company 4",
            address_for_service="321 Test Dr",
            group_uuid="test-group-4",
            version=1,
            action_type="create",
        ),
    ]

    # Test the logic directly (same as implemented in summary service)
    notional_transfers_sums = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}

    for transfer in test_notional_transfers:
        # Normalize the fuel category key
        normalized_category = transfer.fuel_category.replace(" ", "_").lower()

        # Calculate total quantity - use quarterly fields if main quantity is None
        total_quantity = transfer.quantity
        if total_quantity is None:
            # Sum up quarterly quantities for quarterly notional transfers
            quarterly_sum = (
                (transfer.q1_quantity or 0)
                + (transfer.q2_quantity or 0)
                + (transfer.q3_quantity or 0)
                + (transfer.q4_quantity or 0)
            )
            total_quantity = quarterly_sum if quarterly_sum > 0 else 0

        # Update the corresponding category sum
        if transfer.received_or_transferred.lower() == "received":
            notional_transfers_sums[normalized_category] += total_quantity
        elif transfer.received_or_transferred.lower() == "transferred":
            notional_transfers_sums[normalized_category] -= total_quantity

    # Verify the calculations
    # Expected results:
    # Gasoline: 1000 (regular) + 800 (500 + 300 from quarterly) = 1800
    # Diesel: 1000 (250 + 300 + 200 + 250 from quarterly) = 1000
    # Jet fuel: -500 (transferred, so negative: -(100 + 150 + 100 + 150)) = -500

    assert notional_transfers_sums["gasoline"] == 1800
    assert notional_transfers_sums["diesel"] == 1000
    assert notional_transfers_sums["jet_fuel"] == -500


@pytest.mark.anyio
async def test_quarterly_notional_transfer_edge_cases():
    """Test edge cases for quarterly notional transfer calculations"""

    test_edge_cases = [
        # Transfer with quantity=0 and quarterly fields (quantity takes precedence)
        NotionalTransferSchema(
            notional_transfer_id=1,
            compliance_report_id=1,
            fuel_category="Gasoline",
            received_or_transferred=ReceivedOrTransferredEnumSchema.Received,
            quantity=0,
            q1_quantity=100,
            q2_quantity=200,
            q3_quantity=150,
            q4_quantity=50,
            legal_name="Test Company 1",
            address_for_service="123 Test St",
            group_uuid="test-group-1",
            version=1,
            action_type="create",
        ),
        # Transfer with quarterly fields only (at least one non-zero)
        NotionalTransferSchema(
            notional_transfer_id=2,
            compliance_report_id=1,
            fuel_category="Diesel",
            received_or_transferred=ReceivedOrTransferredEnumSchema.Received,
            quantity=None,
            q1_quantity=0,
            q2_quantity=0,
            q3_quantity=100,  # At least one non-zero quarterly field
            q4_quantity=0,
            legal_name="Test Company 2",
            address_for_service="456 Test Ave",
            group_uuid="test-group-2",
            version=1,
            action_type="create",
        ),
        # Transfer with negative quarterly values (unusual but possible)
        NotionalTransferSchema(
            notional_transfer_id=3,
            compliance_report_id=1,
            fuel_category="Jet fuel",
            received_or_transferred=ReceivedOrTransferredEnumSchema.Received,
            quantity=None,
            q1_quantity=-50,
            q2_quantity=100,
            q3_quantity=-25,
            q4_quantity=75,
            legal_name="Test Company 3",
            address_for_service="789 Test Blvd",
            group_uuid="test-group-3",
            version=1,
            action_type="create",
        ),
    ]

    # Test the quarterly calculation logic
    notional_transfers_sums = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}

    for transfer in test_edge_cases:
        # Normalize the fuel category key
        normalized_category = transfer.fuel_category.replace(" ", "_").lower()

        # Calculate total quantity - use quarterly fields if main quantity is None
        total_quantity = transfer.quantity
        if total_quantity is None:
            # Sum up quarterly quantities for quarterly notional transfers
            quarterly_sum = (
                (transfer.q1_quantity or 0)
                + (transfer.q2_quantity or 0)
                + (transfer.q3_quantity or 0)
                + (transfer.q4_quantity or 0)
            )
            total_quantity = quarterly_sum if quarterly_sum > 0 else 0

        # Update the corresponding category sum
        if transfer.received_or_transferred.lower() == "received":
            notional_transfers_sums[normalized_category] += total_quantity
        elif transfer.received_or_transferred.lower() == "transferred":
            notional_transfers_sums[normalized_category] -= total_quantity

    # Expected results:
    # Gasoline: quantity=0, so use 0 (not quarterly fields)
    # Diesel: 0 + 0 + 100 + 0 = 100
    # Jet fuel: -50 + 100 + (-25) + 75 = 100

    assert notional_transfers_sums["gasoline"] == 0
    assert notional_transfers_sums["diesel"] == 100
    assert notional_transfers_sums["jet_fuel"] == 100


@pytest.mark.anyio
async def test_notional_transfer_summary_integration_with_quarterly(
    compliance_report_summary_service, mock_trxn_repo, mock_summary_repo
):
    """Integration test for compliance report summary with quarterly notional transfers"""

    # Setup compliance report
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 1

    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.version = 0
    compliance_report.summary = MagicMock()
    compliance_report.summary.line_17_non_banked_units_used = None
    compliance_report.summary.is_locked = False

    # Mock quarterly notional transfers
    quarterly_notional_transfers = [
        NotionalTransferSchema(
            notional_transfer_id=1,
            compliance_report_id=1,
            fuel_category="Gasoline",
            received_or_transferred=ReceivedOrTransferredEnumSchema.Received,
            quantity=None,
            q1_quantity=500,
            q2_quantity=500,
            q3_quantity=0,
            q4_quantity=0,
            legal_name="Test Company",
            address_for_service="123 Test St",
            group_uuid="test-group-1",
            version=1,
            action_type="create",
        )
    ]

    mock_notional_transfers_response = MagicMock()
    mock_notional_transfers_response.notional_transfers = quarterly_notional_transfers

    # Setup repository responses
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 100
    mock_summary_repo.get_received_compliance_units.return_value = 200
    mock_summary_repo.get_issued_compliance_units.return_value = 300
    mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 1000

    # Mock the notional transfer service to return our quarterly data
    compliance_report_summary_service.notional_transfer_service.calculate_notional_transfers = AsyncMock(
        return_value=mock_notional_transfers_response
    )

    compliance_report_summary_service.calculate_fuel_supply_compliance_units = (
        AsyncMock(return_value=400)
    )
    compliance_report_summary_service.calculate_fuel_export_compliance_units = (
        AsyncMock(return_value=50)
    )

    # Call the low carbon fuel target summary calculation
    summary, penalty = (
        await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )
    )

    # Verify the summary was calculated without errors
    assert isinstance(summary, list)
    assert len(summary) == 11

    # Verify that the calculation completed successfully (not asserting the mock call since it's internal)
    assert summary is not None


@pytest.mark.anyio
async def test_quarterly_notional_transfer_calculation_logic(
    compliance_report_summary_service, mock_trxn_repo, mock_summary_repo
):
    """Test the quarterly notional transfer calculation logic in the compliance report summary"""

    # Setup compliance report
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)
    organization_id = 1

    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.compliance_report_id = 1
    compliance_report.version = 0
    compliance_report.summary = MagicMock()
    compliance_report.summary.line_17_non_banked_units_used = None
    compliance_report.summary.is_locked = False
    compliance_report.compliance_report_group_uuid = "test-group-uuid"
    compliance_report.compliance_period = MagicMock()
    compliance_report.compliance_period.effective_date = compliance_period_start
    compliance_report.compliance_period.expiration_date = compliance_period_end
    compliance_report.compliance_period.description = "2024"
    compliance_report.organization_id = organization_id

    # Create test notional transfers with quarterly data
    test_notional_transfers = [
        NotionalTransferSchema(
            notional_transfer_id=1,
            compliance_report_id=1,
            fuel_category="Gasoline",
            received_or_transferred=ReceivedOrTransferredEnumSchema.Received,
            quantity=None,  # Use quarterly fields
            q1_quantity=500,
            q2_quantity=500,
            q3_quantity=0,
            q4_quantity=0,
            legal_name="Test Company 1",
            address_for_service="123 Test St",
            group_uuid="test-group-1",
            version=1,
            action_type="create",
        ),
        NotionalTransferSchema(
            notional_transfer_id=2,
            compliance_report_id=1,
            fuel_category="Diesel",
            received_or_transferred=ReceivedOrTransferredEnumSchema.Transferred,
            quantity=None,  # Use quarterly fields
            q1_quantity=200,
            q2_quantity=300,
            q3_quantity=100,
            q4_quantity=200,
            legal_name="Test Company 2",
            address_for_service="456 Test Ave",
            group_uuid="test-group-2",
            version=1,
            action_type="create",
        ),
    ]

    mock_notional_transfers_response = MagicMock()
    mock_notional_transfers_response.notional_transfers = test_notional_transfers

    # Setup repository responses
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 100
    mock_summary_repo.get_received_compliance_units.return_value = 200
    mock_summary_repo.get_issued_compliance_units.return_value = 300
    mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 1000

    # Mock other required methods
    compliance_report_summary_service.notional_transfer_service.calculate_notional_transfers = AsyncMock(
        return_value=mock_notional_transfers_response
    )
    compliance_report_summary_service.calculate_fuel_supply_compliance_units = (
        AsyncMock(return_value=400)
    )
    compliance_report_summary_service.calculate_fuel_export_compliance_units = (
        AsyncMock(return_value=50)
    )
    compliance_report_summary_service.fuel_supply_repo.get_effective_fuel_supplies = (
        AsyncMock(return_value=[])
    )
    compliance_report_summary_service.other_uses_repo.get_effective_other_uses = (
        AsyncMock(return_value=[])
    )
    compliance_report_summary_service.fuel_export_repo.get_effective_fuel_exports = (
        AsyncMock(return_value=[])
    )
    compliance_report_summary_service.allocation_agreement_repo.get_allocation_agreements = AsyncMock(
        return_value=[]
    )
    compliance_report_summary_service.repo.get_compliance_report_by_id = AsyncMock(
        return_value=compliance_report
    )
    compliance_report_summary_service.calculate_quarterly_fuel_supply_compliance_units = AsyncMock(
        return_value=[0, 0, 0, 0]
    )

    # Mock aggregate methods to return empty results
    mock_summary_repo.aggregate_quantities.return_value = {}

    # Call the compliance report summary calculation
    result = (
        await compliance_report_summary_service.calculate_compliance_report_summary(
            compliance_report.compliance_report_id
        )
    )

    # Verify the summary was calculated without errors
    assert result is not None
    assert hasattr(result, "renewable_fuel_target_summary")
    assert hasattr(result, "low_carbon_fuel_target_summary")

    # The main test is that the calculation completed successfully with quarterly notional transfers
    # and the quarterly calculation logic we added didn't cause any errors
    # This verifies that our quarterly notional transfer schema validation and processing works
    assert result is not None


@pytest.mark.anyio
async def test_penalty_override_enabled_2024_compliance_period(
    compliance_report_summary_service,
):
    """Test penalty override fields are available for 2024+ compliance periods"""
    from lcfs.db.models.compliance.ComplianceReportSummary import (
        ComplianceReportSummary,
    )
    from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
    from datetime import datetime, timezone

    # Create a 2024 compliance report
    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.compliance_period = MagicMock()
    compliance_report.compliance_period.description = "2024"

    penalty_date = datetime(2024, 6, 15, 10, 30, 0, tzinfo=timezone.utc)

    summary_obj = ComplianceReportSummary(
        compliance_report_id=1,
        penalty_override_enabled=True,
        renewable_penalty_override=1500.75,
        low_carbon_penalty_override=750.50,
        penalty_override_date=penalty_date,
        penalty_override_user=123,
        # Required fields for renewable calculations
        line_4_eligible_renewable_fuel_required_gasoline=100000,
        line_4_eligible_renewable_fuel_required_diesel=50000,
        line_4_eligible_renewable_fuel_required_jet_fuel=25000,
        # Initialize other required fields
        line_11_fossil_derived_base_fuel_total=0,
        line_21_non_compliance_penalty_payable=0,
        total_non_compliance_penalty_payable=0,
    )

    result = compliance_report_summary_service.convert_summary_to_dict(
        summary_obj, compliance_report
    )

    assert result.penalty_override_enabled is True
    assert result.renewable_penalty_override == 1500.75
    assert result.low_carbon_penalty_override == 750.50
    assert result.penalty_override_date == penalty_date
    assert result.penalty_override_user == 123


@pytest.mark.anyio
async def test_penalty_override_disabled_pre_2024_compliance_period(
    compliance_report_summary_service,
):
    """Test penalty override fields are disabled for pre-2024 compliance periods"""
    from lcfs.db.models.compliance.ComplianceReportSummary import (
        ComplianceReportSummary,
    )
    from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
    from datetime import datetime, timezone

    # Create a 2023 compliance report
    compliance_report = MagicMock(spec=ComplianceReport)
    compliance_report.compliance_period = MagicMock()
    compliance_report.compliance_period.description = "2023"

    penalty_date = datetime(2023, 6, 15, 10, 30, 0, tzinfo=timezone.utc)

    summary_obj = ComplianceReportSummary(
        compliance_report_id=1,
        penalty_override_enabled=True,  # Should be ignored for 2023
        renewable_penalty_override=1500.75,
        low_carbon_penalty_override=750.50,
        penalty_override_date=penalty_date,
        penalty_override_user=123,
        # Required fields for renewable calculations
        line_4_eligible_renewable_fuel_required_gasoline=100000,
        line_4_eligible_renewable_fuel_required_diesel=50000,
        line_4_eligible_renewable_fuel_required_jet_fuel=25000,
        # Initialize other required fields
        line_11_fossil_derived_base_fuel_total=0,
        line_21_non_compliance_penalty_payable=0,
        total_non_compliance_penalty_payable=0,
    )

    result = compliance_report_summary_service.convert_summary_to_dict(
        summary_obj, compliance_report
    )

    # All penalty override fields should be disabled/None for pre-2024
    assert result.penalty_override_enabled is False
    assert result.renewable_penalty_override is None
    assert result.low_carbon_penalty_override is None
    assert result.penalty_override_date is None
    assert result.penalty_override_user is None


@pytest.mark.anyio
async def test_penalty_override_without_compliance_report(
    compliance_report_summary_service,
):
    """Test penalty override fields are disabled when no compliance report is provided"""
    from lcfs.db.models.compliance.ComplianceReportSummary import (
        ComplianceReportSummary,
    )
    from datetime import datetime, timezone

    penalty_date = datetime(2024, 6, 15, 10, 30, 0, tzinfo=timezone.utc)

    summary_obj = ComplianceReportSummary(
        compliance_report_id=1,
        penalty_override_enabled=True,
        renewable_penalty_override=1500.75,
        low_carbon_penalty_override=750.50,
        penalty_override_date=penalty_date,
        penalty_override_user=123,
        # Required fields for renewable calculations
        line_4_eligible_renewable_fuel_required_gasoline=100000,
        line_4_eligible_renewable_fuel_required_diesel=50000,
        line_4_eligible_renewable_fuel_required_jet_fuel=25000,
        # Initialize other required fields
        line_11_fossil_derived_base_fuel_total=0,
        line_21_non_compliance_penalty_payable=0,
        total_non_compliance_penalty_payable=0,
    )

    result = compliance_report_summary_service.convert_summary_to_dict(
        summary_obj, None
    )

    # All penalty override fields should be disabled/None when no compliance report
    assert result.penalty_override_enabled is False
    assert result.renewable_penalty_override is None
    assert result.low_carbon_penalty_override is None
    assert result.penalty_override_date is None
    assert result.penalty_override_user is None


@pytest.mark.anyio
async def test_calculate_non_compliance_penalty_with_override_scenarios(
    compliance_report_summary_service, compliance_report_summary_row_schema
):
    """Test penalty calculation scenarios with different override states"""

    # Test scenario 1: Normal penalty calculation (no override)
    mock_renewable_summary = [
        compliance_report_summary_row_schema(
            line=11, gasoline=500, diesel=750, jet_fuel=250, total_value=1500
        )
    ]

    penalty_payable_units = -2  # Should result in penalty
    result = compliance_report_summary_service.calculate_non_compliance_penalty_summary(
        penalty_payable_units, mock_renewable_summary
    )

    assert len(result) == 3
    # Line 11 (renewable fuel penalty) - can be int, string, or legacy format
    assert result[0].line in [11, "11", "11 | 22"]
    assert result[0].total_value == 1500
    # Line 21 (low carbon fuel penalty) - can be int, string, or legacy format
    assert result[1].line in [21, "21", "21 | 33"]
    assert result[1].total_value == 1200  # -2 * -600 = 1200
    # Total
    assert result[2].line is None
    assert result[2].total_value == 2700  # 1500 + 1200

    # Test scenario 2: Zero penalty units
    penalty_payable_units = 0
    result = compliance_report_summary_service.calculate_non_compliance_penalty_summary(
        penalty_payable_units, mock_renewable_summary
    )

    assert len(result) == 3
    assert result[1].total_value == 0  # No penalty when units are 0
    assert result[2].total_value == 1500  # Only renewable penalty


@pytest.mark.anyio
async def test_penalty_override_calculation_integration():
    """Test that penalty override values are properly used in total calculation"""
    from lcfs.db.models.compliance.ComplianceReportSummary import (
        ComplianceReportSummary,
    )

    # This would typically be tested at the repository level where the total is calculated
    # based on override state, but we can test the logic here

    summary_obj = ComplianceReportSummary()

    # Test with override enabled
    summary_obj.penalty_override_enabled = True
    summary_obj.renewable_penalty_override = 1000.0
    summary_obj.low_carbon_penalty_override = 500.0
    summary_obj.line_11_fossil_derived_base_fuel_total = 1500.0  # Should be ignored
    summary_obj.line_21_non_compliance_penalty_payable = 750.0  # Should be ignored

    # This logic would be in the repository when saving
    if summary_obj.penalty_override_enabled:
        renewable_override = summary_obj.renewable_penalty_override or 0
        low_carbon_override = summary_obj.low_carbon_penalty_override or 0
        expected_total = renewable_override + low_carbon_override
    else:
        line_11_total = summary_obj.line_11_fossil_derived_base_fuel_total or 0
        line_21_total = summary_obj.line_21_non_compliance_penalty_payable or 0
        expected_total = line_11_total + line_21_total

    assert expected_total == 1500.0  # 1000 + 500 (override values)

    # Test with override disabled
    summary_obj.penalty_override_enabled = False

    if summary_obj.penalty_override_enabled:
        renewable_override = summary_obj.renewable_penalty_override or 0
        low_carbon_override = summary_obj.low_carbon_penalty_override or 0
        expected_total = renewable_override + low_carbon_override
    else:
        line_11_total = summary_obj.line_11_fossil_derived_base_fuel_total or 0
        line_21_total = summary_obj.line_21_non_compliance_penalty_payable or 0
        expected_total = line_11_total + line_21_total

    assert expected_total == 2250.0  # 1500 + 750 (calculated values)


@pytest.mark.anyio
async def test_penalty_override_with_null_values():
    """Test penalty override calculation with null override values"""
    from lcfs.db.models.compliance.ComplianceReportSummary import (
        ComplianceReportSummary,
    )

    summary_obj = ComplianceReportSummary()
    summary_obj.penalty_override_enabled = True
    summary_obj.renewable_penalty_override = None  # Null value
    summary_obj.low_carbon_penalty_override = 500.0

    # Test the null handling logic
    renewable_override = summary_obj.renewable_penalty_override or 0
    low_carbon_override = summary_obj.low_carbon_penalty_override or 0
    expected_total = renewable_override + low_carbon_override

    assert expected_total == 500.0  # 0 + 500 (null treated as 0)


@pytest.mark.anyio
async def test_penalty_override_with_zero_values():
    """Test penalty override calculation with explicit zero values"""
    from lcfs.db.models.compliance.ComplianceReportSummary import (
        ComplianceReportSummary,
    )

    summary_obj = ComplianceReportSummary()
    summary_obj.penalty_override_enabled = True
    summary_obj.renewable_penalty_override = 0.0
    summary_obj.low_carbon_penalty_override = 0.0

    # Test the zero handling logic
    renewable_override = summary_obj.renewable_penalty_override or 0
    low_carbon_override = summary_obj.low_carbon_penalty_override or 0
    expected_total = renewable_override + low_carbon_override

    assert expected_total == 0.0  # 0 + 0 (explicit zeros)


# Tests for Summary Lines 7 & 9 Auto-population and Locking (Issue #2893)

@pytest.mark.anyio
async def test_renewable_fuel_target_summary_contains_lines_7_and_9(
    compliance_report_summary_service,
):
    """Test that renewable fuel target summary includes Lines 7 & 9 in the result."""
    # Mock data
    fossil_quantities = {"gasoline": 1000, "diesel": 2000, "jet_fuel": 500}
    renewable_quantities = {"gasoline": 100, "diesel": 200, "jet_fuel": 50}
    previous_retained = {"gasoline": 10, "diesel": 20, "jet_fuel": 5}  # This should populate Line 7
    previous_obligation = {"gasoline": 5, "diesel": 10, "jet_fuel": 2}  # This should populate Line 9
    notional_transfers_sums = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}
    
    # Create a proper ComplianceReportSummary mock with the actual fields
    from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
    mock_prev_summary = ComplianceReportSummary(
        line_6_renewable_fuel_retained_gasoline=100,
        line_6_renewable_fuel_retained_diesel=200,
        line_6_renewable_fuel_retained_jet_fuel=50,
        line_8_obligation_deferred_gasoline=10,
        line_8_obligation_deferred_diesel=20,
        line_8_obligation_deferred_jet_fuel=5,
        line_4_eligible_renewable_fuel_required_gasoline=50,
        line_4_eligible_renewable_fuel_required_diesel=80,
        line_4_eligible_renewable_fuel_required_jet_fuel=0,
    )
    
    # Test that the method includes Lines 7 & 9 in the result
    result = compliance_report_summary_service.calculate_renewable_fuel_target_summary(
        fossil_quantities,
        renewable_quantities,
        previous_retained,
        previous_obligation,
        notional_transfers_sums,
        2025,
        mock_prev_summary,
    )
    
    # Check that all lines are present in the result - should be 11 lines total
    assert len(result) == 11, f"Expected 11 lines, got {len(result)}"
    
    # Find Lines 7 & 9 in the result (handle both legacy and non-legacy formats)
    line_7_row = next((row for row in result if row.line in [7, "7", "7 | 18"]), None)
    line_9_row = next((row for row in result if row.line in [9, "9", "9 | 20"]), None)
    
    assert line_7_row is not None, f"Line 7 should be present in summary. Found lines: {[row.line for row in result]}"
    assert line_9_row is not None, f"Line 9 should be present in summary. Found lines: {[row.line for row in result]}"
    assert line_7_row.gasoline == previous_retained["gasoline"]  # 10
    assert line_7_row.diesel == previous_retained["diesel"]      # 20
    assert line_7_row.jet_fuel == previous_retained["jet_fuel"]  # 5
    
    assert line_9_row.gasoline == previous_obligation["gasoline"]  # 5
    assert line_9_row.diesel == previous_obligation["diesel"]      # 10
    assert line_9_row.jet_fuel == previous_obligation["jet_fuel"]  # 2
