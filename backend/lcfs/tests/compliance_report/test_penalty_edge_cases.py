"""
Comprehensive tests for penalty calculation edge cases and report chain scenarios.
These tests cover gaps identified in the LCFS Report Chain Assessment.
"""

import pytest
from datetime import datetime
from typing import List
from unittest.mock import AsyncMock, MagicMock, Mock
from decimal import Decimal

from lcfs.db.models import ComplianceReport
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.web.api.compliance_report.schema import ComplianceReportSummaryRowSchema


def _get_line_values(summary: List[ComplianceReportSummaryRowSchema]) -> dict:
    """Helper to map summary rows' line numbers to their values."""
    return {item.line: item.value for item in summary}


@pytest.mark.anyio
class TestPenaltyCalculationFix:
    """Test the penalty calculation fix that prevents double-counting of current period units."""
    
    async def test_penalty_calculation_with_previously_assessed_units(
        self,
        compliance_report_summary_service,
        mock_trxn_repo,
        mock_summary_repo,
        mock_repo
    ):
        """
        Test that penalty calculation correctly accounts for previously assessed compliance units.
        
        This test verifies the fix for the bug where penalty calculation was double-counting
        current period compliance units instead of using the net balance change.
        
        Scenario from the bug report:
        - Line 17 (available balance): 48,833 units
        - Line 18 (current period supply units): -116,729 units  
        - Line 19 (current period export units): 0 units
        - Line 15 (previously assessed supply): -1,167 units
        - Line 16 (previously assessed export): 0 units
        - Line 20 (balance change): -115,562 units
        
        Expected penalty: (48,833 + (-115,562)) × 600 = 66,729 × 600 = $40,037,400
        Bug was calculating: (48,833 + (-116,729) + 0) × 600 = 67,896 × 600 = $40,737,600
        """
        compliance_period_start = datetime(2024, 1, 1)
        compliance_period_end = datetime(2024, 12, 31)
        organization_id = 1
        
        # Setup supplemental report (version > 0)
        compliance_report = MagicMock(spec=ComplianceReport)
        compliance_report.version = 1  # Supplemental report
        compliance_report.organization_id = organization_id
        compliance_report.compliance_period = MagicMock(
            effective_date=compliance_period_start,
            expiration_date=compliance_period_end,
            description="2024",
        )
        
        # Setup summary to trigger Line 17 calculation
        mock_summary = MagicMock(spec=ComplianceReportSummary)
        mock_summary.line_17_non_banked_units_used = None  # Force calculation
        mock_summary.is_locked = False
        compliance_report.summary = mock_summary
        
        # Repository returns - current period data
        mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
        mock_summary_repo.get_received_compliance_units.return_value = 0  
        mock_summary_repo.get_issued_compliance_units.return_value = 0
        
        # Mock assessed report for previously assessed units (Line 15/16)
        mock_assessed_report = MagicMock()
        mock_assessed_summary = MagicMock()
        mock_assessed_summary.line_18_units_to_be_banked = -1167  # Previously assessed supply
        mock_assessed_summary.line_19_units_to_be_exported = 0    # Previously assessed export  
        mock_assessed_report.summary = mock_assessed_summary
        mock_repo.get_assessed_compliance_report_by_period.return_value = mock_assessed_report
        
        # Previous summary for supplemental (should match assessed values)
        previous_summary_mock = MagicMock(spec=ComplianceReportSummary)
        previous_summary_mock.line_18_units_to_be_banked = -1167
        previous_summary_mock.line_19_units_to_be_exported = 0
        mock_summary_repo.get_previous_summary = AsyncMock(return_value=previous_summary_mock)
        
        # Line 17 available balance for period  
        mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 48833
        
        # Current period compliance units
        compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(
            return_value=-116729  # Large negative units from fossil fuel
        )
        compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(
            return_value=0
        )
        
        # Call the method
        summary, penalty = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )
        
        # Verify the summary values
        line_values = _get_line_values(summary)
        
        # Check individual line calculations
        assert line_values[15] == -1167  # Previously assessed supply units
        assert line_values[16] == 0      # Previously assessed export units
        assert line_values[17] == 48833  # Available balance for period
        assert line_values[18] == -116729 # Current period supply units
        assert line_values[19] == 0       # Current period export units
        
        # Line 20 = line 18 + line 19 - line 15 - line 16
        # Line 20 = -116729 + 0 - (-1167) - 0 = -115562
        expected_line_20 = -116729 + 0 - (-1167) - 0
        assert line_values[20] == expected_line_20
        assert line_values[20] == -115562  # Balance change from assessment
        
        # Penalty calculation - this is the key test
        # Should be: available_balance + balance_change = 48833 + (-115562) = -66729
        # Penalty units (negative) = -66729
        # Penalty amount = 66729 × 600 = $40,037,400
        expected_penalty_units = 48833 + (-115562)
        assert expected_penalty_units == -66729
        
        # Verify the penalty object returned (should be the negative penalty units)
        assert penalty == -66729  # Penalty units (negative indicates deficit)
        
        # The penalty should be calculated correctly (not the buggy double-counting)
        expected_penalty_amount = 66729 * 600
        assert expected_penalty_amount == 40037400
        assert line_values[21] == 40037400  # Line 21 is the penalty amount in dollars
        
        # Line 22 = max(line 17 + line 20, 0) = max(48833 + (-115562), 0) = max(-66729, 0) = 0
        # The system prevents negative available balances by flooring at 0
        assert line_values[22] == 0  # Cannot go below zero
        
        # Verify penalty calculation used the correct logic
        # The penalty calculation itself happens in calculate_non_compliance_penalty_summary
        # but we can verify the penalty units calculation is correct
        

    async def test_penalty_calculation_original_report_no_previous_assessment(
        self,
        compliance_report_summary_service,
        mock_trxn_repo,
        mock_summary_repo,
        mock_repo
    ):
        """
        Test penalty calculation for original report (version 0) with no previous assessments.
        
        This ensures the fix doesn't break the normal case where there are no previously
        assessed compliance units.
        """
        compliance_period_start = datetime(2024, 1, 1)
        compliance_period_end = datetime(2024, 12, 31)
        organization_id = 1
        
        # Setup original report (version 0)
        compliance_report = MagicMock(spec=ComplianceReport)
        compliance_report.version = 0  # Original report
        compliance_report.organization_id = organization_id
        
        # Setup summary  
        mock_summary = MagicMock(spec=ComplianceReportSummary)
        mock_summary.line_17_non_banked_units_used = None
        mock_summary.is_locked = False
        compliance_report.summary = mock_summary
        
        # Repository returns
        mock_summary_repo.get_transferred_out_compliance_units.return_value = 1000
        mock_summary_repo.get_received_compliance_units.return_value = 500
        mock_summary_repo.get_issued_compliance_units.return_value = 200
        
        # No assessed report for original version
        mock_repo.get_assessed_compliance_report_by_period.return_value = None
        
        # Available balance
        mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 5000
        
        # Current period compliance units  
        compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(
            return_value=-3000  # Negative units
        )
        compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(
            return_value=-500
        )
        
        # Call the method
        summary, penalty = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )
        
        # Verify the summary values
        line_values = _get_line_values(summary)
        
        # For original report, no previously assessed units
        assert line_values[15] == 0   # No previously assessed supply units
        assert line_values[16] == 0   # No previously assessed export units
        assert line_values[17] == 5000  # Available balance for period
        assert line_values[18] == -3000  # Current period supply units
        assert line_values[19] == -500   # Current period export units
        
        # Line 20 = line 18 + line 19 - line 15 - line 16 = -3000 + (-500) - 0 - 0 = -3500
        assert line_values[20] == -3500
        
        # For original report: calculated_penalty_units = available_balance + balance_change
        # = 5000 + (-3500) = 1500 (positive, so no penalty)
        assert line_values[22] == 5000 + (-3500)  # Line 22 should be 1500
        

    async def test_penalty_calculation_edge_case_zero_balance(
        self,
        compliance_report_summary_service,
        mock_trxn_repo,
        mock_summary_repo,
        mock_repo
    ):
        """
        Test penalty calculation when available balance exactly cancels out deficit.
        """
        compliance_period_start = datetime(2024, 1, 1)
        compliance_period_end = datetime(2024, 12, 31)
        organization_id = 1
        
        compliance_report = MagicMock(spec=ComplianceReport)
        compliance_report.version = 1  # Supplemental
        
        mock_summary = MagicMock(spec=ComplianceReportSummary)
        mock_summary.line_17_non_banked_units_used = None
        mock_summary.is_locked = False
        compliance_report.summary = mock_summary
        
        # Repository setup
        mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
        mock_summary_repo.get_received_compliance_units.return_value = 0
        mock_summary_repo.get_issued_compliance_units.return_value = 0
        
        # Previously assessed units
        mock_assessed_report = MagicMock()
        mock_assessed_summary = MagicMock()
        mock_assessed_summary.line_18_units_to_be_banked = -500
        mock_assessed_summary.line_19_units_to_be_exported = 0
        mock_assessed_report.summary = mock_assessed_summary
        mock_repo.get_assessed_compliance_report_by_period.return_value = mock_assessed_report
        
        previous_summary_mock = MagicMock(spec=ComplianceReportSummary)
        previous_summary_mock.line_18_units_to_be_banked = -500
        previous_summary_mock.line_19_units_to_be_exported = 0
        mock_summary_repo.get_previous_summary = AsyncMock(return_value=previous_summary_mock)
        
        # Set up scenario where balance exactly cancels deficit
        mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 1000
        
        compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(
            return_value=-1500  # This creates a deficit
        )
        compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(
            return_value=0
        )
        
        # Call the method
        summary, penalty = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )
        
        line_values = _get_line_values(summary)
        
        # Line 20 = -1500 + 0 - (-500) - 0 = -1000 (balance change)
        assert line_values[20] == -1000
        
        # Penalty calculation: 1000 + (-1000) = 0 (exactly zero, no penalty)
        expected_final_balance = 1000 + (-1000)
        assert expected_final_balance == 0
        assert line_values[22] == 0  # No penalty since balance is zero


