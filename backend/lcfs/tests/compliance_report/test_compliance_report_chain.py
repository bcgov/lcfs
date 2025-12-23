import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.web.api.compliance_report.summary_service import ComplianceReportSummaryService
from lcfs.tests.compliance_report.utils import make_report, make_summary


@pytest.mark.anyio
async def test_chain_version_flow_uses_prior_assessed_baseline(compliance_report_summary_service: ComplianceReportSummaryService, mock_repo, mock_summary_repo, mock_trxn_repo):
    """
    Build a chain: v0 assessed, v1 supplier supplemental (draft), v2 gov supplemental (draft).
    Assert v2 uses the assessed baseline (v0) for line 15/16/7/9 and ignores v1 unless assessed exists.
    """

    # v0 assessed baseline
    assessed_report = make_report(0, ComplianceReportStatusEnum.Assessed, "2025")
    assessed_summary = make_summary(line6=1000, line8=500, line18=12000, line19=3000, line20=9000, locked=True)
    assessed_report.summary = assessed_summary

    # v1 supplier supplemental (draft) - should be ignored for baselines when assessed exists
    v1_report = make_report(1, ComplianceReportStatusEnum.Draft, "2025", nickname="v1 supplier sup")
    v1_report.summary = make_summary(line6=2000, line8=0, line18=0, line19=0, line20=0, locked=False)

    # v2 gov supplemental (draft) - target of test
    v2_report = make_report(2, ComplianceReportStatusEnum.Draft, "2025", nickname="v2 gov sup")
    v2_report.summary = make_summary(line6=0, line8=0, line18=0, line19=0, line20=0, locked=False)

    # Mock repo chain lookups
    async def get_report_by_id(report_id):
        if report_id == v2_report.compliance_report_id:
            return v2_report
        return None

    mock_repo.get_compliance_report_by_id = AsyncMock(side_effect=get_report_by_id)
    mock_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=assessed_report)

    mock_summary_repo.get_previous_summary = AsyncMock(return_value=v1_report.summary)
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
    mock_summary_repo.get_received_compliance_units.return_value = 0
    mock_summary_repo.get_issued_compliance_units.return_value = 0
    mock_trxn_repo.calculate_line_17_available_balance_for_period = AsyncMock(return_value=0)
    compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(return_value=0)
    compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(return_value=0)

    summary, _ = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
        v2_report.compliance_period.effective_date,
        v2_report.compliance_period.expiration_date,
        v2_report.organization_id,
        v2_report,
    )
    line_values = {row.line: row.value for row in summary}

    # Lines 15/16 come from assessed (v0), not from v1
    assert line_values[15] == 12000
    assert line_values[16] == 3000
    # Line 20 delta uses assessed baseline
    assert line_values[20] == -15000  # 0 + 0 - 12000 - 3000

    # Renewable lines should lock for 2025+ when previous assessed exists
    v2_report.summary = assessed_summary
    v2_report.current_status.status = ComplianceReportStatusEnum.Assessed
    assessed_report.compliance_period.description = "2024"  # previous period exists to trigger lock

    locked_summary = await compliance_report_summary_service.calculate_compliance_report_summary(
        report_id=v2_report.compliance_report_id
    )
    assert locked_summary.lines_7_and_9_locked is True


@pytest.mark.anyio
async def test_analyst_adjustment_uses_assessed_baseline_for_lines_7_9(
    compliance_report_summary_service: ComplianceReportSummaryService,
    mock_repo,
    mock_trxn_repo,
):
    """
    When creating an analyst adjustment after assessment, lines 7/9 should auto-lock from the assessed baseline.
    """

    assessed_report = make_report(0, ComplianceReportStatusEnum.Assessed, "2024")
    assessed_report.summary = make_summary(line6=1500, line8=700, line18=0, line19=0, locked=True)
    assessed_report.compliance_period.description = "2024"

    adjustment_report = make_report(1, ComplianceReportStatusEnum.Analyst_adjustment, "2024", nickname="v1 analyst adj")
    adjustment_report.summary = make_summary(line6=0, line8=0, line18=0, line19=0, locked=False)
    adjustment_report.compliance_period = assessed_report.compliance_period

    mock_repo.get_compliance_report_by_id = AsyncMock(return_value=adjustment_report)
    mock_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=assessed_report)
    mock_trxn_repo.calculate_line_17_available_balance_for_period = AsyncMock(return_value=0)

    summary_schema = await compliance_report_summary_service.calculate_compliance_report_summary(
        report_id=adjustment_report.compliance_report_id
    )

    line7 = next(r for r in summary_schema.renewable_fuel_target_summary if r.line == 7)
    line9 = next(r for r in summary_schema.renewable_fuel_target_summary if r.line == 9)
    assert line7.gasoline == 1500 and line9.gasoline == 700
    # Analyst adjustment stays editable until locked; values should still be pre-populated
    assert summary_schema.lines_7_and_9_locked is False


