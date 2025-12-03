"""
Tests for Line 12 and Line 13 transfer date range logic
Ticket #3295 - Transfer after compliance date being applied to previous compliance report

This test suite verifies that:
1. First compliance report includes transfers from January 1 to March 31 (following year)
2. Subsequent reports include transfers from April 1 to March 31 (following year)
3. Transfers outside the date range are excluded
4. No overlap occurs between compliance periods
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.web.api.compliance_report.summary_service import ComplianceReportSummaryService


@pytest.fixture
def mock_service():
    """Create a ComplianceReportSummaryService with mocked dependencies"""
    service = ComplianceReportSummaryService(
        repo=MagicMock(),
        cr_repo=MagicMock(),
        trxn_repo=MagicMock(),
        notional_transfer_service=MagicMock(),
        fuel_supply_repo=MagicMock(),
        fuel_export_repo=MagicMock(),
        allocation_agreement_repo=MagicMock(),
        other_uses_repo=MagicMock(),
        compliance_data_service=MagicMock(),
    )
    return service


def create_mock_compliance_report(year: int, report_id: int = 1, version: int = 0):
    """Helper to create a mock ComplianceReport for testing"""
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.organization_id = 100
    mock_report.version = version

    # Mock compliance period
    mock_period = MagicMock()
    mock_period.description = str(year)
    mock_period.effective_date = datetime(year, 1, 1)
    mock_period.expiration_date = datetime(year, 12, 31)
    mock_report.compliance_period = mock_period

    # Mock summary
    mock_summary = MagicMock()
    mock_summary.is_locked = False
    mock_summary.line_17_non_banked_units_used = None
    mock_report.summary = mock_summary

    return mock_report


@pytest.mark.anyio
async def test_first_report_uses_january_to_march_date_range(mock_service):
    """
    Test that first compliance report (no previous assessed report) uses January 1 to March 31.

    Given:
    - Compliance year: 2024
    - No previous assessed report for 2023

    Expected:
    - Transaction period: Jan 1, 2024 to Mar 31, 2025
    """
    compliance_year = 2024
    organization_id = 100

    # Mock: No previous assessed report exists
    mock_service.cr_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=None)

    # Call the helper method
    start_date, end_date = await mock_service._calculate_transaction_period_dates(
        compliance_year, organization_id, exclude_report_id=1
    )

    # Verify dates
    assert start_date == datetime(2024, 1, 1, 0, 0, 0), "First report should start on January 1"
    assert end_date == datetime(2025, 3, 31, 23, 59, 59), "First report should end on March 31 of following year"

    # Verify the previous report check was made
    mock_service.cr_repo.get_assessed_compliance_report_by_period.assert_called_once_with(
        organization_id, 2023, 1
    )


@pytest.mark.anyio
async def test_subsequent_report_uses_april_to_march_date_range(mock_service):
    """
    Test that subsequent compliance report (has previous assessed report) uses April 1 to March 31.

    Given:
    - Compliance year: 2025
    - Previous assessed report exists for 2024

    Expected:
    - Transaction period: Apr 1, 2025 to Mar 31, 2026
    - This avoids overlap with 2024 report (which covered Jan 1, 2024 - Mar 31, 2025)
    """
    compliance_year = 2025
    organization_id = 100

    # Mock: Previous assessed report exists
    mock_prev_report = MagicMock()
    mock_service.cr_repo.get_assessed_compliance_report_by_period = AsyncMock(
        return_value=mock_prev_report
    )

    # Call the helper method
    start_date, end_date = await mock_service._calculate_transaction_period_dates(
        compliance_year, organization_id, exclude_report_id=2
    )

    # Verify dates
    assert start_date == datetime(2025, 4, 1, 0, 0, 0), "Subsequent report should start on April 1"
    assert end_date == datetime(2026, 3, 31, 23, 59, 59), "Subsequent report should end on March 31 of following year"

    # Verify the previous report check was made
    mock_service.cr_repo.get_assessed_compliance_report_by_period.assert_called_once_with(
        organization_id, 2024, 2
    )


@pytest.mark.anyio
async def test_no_overlap_between_first_and_second_report(mock_service):
    """
    Test that there's no overlap in transfer date ranges between first and second reports.

    Scenario:
    - 2024 report (first): Jan 1, 2024 - Mar 31, 2025
    - 2025 report (second): Apr 1, 2025 - Mar 31, 2026

    Verify:
    - No date is included in both ranges
    - Transfer on Mar 31, 2025 included only in 2024 report
    - Transfer on Apr 1, 2025 included only in 2025 report
    """
    organization_id = 100

    # Calculate 2024 report dates (first report - no previous)
    mock_service.cr_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=None)
    start_2024, end_2024 = await mock_service._calculate_transaction_period_dates(
        2024, organization_id, exclude_report_id=1
    )

    # Calculate 2025 report dates (subsequent report - has previous)
    mock_prev_report = MagicMock()
    mock_service.cr_repo.get_assessed_compliance_report_by_period = AsyncMock(
        return_value=mock_prev_report
    )
    start_2025, end_2025 = await mock_service._calculate_transaction_period_dates(
        2025, organization_id, exclude_report_id=2
    )

    # Verify no overlap: 2024 ends before 2025 starts
    assert end_2024 < start_2025, (
        f"2024 period ({start_2024} to {end_2024}) should not overlap with "
        f"2025 period ({start_2025} to {end_2025})"
    )

    # Specific date checks
    mar_31_2025 = datetime(2025, 3, 31, 23, 59, 59)
    apr_1_2025 = datetime(2025, 4, 1, 0, 0, 0)

    # March 31, 2025 is in 2024 range
    assert start_2024 <= mar_31_2025 <= end_2024, "March 31, 2025 should be in 2024 report"
    assert not (start_2025 <= mar_31_2025 <= end_2025), "March 31, 2025 should NOT be in 2025 report"

    # April 1, 2025 is in 2025 range
    assert not (start_2024 <= apr_1_2025 <= end_2024), "April 1, 2025 should NOT be in 2024 report"
    assert start_2025 <= apr_1_2025 <= end_2025, "April 1, 2025 should be in 2025 report"


@pytest.mark.anyio
async def test_calculate_low_carbon_uses_correct_transaction_dates_first_report(mock_service):
    """
    Test that calculate_low_carbon_fuel_target_summary uses correct transaction dates for first report.

    Verify:
    - Line 12 (transferred out) uses Jan 1 - Mar 31 date range
    - Line 13 (received) uses Jan 1 - Mar 31 date range
    """
    # Setup mocks
    mock_report = create_mock_compliance_report(2024, report_id=1)

    # No previous assessed report (first report)
    mock_service.cr_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=None)

    # Mock repository methods
    mock_service.repo.get_transferred_out_compliance_units = AsyncMock(return_value=5000)
    mock_service.repo.get_received_compliance_units = AsyncMock(return_value=3000)
    mock_service.repo.get_issued_compliance_units = AsyncMock(return_value=2000)
    mock_service.trxn_repo.calculate_line_17_available_balance_for_period = AsyncMock(return_value=10000)
    mock_service.calculate_fuel_supply_compliance_units = AsyncMock(return_value=8000)
    mock_service.calculate_fuel_export_compliance_units = AsyncMock(return_value=1000)

    # Call the method
    compliance_period_start = datetime(2024, 1, 1)
    compliance_period_end = datetime(2024, 12, 31)

    await mock_service.calculate_low_carbon_fuel_target_summary(
        compliance_period_start,
        compliance_period_end,
        100,  # organization_id
        mock_report,
    )

    # Verify Line 12 and Line 13 were called with correct transaction dates
    expected_start = datetime(2024, 1, 1, 0, 0, 0)
    expected_end = datetime(2025, 3, 31, 23, 59, 59)

    mock_service.repo.get_transferred_out_compliance_units.assert_called_once_with(
        expected_start, expected_end, 100
    )
    mock_service.repo.get_received_compliance_units.assert_called_once_with(
        expected_start, expected_end, 100
    )


@pytest.mark.anyio
async def test_calculate_low_carbon_uses_correct_transaction_dates_subsequent_report(mock_service):
    """
    Test that calculate_low_carbon_fuel_target_summary uses correct transaction dates for subsequent report.

    Verify:
    - Line 12 (transferred out) uses Apr 1 - Mar 31 date range
    - Line 13 (received) uses Apr 1 - Mar 31 date range
    """
    # Setup mocks
    mock_report = create_mock_compliance_report(2025, report_id=2)

    # Previous assessed report exists (subsequent report)
    mock_prev_report = MagicMock()
    mock_prev_report.summary = MagicMock()
    mock_prev_report.summary.line_18_units_to_be_banked = 1000
    mock_prev_report.summary.line_19_units_to_be_exported = 500
    mock_service.cr_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=mock_prev_report)

    # Mock repository methods
    mock_service.repo.get_transferred_out_compliance_units = AsyncMock(return_value=7000)
    mock_service.repo.get_received_compliance_units = AsyncMock(return_value=4000)
    mock_service.repo.get_issued_compliance_units = AsyncMock(return_value=3000)
    mock_service.trxn_repo.calculate_line_17_available_balance_for_period = AsyncMock(return_value=12000)
    mock_service.calculate_fuel_supply_compliance_units = AsyncMock(return_value=9000)
    mock_service.calculate_fuel_export_compliance_units = AsyncMock(return_value=2000)

    # Call the method
    compliance_period_start = datetime(2025, 1, 1)
    compliance_period_end = datetime(2025, 12, 31)

    await mock_service.calculate_low_carbon_fuel_target_summary(
        compliance_period_start,
        compliance_period_end,
        100,  # organization_id
        mock_report,
    )

    # Verify Line 12 and Line 13 were called with correct transaction dates (Apr 1 - Mar 31)
    expected_start = datetime(2025, 4, 1, 0, 0, 0)
    expected_end = datetime(2026, 3, 31, 23, 59, 59)

    # The method should be called TWICE:
    # 1. First call to check for previous year's report (2024)
    # 2. Second call inside calculate_low_carbon_fuel_target_summary for current year (2025)
    assert mock_service.cr_repo.get_assessed_compliance_report_by_period.call_count >= 2

    mock_service.repo.get_transferred_out_compliance_units.assert_called_once_with(
        expected_start, expected_end, 100
    )
    mock_service.repo.get_received_compliance_units.assert_called_once_with(
        expected_start, expected_end, 100
    )


@pytest.mark.anyio
async def test_edge_case_exactly_on_march_31_boundary(mock_service):
    """
    Test transfers that occur exactly on March 31 boundary are handled correctly.

    The end date is set to 23:59:59 on March 31, so transfers on March 31
    should be included in the first report.
    """
    compliance_year = 2024
    organization_id = 100

    # First report (no previous)
    mock_service.cr_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=None)

    start_date, end_date = await mock_service._calculate_transaction_period_dates(
        compliance_year, organization_id
    )

    # Verify March 31, 2025 23:59:59 is included
    march_31_end_of_day = datetime(2025, 3, 31, 23, 59, 59)
    assert start_date <= march_31_end_of_day <= end_date, (
        "Transfer on March 31 at 23:59:59 should be included in the report"
    )

    # Verify April 1, 2025 00:00:00 is excluded
    april_1_start_of_day = datetime(2025, 4, 1, 0, 0, 0)
    assert not (start_date <= april_1_start_of_day <= end_date), (
        "Transfer on April 1 at 00:00:00 should NOT be included in the report"
    )


@pytest.mark.anyio
async def test_edge_case_exactly_on_april_1_boundary(mock_service):
    """
    Test transfers that occur exactly on April 1 boundary are handled correctly.

    The start date for subsequent reports is 00:00:00 on April 1, so transfers
    on April 1 should be included in the subsequent report.
    """
    compliance_year = 2025
    organization_id = 100

    # Subsequent report (has previous)
    mock_prev_report = MagicMock()
    mock_service.cr_repo.get_assessed_compliance_report_by_period = AsyncMock(
        return_value=mock_prev_report
    )

    start_date, end_date = await mock_service._calculate_transaction_period_dates(
        compliance_year, organization_id
    )

    # Verify April 1, 2025 00:00:00 is included
    april_1_start_of_day = datetime(2025, 4, 1, 0, 0, 0)
    assert start_date <= april_1_start_of_day <= end_date, (
        "Transfer on April 1 at 00:00:00 should be included in subsequent report"
    )

    # Verify March 31, 2025 23:59:59 is excluded
    march_31_end_of_day = datetime(2025, 3, 31, 23, 59, 59)
    assert not (start_date <= march_31_end_of_day <= end_date), (
        "Transfer on March 31 at 23:59:59 should NOT be included in subsequent report"
    )