@pytest.mark.anyio
class TestMultiLevelSupplementalChains:
    """Test complex multi-level supplemental report chains."""
    
    async def test_three_level_supplemental_chain(
        self,
        compliance_report_summary_service,
        mock_trxn_repo,
        mock_summary_repo,
        mock_repo
    ):
        """
        Test penalty calculation through a three-level supplemental chain:
        v0 (original) → v1 (supplemental) → v2 (supplemental)
        
        Verifies that each level correctly inherits from the previous assessed report
        and that penalty calculations accumulate correctly.
        """
        compliance_period_start = datetime(2024, 1, 1)
        compliance_period_end = datetime(2024, 12, 31)
        organization_id = 1
        
        # Setup v2 supplemental report (third in chain)
        compliance_report_v2 = MagicMock(spec=ComplianceReport)
        compliance_report_v2.version = 2
        compliance_report_v2.organization_id = organization_id
        compliance_report_v2.compliance_period = MagicMock(
            effective_date=compliance_period_start,
            expiration_date=compliance_period_end,
            description="2024",
        )
        
        mock_summary_v2 = MagicMock(spec=ComplianceReportSummary)
        mock_summary_v2.line_17_non_banked_units_used = None
        mock_summary_v2.is_locked = False
        compliance_report_v2.summary = mock_summary_v2
        
        # Repository returns
        mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
        mock_summary_repo.get_received_compliance_units.return_value = 0
        mock_summary_repo.get_issued_compliance_units.return_value = 0
        
        # Mock the assessed report (should be v1, the most recent assessed)
        mock_assessed_report_v1 = MagicMock()
        mock_assessed_summary_v1 = MagicMock()
        # v1 had accumulated penalties from v0 assessment
        mock_assessed_summary_v1.line_18_units_to_be_banked = -2000  # Cumulative from v0→v1
        mock_assessed_summary_v1.line_19_units_to_be_exported = -100
        mock_assessed_report_v1.summary = mock_assessed_summary_v1
        mock_repo.get_assessed_compliance_report_by_period.return_value = mock_assessed_report_v1
        
        # Previous summary (v1) for supplemental inheritance
        previous_summary_v1 = MagicMock(spec=ComplianceReportSummary)
        previous_summary_v1.line_18_units_to_be_banked = -2000
        previous_summary_v1.line_19_units_to_be_exported = -100
        mock_summary_repo.get_previous_summary = AsyncMock(return_value=previous_summary_v1)
        
        # Available balance (should reflect state after v1 assessment)
        mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 3000
        
        # v2 introduces additional deficit
        compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(
            return_value=-1800  # Additional deficit in v2
        )
        compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(
            return_value=-50   # Additional export deficit
        )
        
        # Call the method
        summary, penalty = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report_v2,
        )
        
        line_values = _get_line_values(summary)
        
        # Verify inheritance from v1 assessed state
        assert line_values[15] == -2000  # Previously assessed supply (from v1)
        assert line_values[16] == -100   # Previously assessed export (from v1)
        assert line_values[17] == 3000   # Available balance after v1
        assert line_values[18] == -1800  # Current period supply (v2)
        assert line_values[19] == -50    # Current period export (v2)
        
        # Line 20 = line 18 + line 19 - line 15 - line 16
        # = -1800 + (-50) - (-2000) - (-100) = -1850 + 2100 = 250
        expected_line_20 = -1800 + (-50) - (-2000) - (-100)
        assert expected_line_20 == 250
        assert line_values[20] == 250
        
        # Final balance: 3000 + 250 = 3250 (positive, no penalty)
        assert line_values[22] == 3250

    async def test_supplemental_chain_with_increasing_deficit(
        self,
        compliance_report_summary_service,
        mock_trxn_repo,
        mock_summary_repo,
        mock_repo
    ):
        """
        Test a supplemental chain where each level increases the deficit.
        Ensures penalty calculation handles cumulative negative balances correctly.
        """
        compliance_period_start = datetime(2024, 1, 1)
        compliance_period_end = datetime(2024, 12, 31)
        organization_id = 1
        
        # Setup v1 supplemental with increasing deficit
        compliance_report_v1 = MagicMock(spec=ComplianceReport)
        compliance_report_v1.version = 1
        
        mock_summary_v1 = MagicMock(spec=ComplianceReportSummary)
        mock_summary_v1.line_17_non_banked_units_used = None
        mock_summary_v1.is_locked = False
        compliance_report_v1.summary = mock_summary_v1
        
        # Repository setup
        mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
        mock_summary_repo.get_received_compliance_units.return_value = 0
        mock_summary_repo.get_issued_compliance_units.return_value = 0
        
        # v0 was assessed with some deficit
        mock_assessed_report_v0 = MagicMock()
        mock_assessed_summary_v0 = MagicMock()
        mock_assessed_summary_v0.line_18_units_to_be_banked = -5000  # Original deficit
        mock_assessed_summary_v0.line_19_units_to_be_exported = 0
        mock_assessed_report_v0.summary = mock_assessed_summary_v0
        mock_repo.get_assessed_compliance_report_by_period.return_value = mock_assessed_report_v0
        
        previous_summary_v0 = MagicMock(spec=ComplianceReportSummary)
        previous_summary_v0.line_18_units_to_be_banked = -5000
        previous_summary_v0.line_19_units_to_be_exported = 0
        mock_summary_repo.get_previous_summary = AsyncMock(return_value=previous_summary_v0)
        
        # Limited available balance
        mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 2000
        
        # v1 adds more deficit
        compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(
            return_value=-8000  # Large additional deficit
        )
        compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(
            return_value=0
        )
        
        # Call the method
        summary, penalty = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report_v1,
        )
        
        line_values = _get_line_values(summary)
        
        # Verify values
        assert line_values[15] == -5000  # Previously assessed (v0)
        assert line_values[17] == 2000   # Available balance
        assert line_values[18] == -8000  # Current deficit (v1)
        
        # Line 20 = -8000 + 0 - (-5000) - 0 = -3000 (net change from v0 to v1)
        assert line_values[20] == -3000
        
        # Final balance calculation: 2000 + (-3000) = -1000 (deficit)
        # But Line 22 = max(2000 + (-3000), 0) = max(-1000, 0) = 0
        assert line_values[22] == 0  # System floors negative balances at 0
        
        # Penalty should be calculated on the deficit: 1000 × 600 = $600,000
        expected_penalty_units = 2000 + (-3000)  # -1000 (deficit)
        assert expected_penalty_units == -1000
        expected_penalty_amount = 1000 * 600
        assert line_values[21] == expected_penalty_amount  # $600,000