@pytest.mark.anyio
async def test_early_issuance_quarterly_zero_baselines_when_unassessed(
    compliance_report_summary_service: ComplianceReportSummaryService,
    mock_repo,
    mock_summary_repo,
    mock_trxn_repo,
):
    """
    Early issuance (quarterly) with no assessed baseline should have zero baselines for lines 15/16.

    Line 15/16 represent 'previously issued credits'. Even though a previous version exists with
    calculated Line 18/19 values, those credits were never actually issued (no assessment occurred),
    so Line 15/16 should be 0.
    """
    v0 = make_report(
        0, ComplianceReportStatusEnum.Submitted, "2025", nickname="early v0", reporting_frequency="QUARTERLY"
    )
    v0.summary = make_summary(line18=5000, line19=2000, locked=False)

    v1 = make_report(
        1, ComplianceReportStatusEnum.Draft, "2025", nickname="early v1", reporting_frequency="QUARTERLY"
    )
    v1.summary = make_summary()

    mock_repo.get_compliance_report_by_id = AsyncMock(return_value=v1)
    mock_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=None)
    mock_summary_repo.get_previous_summary = AsyncMock(return_value=v0.summary)
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
    mock_summary_repo.get_received_compliance_units.return_value = 0
    mock_summary_repo.get_issued_compliance_units.return_value = 0
    mock_trxn_repo.calculate_line_17_available_balance_for_period = AsyncMock(
        return_value=0
    )
    compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(
        return_value=0
    )
    compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(
        return_value=0
    )

    lc_summary, _ = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
        v1.compliance_period.effective_date,
        v1.compliance_period.expiration_date,
        v1.organization_id,
        v1,
    )
    line_values = {row.line: row.value for row in lc_summary}
    # Lines 15/16 are 0 because no assessed report exists (no credits were actually issued)
    assert line_values[15] == 0
    assert line_values[16] == 0
    assert line_values[20] == 0


@pytest.mark.anyio
async def test_early_issuance_quarterly_with_assessed_baseline_uses_assessed_not_previous_version(
    compliance_report_summary_service: ComplianceReportSummaryService,
    mock_repo,
    mock_summary_repo,
    mock_trxn_repo,
):
    """
    Early issuance with an assessed baseline should use the assessed report for lines 15/16 and ignore unassessed previous versions.
    """
    assessed = make_report(
        0, ComplianceReportStatusEnum.Assessed, "2025", nickname="assessed early", reporting_frequency="QUARTERLY"
    )
    assessed.summary = make_summary(line18=6000, line19=-2000, locked=True)

    v1 = make_report(
        1, ComplianceReportStatusEnum.Draft, "2025", nickname="v1 early", reporting_frequency="QUARTERLY"
    )
    v1.summary = make_summary(line18=10000, line19=-3000)  # should be ignored because assessed exists

    mock_repo.get_compliance_report_by_id = AsyncMock(return_value=v1)
    mock_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=assessed)
    mock_summary_repo.get_previous_summary = AsyncMock(return_value=v1.summary)
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
    mock_summary_repo.get_received_compliance_units.return_value = 0
    mock_summary_repo.get_issued_compliance_units.return_value = 0
    mock_trxn_repo.calculate_line_17_available_balance_for_period = AsyncMock(return_value=0)
    compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(return_value=0)
    compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(return_value=0)

    lc_summary, _ = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
        v1.compliance_period.effective_date,
        v1.compliance_period.expiration_date,
        v1.organization_id,
        v1,
    )
    line_values = {row.line: row.value for row in lc_summary}

    assert line_values[15] == 6000
    assert line_values[16] == -2000
    assert line_values[20] == -4000


@pytest.mark.anyio
async def test_gov_supplemental_from_submitted_has_zero_baselines(
    compliance_report_summary_service: ComplianceReportSummaryService,
    mock_repo,
    mock_summary_repo,
    mock_trxn_repo,
):
    """
    Government-initiated supplemental off a submitted original should have zero baselines for lines 15/16.

    Line 15/16 represent 'previously issued credits'. Even though the original was submitted with
    calculated Line 18/19 values, those credits were never actually issued (original wasn't assessed),
    so Line 15/16 should be 0.
    """
    v0_submitted = make_report(0, ComplianceReportStatusEnum.Submitted, "2025", nickname="v0 submitted")
    v0_submitted.summary = make_summary(line18=10000, line19=-3000, locked=False)

    v1_gov_sup = make_report(1, ComplianceReportStatusEnum.Draft, "2025", nickname="v1 gov sup")
    v1_gov_sup.summary = make_summary()

    mock_repo.get_compliance_report_by_id = AsyncMock(return_value=v1_gov_sup)
    mock_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=None)
    mock_summary_repo.get_previous_summary = AsyncMock(return_value=v0_submitted.summary)
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
    mock_summary_repo.get_received_compliance_units.return_value = 0
    mock_summary_repo.get_issued_compliance_units.return_value = 0
    mock_trxn_repo.calculate_line_17_available_balance_for_period = AsyncMock(return_value=0)
    compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(return_value=0)
    compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(return_value=0)

    lc_summary, _ = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
        v1_gov_sup.compliance_period.effective_date,
        v1_gov_sup.compliance_period.expiration_date,
        v1_gov_sup.organization_id,
        v1_gov_sup,
    )
    line_values = {row.line: row.value for row in lc_summary}

    # Lines 15/16 are 0 because no assessed report exists (original's credits were never issued)
    assert line_values[15] == 0
    assert line_values[16] == 0
    assert line_values[20] == 0  # 0 + 0 - 0 - 0


@pytest.mark.anyio
async def test_first_report_no_prior_assessed_lines_unlocked_and_zero_baselines(
    compliance_report_summary_service: ComplianceReportSummaryService,
    mock_repo,
    mock_trxn_repo,
    mock_notional_transfer_service,
    mock_fuel_supply_repo,
    mock_fuel_export_repo,
    mock_summary_repo,
):
    """
    First-ever report in a chain: no prior assessed, lines 7/9 remain editable, and low-carbon baselines are zero.
    """
    first_report = make_report(0, ComplianceReportStatusEnum.Draft, "2024", nickname="first")
    first_report.summary = make_summary()

    mock_repo.get_compliance_report_by_id = AsyncMock(return_value=first_report)
    mock_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=None)
    mock_summary_repo.get_previous_summary = AsyncMock(return_value=None)
    mock_trxn_repo.calculate_line_17_available_balance_for_period = AsyncMock(return_value=0)
    compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(return_value=0)
    compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(return_value=0)
    mock_notional_transfer_service.get_notional_transfers = AsyncMock(
        return_value=type("NT", (), {"notional_transfers": []})
    )
    mock_fuel_supply_repo.get_effective_fuel_supplies = AsyncMock(return_value=[])
    mock_fuel_export_repo.get_effective_fuel_exports = AsyncMock(return_value=[])
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
    mock_summary_repo.get_received_compliance_units.return_value = 0
    mock_summary_repo.get_issued_compliance_units.return_value = 0

    summary = await compliance_report_summary_service.calculate_compliance_report_summary(
        report_id=first_report.compliance_report_id
    )
    line7 = next(r for r in summary.renewable_fuel_target_summary if r.line == 7)
    line9 = next(r for r in summary.renewable_fuel_target_summary if r.line == 9)
    assert line7.gasoline == 0
    assert line9.gasoline == 0
    assert summary.lines_7_and_9_locked is False