@pytest.mark.anyio  
class TestGovernmentAdjustmentWorkflows:
    """Test government adjustment and government-initiated supplemental workflows."""
    
    async def test_government_adjustment_summary_calculation(
        self,
        compliance_report_summary_service,
        mock_trxn_repo,
        mock_summary_repo,
        mock_repo
    ):
        """
        Test summary calculation for government analyst adjustment reports.
        
        Government adjustments start with empty summary (no inheritance) and
        return to "Analyst adjustment" status instead of "Submitted".
        """
        compliance_period_start = datetime(2024, 1, 1)
        compliance_period_end = datetime(2024, 12, 31)
        organization_id = 1
        
        # Setup government adjustment report
        gov_adjustment_report = MagicMock(spec=ComplianceReport)
        gov_adjustment_report.version = 1
        gov_adjustment_report.organization_id = organization_id
        gov_adjustment_report.supplemental_initiator = "GOVERNMENT_REASSESSMENT"
        
        # Government adjustments start with empty summary
        mock_summary = MagicMock(spec=ComplianceReportSummary)
        mock_summary.line_17_non_banked_units_used = None
        mock_summary.is_locked = False
        gov_adjustment_report.summary = mock_summary
        
        # Repository setup
        mock_summary_repo.get_transferred_out_compliance_units.return_value = 100
        mock_summary_repo.get_received_compliance_units.return_value = 200
        mock_summary_repo.get_issued_compliance_units.return_value = 50
        
        # For government adjustments, get_assessed_compliance_report_by_period should return
        # the original assessed report to get baseline previously assessed values
        mock_assessed_report_v0 = MagicMock()
        mock_assessed_summary_v0 = MagicMock()
        mock_assessed_summary_v0.line_18_units_to_be_banked = -1000
        mock_assessed_summary_v0.line_19_units_to_be_exported = -50
        mock_assessed_report_v0.summary = mock_assessed_summary_v0
        mock_repo.get_assessed_compliance_report_by_period.return_value = mock_assessed_report_v0
        
        # For government adjustments (version > 0), get_previous_summary is called
        previous_summary = MagicMock(spec=ComplianceReportSummary)
        previous_summary.line_18_units_to_be_banked = -1000
        previous_summary.line_19_units_to_be_exported = -50
        mock_summary_repo.get_previous_summary = AsyncMock(return_value=previous_summary)
        
        # Available balance
        mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 1500
        
        # Government analyst adjusts the compliance units (correcting errors)
        compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(
            return_value=-800  # Analyst correction - less deficit than original
        )
        compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(
            return_value=-25   # Analyst correction
        )
        
        # Call the method
        summary, penalty = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            gov_adjustment_report,
        )
        
        line_values = _get_line_values(summary)
        
        # Verify government adjustment calculations
        assert line_values[12] == 100    # Transferred out
        assert line_values[13] == 200    # Received  
        assert line_values[14] == 50     # Issued
        assert line_values[15] == -1000  # Previously assessed supply (from original)
        assert line_values[16] == -50    # Previously assessed export (from original)
        assert line_values[17] == 1500   # Available balance
        assert line_values[18] == -800   # Current period supply (analyst adjusted)
        assert line_values[19] == -25    # Current period export (analyst adjusted)
        
        # Line 20 = -800 + (-25) - (-1000) - (-50) = -825 + 1050 = 225
        expected_line_20 = -800 + (-25) - (-1000) - (-50)
        assert expected_line_20 == 225
        assert line_values[20] == 225
        
        # Final balance: 1500 + 225 = 1725 (positive, reduced penalty)
        assert line_values[22] == 1725

    async def test_government_initiated_supplemental_inheritance(
        self,
        compliance_report_summary_service,
        mock_trxn_repo,
        mock_summary_repo,
        mock_repo
    ):
        """
        Test summary calculation for government-initiated supplemental that supplier then edits.
        
        These should inherit summary data like normal supplementals but track the government
        initiation for audit purposes.
        """
        compliance_period_start = datetime(2024, 1, 1)
        compliance_period_end = datetime(2024, 12, 31)
        organization_id = 1
        
        # Setup government-initiated supplemental (supplier is now editing)
        gov_initiated_report = MagicMock(spec=ComplianceReport)
        gov_initiated_report.version = 1
        gov_initiated_report.organization_id = organization_id
        gov_initiated_report.supplemental_initiator = "GOVERNMENT_TRANSFER"  # Gov initiated but supplier edits
        
        mock_summary = MagicMock(spec=ComplianceReportSummary)
        mock_summary.line_17_non_banked_units_used = None
        mock_summary.is_locked = False
        gov_initiated_report.summary = mock_summary
        
        # Repository setup
        mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
        mock_summary_repo.get_received_compliance_units.return_value = 0
        mock_summary_repo.get_issued_compliance_units.return_value = 0
        
        # Assessed parent report to inherit from
        mock_assessed_report = MagicMock()
        mock_assessed_summary = MagicMock()
        mock_assessed_summary.line_18_units_to_be_banked = -2500
        mock_assessed_summary.line_19_units_to_be_exported = -100
        mock_assessed_report.summary = mock_assessed_summary
        mock_repo.get_assessed_compliance_report_by_period.return_value = mock_assessed_report
        
        previous_summary = MagicMock(spec=ComplianceReportSummary)
        previous_summary.line_18_units_to_be_banked = -2500
        previous_summary.line_19_units_to_be_exported = -100
        mock_summary_repo.get_previous_summary = AsyncMock(return_value=previous_summary)
        
        # Available balance
        mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 2000
        
        # Supplier makes changes in the government-initiated supplemental
        compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(
            return_value=-3000  # Supplier adds more deficit
        )
        compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(
            return_value=-150
        )
        
        # Call the method
        summary, penalty = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            gov_initiated_report,
        )
        
        line_values = _get_line_values(summary)
        
        # Should behave like normal supplemental (inherits from assessed parent)
        assert line_values[15] == -2500  # Previously assessed supply
        assert line_values[16] == -100   # Previously assessed export
        assert line_values[17] == 2000   # Available balance
        assert line_values[18] == -3000  # Current period supply (supplier change)
        assert line_values[19] == -150   # Current period export (supplier change)
        
        # Line 20 = -3000 + (-150) - (-2500) - (-100) = -3150 + 2600 = -550
        assert line_values[20] == -550
        
        # Final balance: 2000 + (-550) = 1450 (positive)
        assert line_values[22] == 1450