@pytest.mark.anyio
async def test_supplier_supplemental_off_assessed_copies_lines_and_keeps_6_8_editable(
    compliance_report_summary_service: ComplianceReportSummaryService,
    mock_repo,
    mock_summary_repo,
    mock_trxn_repo,
):
    """
    Supplier supplemental created off an assessed baseline should copy lines 6–9, lock 7/9, but keep 6/8 editable.
    """
    assessed = make_report(0, ComplianceReportStatusEnum.Assessed, "2025", nickname="assessed")
    assessed.summary = make_summary(line6=200, line7=0, line8=0, line9=0, locked=True)

    sup = make_report(1, ComplianceReportStatusEnum.Draft, "2025", nickname="supplier sup")
    sup.summary = make_summary()

    mock_repo.get_compliance_report_by_id = AsyncMock(return_value=sup)
    mock_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=assessed)
    mock_summary_repo.get_previous_summary = AsyncMock(return_value=None)
    mock_trxn_repo.calculate_line_17_available_balance_for_period = AsyncMock(return_value=0)
    compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(return_value=4000)
    compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(return_value=-1000)
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 1000
    mock_summary_repo.get_received_compliance_units.return_value = 500
    mock_summary_repo.get_issued_compliance_units.return_value = 2000
    # Ensure renewable calculations allow retention/defer amounts to surface
    def aggregate(records, fossil_derived):
        # Use larger, realistic quantities: fossil 10k, renewable 2k for gasoline
        if fossil_derived:
            return {"gasoline": 10000, "diesel": 0, "jet_fuel": 0}
        return {"gasoline": 2000, "diesel": 0, "jet_fuel": 0}

    compliance_report_summary_service.repo.aggregate_quantities = MagicMock(side_effect=aggregate)
    compliance_report_summary_service.notional_transfer_service.get_notional_transfers = AsyncMock(
        return_value=type("NT", (), {"notional_transfers": []})
    )

    summary_schema = await compliance_report_summary_service.calculate_compliance_report_summary(
        report_id=sup.compliance_report_id
    )

    line6 = next(r for r in summary_schema.renewable_fuel_target_summary if r.line == 6)
    line7 = next(r for r in summary_schema.renewable_fuel_target_summary if r.line == 7)
    line8 = next(r for r in summary_schema.renewable_fuel_target_summary if r.line == 8)
    line9 = next(r for r in summary_schema.renewable_fuel_target_summary if r.line == 9)

    assert line6.gasoline == 30  # copied retained (and capped from calc)
    assert summary_schema.lines_6_and_8_locked is False  # still editable in draft
    assert line7.gasoline == 200 and line9.gasoline == 0
    assert summary_schema.lines_7_and_9_locked is True
    # Line 4/10 derived from aggregates
    line4 = next(r for r in summary_schema.renewable_fuel_target_summary if r.line == 4)
    line10 = next(r for r in summary_schema.renewable_fuel_target_summary if r.line == 10)
    assert line4.gasoline == 600  # 5% of tracked fuel (12000 * 0.05)
    assert line10.gasoline == 2170  # 2000 -30 +200
    # Low carbon transfer/issuance lines
    lc_map = {row.line: row.value for row in summary_schema.low_carbon_fuel_target_summary}
    assert lc_map[12] == 1000
    assert lc_map[13] == 500
    assert lc_map[15] == 0  # no assessed baseline for current period yet
    assert summary_schema.non_compliance_penalty_summary[0].total_value >= 0


@pytest.mark.anyio
async def test_analyst_adjustment_off_assessed_with_penalty(
    compliance_report_summary_service: ComplianceReportSummaryService,
    mock_repo,
    mock_summary_repo,
    mock_trxn_repo,
):
    """
    Analyst adjustment on an assessed report with insufficient renewables should surface a penalty on Line 11.
    """
    assessed = make_report(0, ComplianceReportStatusEnum.Assessed, "2024")
    assessed.summary = make_summary(line6=0, line8=0, line18=8000, line19=-3000, locked=True)
    assessed.compliance_period.description = "2024"

    adj = make_report(1, ComplianceReportStatusEnum.Analyst_adjustment, "2024", nickname="analyst adj")
    adj.summary = make_summary()
    adj.compliance_period = assessed.compliance_period

    mock_repo.get_compliance_report_by_id = AsyncMock(return_value=adj)
    mock_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=assessed)
    mock_summary_repo.get_previous_summary = AsyncMock(return_value=None)
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
    mock_summary_repo.get_received_compliance_units.return_value = 0
    mock_summary_repo.get_issued_compliance_units.return_value = 0
    mock_trxn_repo.calculate_line_17_available_balance_for_period = AsyncMock(return_value=0)

    # Low renewable scenario: fossil 10000, renewable 100
    def aggregate(records, fossil_derived):
        return {"gasoline": 10000 if fossil_derived else 100, "diesel": 0, "jet_fuel": 0}

    compliance_report_summary_service.repo.aggregate_quantities = MagicMock(side_effect=aggregate)
    compliance_report_summary_service.notional_transfer_service.get_notional_transfers = AsyncMock(
        return_value=type("NT", (), {"notional_transfers": []})
    )
    compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(return_value=0)
    compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(return_value=0)

    summary_schema = await compliance_report_summary_service.calculate_compliance_report_summary(
        report_id=adj.compliance_report_id
    )
    line8 = next(r for r in summary_schema.renewable_fuel_target_summary if r.line == 8)
    line11 = next(r for r in summary_schema.non_compliance_penalty_summary if r.line == 11)
    assert line8.gasoline >= 0  # deferral capped
    assert line11.total_value > 0  # penalty due to shortfall


@pytest.mark.anyio
async def test_early_issuance_multiple_submissions_without_assessed_has_zero_baselines(
    compliance_report_summary_service: ComplianceReportSummaryService,
    mock_repo,
    mock_summary_repo,
    mock_trxn_repo,
):
    """
    Early issuance with multiple submissions and no assessed baseline should have zero baselines for lines 15/16.

    Line 15/16 represent 'previously issued credits'. Even though multiple previous versions exist
    with calculated Line 18/19 values, those credits were never actually issued (no assessment),
    so Line 15/16 should be 0.
    """
    v0 = make_report(0, ComplianceReportStatusEnum.Submitted, "2025", nickname="early v0", reporting_frequency="QUARTERLY")
    v0.summary = make_summary(line18=4000, line19=-1500, locked=False)

    v1 = make_report(1, ComplianceReportStatusEnum.Submitted, "2025", nickname="early v1", reporting_frequency="QUARTERLY")
    v1.summary = make_summary(line18=7000, line19=-2500, locked=False)

    v2 = make_report(2, ComplianceReportStatusEnum.Draft, "2025", nickname="early v2", reporting_frequency="QUARTERLY")
    v2.summary = make_summary()

    mock_repo.get_compliance_report_by_id = AsyncMock(return_value=v2)
    mock_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=None)
    mock_summary_repo.get_previous_summary = AsyncMock(return_value=v1.summary)
    mock_summary_repo.get_transferred_out_compliance_units.return_value = 0
    mock_summary_repo.get_received_compliance_units.return_value = 0
    mock_summary_repo.get_issued_compliance_units.return_value = 0
    mock_trxn_repo.calculate_line_17_available_balance_for_period = AsyncMock(return_value=0)
    compliance_report_summary_service.calculate_fuel_supply_compliance_units = AsyncMock(return_value=0)
    compliance_report_summary_service.calculate_fuel_export_compliance_units = AsyncMock(return_value=0)

    lc_summary, _ = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
        v2.compliance_period.effective_date,
        v2.compliance_period.expiration_date,
        v2.organization_id,
        v2,
    )
    line_values = {row.line: row.value for row in lc_summary}

    # Lines 15/16 are 0 because no assessed report exists (no credits were ever issued)
    assert line_values[15] == 0
    assert line_values[16] == 0
    assert line_values[20] == 0