@pytest.mark.anyio
class TestDecimalPrecisionEdgeCases:
    """Test decimal precision handling in penalty calculations."""
    
    async def test_large_value_decimal_precision(
        self,
        compliance_report_summary_service,
        mock_trxn_repo,
        mock_summary_repo,
        mock_repo
    ):
        """
        Test penalty calculation with very large values to check decimal precision.
        """
        compliance_period_start = datetime(2024, 1, 1)
        compliance_period_end = datetime(2024, 12, 31)
        organization_id = 1
        
        compliance_report = MagicMock(spec=ComplianceReport)
        compliance_report.version = 0
        
        mock_summary = MagicMock(spec=ComplianceReportSummary)
        mock_summary.line_17_non_banked_units_used = None
        mock_summary.is_locked = False
        compliance_report.summary = mock_summary
        
        # Repository setup with large values
        mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
        mock_summary_repo.get_received_compliance_units.return_value = 0
        mock_summary_repo.get_issued_compliance_units.return_value = 0
        
        # No assessed report for original
        mock_repo.get_assessed_compliance_report_by_period.return_value = None
        
        # Very large available balance
        mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 999999999
        
        # Very large deficit that should cause precision issues with float arithmetic
        compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(
            return_value=-1000000123  # Large negative value
        )
        compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(
            return_value=-456789  # Another large negative value
        )
        
        # Call the method
        summary, penalty = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )
        
        line_values = _get_line_values(summary)
        
        # Verify large value calculations are handled correctly
        assert line_values[17] == 999999999
        assert line_values[18] == -1000000123
        assert line_values[19] == -456789
        
        # Line 20 = -1000000123 + (-456789) - 0 - 0 = -1000456912
        expected_line_20 = -1000000123 + (-456789)
        assert line_values[20] == expected_line_20
        assert line_values[20] == -1000456912
        
        # Final calculation: 999999999 + (-1000456912) = -456913 (deficit)
        expected_final = 999999999 + (-1000456912)
        assert expected_final == -456913
        # But Line 22 = max(999999999 + (-1000456912), 0) = max(-456913, 0) = 0
        assert line_values[22] == 0  # System floors negative balances at 0
        
        # Penalty should be calculated on the deficit: 456913 × 600 = $274,147,800
        expected_penalty = 456913 * 600
        assert expected_penalty == 274147800
        assert line_values[21] == expected_penalty  # Penalty amount in dollars

    async def test_fractional_compliance_units_rounding(
        self,
        compliance_report_summary_service,
        mock_trxn_repo,
        mock_summary_repo,
        mock_repo
    ):
        """
        Test handling of fractional compliance units and proper rounding.
        """
        compliance_period_start = datetime(2024, 1, 1)
        compliance_period_end = datetime(2024, 12, 31)
        organization_id = 1
        
        compliance_report = MagicMock(spec=ComplianceReport)
        compliance_report.version = 0
        
        mock_summary = MagicMock(spec=ComplianceReportSummary)
        mock_summary.line_17_non_banked_units_used = None
        mock_summary.is_locked = False
        compliance_report.summary = mock_summary
        
        # Repository setup
        mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
        mock_summary_repo.get_received_compliance_units.return_value = 0
        mock_summary_repo.get_issued_compliance_units.return_value = 0
        
        mock_repo.get_assessed_compliance_report_by_period.return_value = None
        
        # Available balance with fractional part
        mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 1000
        
        # Compliance units with fractional values (should be handled as Decimal)
        compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(
            return_value=-1234.567  # Fractional compliance units
        )
        compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(
            return_value=-89.123
        )
        
        # Call the method
        summary, penalty = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )
        
        line_values = _get_line_values(summary)
        
        # The system should handle fractional values appropriately
        # Note: The int() conversion in the penalty calculation truncates, not rounds
        assert line_values[18] == -1234.567
        assert line_values[19] == -89.123
        
        # Line 20 calculation with fractional values
        expected_line_20 = -1234.567 + (-89.123)
        assert abs(line_values[20] - expected_line_20) < 0.001  # Allow for floating point precision
        assert abs(line_values[20] - (-1323.69)) < 0.001
        
        # Final balance calculation: 1000 + (-1323.69) = -323.69 (deficit)
        expected_final = 1000 + expected_line_20  # Should be negative
        assert expected_final < 0  # Confirm it's negative
        # But Line 22 = max(1000 + (-1323.69), 0) = max(-323.69, 0) = 0
        assert line_values[22] == 0  # System floors negative balances at 0


@pytest.mark.anyio
class TestReportChainIntegrityValidation:
    """Test validation of report chain integrity and data consistency."""
    
    async def test_broken_chain_missing_assessed_parent(
        self,
        compliance_report_summary_service,
        mock_trxn_repo,
        mock_summary_repo,
        mock_repo
    ):
        """
        Test handling when a supplemental report's assessed parent is missing or corrupted.
        """
        compliance_period_start = datetime(2024, 1, 1)
        compliance_period_end = datetime(2024, 12, 31)
        organization_id = 1
        
        # Setup supplemental report
        compliance_report = MagicMock(spec=ComplianceReport)
        compliance_report.version = 1  # Supplemental
        
        mock_summary = MagicMock(spec=ComplianceReportSummary)
        mock_summary.line_17_non_banked_units_used = None
        mock_summary.is_locked = False
        compliance_report.summary = mock_summary
        
        # Repository setup
        mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
        mock_summary_repo.get_received_compliance_units.return_value = 0
        mock_summary_repo.get_issued_compliance_units.return_value = 0
        
        # MISSING assessed parent - this should be handled gracefully
        mock_repo.get_assessed_compliance_report_by_period.return_value = None
        
        # But we still have a previous summary (inconsistent state)
        previous_summary = MagicMock(spec=ComplianceReportSummary)
        previous_summary.line_18_units_to_be_banked = 0  # Default values
        previous_summary.line_19_units_to_be_exported = 0
        mock_summary_repo.get_previous_summary = AsyncMock(return_value=previous_summary)
        
        mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 1000
        
        compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(
            return_value=-500
        )
        compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(
            return_value=0
        )
        
        # Call the method - should handle missing assessed parent gracefully
        summary, penalty = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )
        
        line_values = _get_line_values(summary)
        
        # Should default to 0 for previously assessed values when parent is missing
        assert line_values[15] == 0   # Previously assessed supply
        assert line_values[16] == 0   # Previously assessed export
        assert line_values[18] == -500  # Current period supply
        assert line_values[19] == 0     # Current period export
        
        # Line 20 = -500 + 0 - 0 - 0 = -500
        assert line_values[20] == -500
        
        # Final balance: 1000 + (-500) = 500
        assert line_values[22] == 500

    async def test_inconsistent_previous_summary_data(
        self,
        compliance_report_summary_service,
        mock_trxn_repo,
        mock_summary_repo,
        mock_repo
    ):
        """
        Test handling when previous summary data doesn't match assessed report data.
        """
        compliance_period_start = datetime(2024, 1, 1)
        compliance_period_end = datetime(2024, 12, 31)
        organization_id = 1
        
        compliance_report = MagicMock(spec=ComplianceReport)
        compliance_report.version = 1
        
        mock_summary = MagicMock(spec=ComplianceReportSummary)
        mock_summary.line_17_non_banked_units_used = None
        mock_summary.is_locked = False
        compliance_report.summary = mock_summary
        
        # Repository setup
        mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
        mock_summary_repo.get_received_compliance_units.return_value = 0
        mock_summary_repo.get_issued_compliance_units.return_value = 0
        
        # Assessed report has certain values
        mock_assessed_report = MagicMock()
        mock_assessed_summary = MagicMock()
        mock_assessed_summary.line_18_units_to_be_banked = -1000
        mock_assessed_summary.line_19_units_to_be_exported = -50
        mock_assessed_report.summary = mock_assessed_summary
        mock_repo.get_assessed_compliance_report_by_period.return_value = mock_assessed_report
        
        # But previous summary has DIFFERENT values (data inconsistency)
        previous_summary = MagicMock(spec=ComplianceReportSummary)
        previous_summary.line_18_units_to_be_banked = -1500  # DIFFERENT from assessed
        previous_summary.line_19_units_to_be_exported = -75   # DIFFERENT from assessed
        mock_summary_repo.get_previous_summary = AsyncMock(return_value=previous_summary)
        
        mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 2000
        
        compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(
            return_value=-800
        )
        compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(
            return_value=-25
        )
        
        # Call the method
        summary, penalty = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
        )
        
        line_values = _get_line_values(summary)
        
        # The system should use the ASSESSED report values for Lines 15/16, not previous_summary
        # This test documents correct behavior - the system uses assessed values for consistency
        assert line_values[15] == -1000  # From assessed report (correct source)
        assert line_values[16] == -50    # From assessed report (correct source)
        
        # Line 20 calculation uses assessed values, so:
        # Line 20 = -800 + (-25) - (-1000) - (-50) = -825 + 1050 = 225
        expected_line_20 = -800 + (-25) - (-1000) - (-50)
        assert expected_line_20 == 225
        assert line_values[20] == 225
        assert line_values[22] == 2000 + 225  # 2225 (positive, no penalty)


@pytest.mark.anyio 
class TestConcurrentModificationScenarios:
    """Test concurrent modification and race condition scenarios."""
    
    async def test_concurrent_summary_calculation_simulation(
        self,
        compliance_report_summary_service,
        mock_trxn_repo,
        mock_summary_repo,
        mock_repo
    ):
        """
        Simulate concurrent summary calculations to test for race conditions.
        
        Note: This test simulates the scenario but cannot test actual concurrency
        within pytest. It validates that the method is stateless and deterministic.
        """
        compliance_period_start = datetime(2024, 1, 1)
        compliance_period_end = datetime(2024, 12, 31)
        organization_id = 1
        
        # Setup identical reports for "concurrent" calculations
        compliance_report_1 = MagicMock(spec=ComplianceReport)
        compliance_report_1.version = 0
        compliance_report_1.organization_id = organization_id
        
        compliance_report_2 = MagicMock(spec=ComplianceReport) 
        compliance_report_2.version = 0
        compliance_report_2.organization_id = organization_id
        
        # Identical summaries
        mock_summary_1 = MagicMock(spec=ComplianceReportSummary)
        mock_summary_1.line_17_non_banked_units_used = None
        mock_summary_1.is_locked = False
        compliance_report_1.summary = mock_summary_1
        
        mock_summary_2 = MagicMock(spec=ComplianceReportSummary)
        mock_summary_2.line_17_non_banked_units_used = None
        mock_summary_2.is_locked = False
        compliance_report_2.summary = mock_summary_2
        
        # Setup identical repository responses
        mock_summary_repo.get_transferred_out_compliance_units.return_value = 100
        mock_summary_repo.get_received_compliance_units.return_value = 200
        mock_summary_repo.get_issued_compliance_units.return_value = 50
        
        mock_repo.get_assessed_compliance_report_by_period.return_value = None
        mock_trxn_repo.calculate_line_17_available_balance_for_period.return_value = 1500
        
        compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(
            return_value=-1000
        )
        compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(
            return_value=-50
        )
        
        # Call the method twice with identical inputs (simulating concurrency)
        summary_1, penalty_1 = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report_1,
        )
        
        summary_2, penalty_2 = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report_2,
        )
        
        # Verify both calculations produce identical results (deterministic)
        line_values_1 = _get_line_values(summary_1)
        line_values_2 = _get_line_values(summary_2)
        
        for line_num in line_values_1:
            assert line_values_1[line_num] == line_values_2[line_num], f"Line {line_num} differs between concurrent calculations"
        
        # Verify specific calculations are correct and identical
        assert line_values_1[20] == line_values_2[20] == -1050  # Line 20 calculation
        assert line_values_1[22] == line_values_2[22] == 450    # Final balance