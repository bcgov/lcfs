import pytest
from datetime import datetime
from unittest.mock import AsyncMock

from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.web.api.compliance_report.summary_service import ComplianceReportSummaryService
from lcfs.tests.compliance_report.utils import make_report, make_summary


@pytest.mark.anyio
async def test_full_chain_submit_recommend_assess_and_supplementals(
    compliance_report_summary_service: ComplianceReportSummaryService,
    mock_repo,
    mock_summary_repo,
    mock_trxn_repo,
):
    """
    Simulate v0 submit → recommend/lock → assess, then v1 supplier supplemental (draft) and v2 analyst adjustment.
    Assert lines come from the assessed snapshot and lock rules hold.
    """
    compliance_period_start = datetime(2025, 1, 1)
    compliance_period_end = datetime(2025, 12, 31)

    # v0 submitted -> recommend -> assessed
    v0 = make_report(0, ComplianceReportStatusEnum.Assessed, "2025")
    assessed_summary = make_summary(
        line6=8,
        line7=0,
        line8=2,
        line9=0,
        line18=10,
        line19=-4,
        line20=6,
        locked=True,
    )
    v0.summary = assessed_summary
    v0.compliance_period.description = "2025"

    # v1 supplier supplemental (draft)
    v1 = make_report(1, ComplianceReportStatusEnum.Draft, "2025", nickname="v1 supplier sup")
    v1.summary = make_summary()
    v1.compliance_period = v0.compliance_period

    # v2 analyst adjustment (draft)
    v2 = make_report(2, ComplianceReportStatusEnum.Analyst_adjustment, "2025", nickname="v2 analyst adj")
    v2.summary = make_summary()
    v2.compliance_period = v0.compliance_period

    # Repo wiring
    async def get_report_by_id(report_id):
        if report_id == v1.compliance_report_id:
            return v1
        if report_id == v2.compliance_report_id:
            return v2
        if report_id == v0.compliance_report_id:
            return v0
        return None

    mock_repo.get_compliance_report_by_id = AsyncMock(side_effect=get_report_by_id)
    mock_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=v0)
    mock_summary_repo.get_previous_summary = AsyncMock(return_value=v1.summary)
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

    # v1 supplemental summary: lines 7/9 should auto-populate from assessed; lines 15/16 from assessed
    summary_v1 = await compliance_report_summary_service.calculate_compliance_report_summary(
        report_id=v1.compliance_report_id
    )
    line7_v1 = next(r for r in summary_v1.renewable_fuel_target_summary if r.line == 7)
    line9_v1 = next(r for r in summary_v1.renewable_fuel_target_summary if r.line == 9)
    assert line7_v1.gasoline == 8  # from assessed line6
    assert line9_v1.gasoline == 2  # from assessed line8
    assert summary_v1.lines_7_and_9_locked is True

    # v2 analyst adjustment: pre-populated; for 2025+ with prior assessed, lines 7/9 are auto-locked
    summary_v2 = await compliance_report_summary_service.calculate_compliance_report_summary(
        report_id=v2.compliance_report_id
    )
    line7_v2 = next(r for r in summary_v2.renewable_fuel_target_summary if r.line == 7)
    assert line7_v2.gasoline == 8
    assert summary_v2.lines_7_and_9_locked is True

    # Low-carbon lines 15/16 for v1 should use assessed baseline
    lc_summary_v1, _ = await compliance_report_summary_service.calculate_low_carbon_fuel_target_summary(
        compliance_period_start,
        compliance_period_end,
        v1.organization_id,
        v1,
    )
    lc_line_values = {row.line: row.value for row in lc_summary_v1}
    assert lc_line_values[15] == 10  # assessed line18
    assert lc_line_values[16] == -4  # assessed line19


@pytest.mark.anyio
async def test_locked_summary_returns_all_line_values(
    compliance_report_summary_service: ComplianceReportSummaryService, mock_repo
):
    """Locked summary should surface stored values for all lines 1–22."""

    summary = make_summary(line6=300, line7=200, line8=100, line9=0, line18=5000, line19=-2000, line20=3000, locked=True)
    # Populate renewable lines
    summary.line_1_fossil_derived_base_fuel_gasoline = 10000
    summary.line_2_eligible_renewable_fuel_supplied_gasoline = 5000
    summary.line_3_total_tracked_fuel_supplied_gasoline = 15000
    summary.line_4_eligible_renewable_fuel_required_gasoline = 1200
    summary.line_5_net_notionally_transferred_gasoline = 250
    summary.line_10_net_renewable_fuel_supplied_gasoline = 4000
    summary.line_11_non_compliance_penalty_gasoline = 300
    summary.total_non_compliance_penalty_payable = 300
    # Low-carbon lines
    summary.line_12_low_carbon_fuel_required = 4000
    summary.line_13_low_carbon_fuel_supplied = 6000
    summary.line_14_low_carbon_fuel_surplus = 8000
    summary.line_15_banked_units_used = 1000
    summary.line_16_banked_units_remaining = 2000
    summary.line_17_non_banked_units_used = 5000
    summary.line_21_non_compliance_penalty_payable = 60000
    summary.line_22_compliance_units_issued = 11000

    report = make_report(0, ComplianceReportStatusEnum.Recommended_by_analyst, "2025")
    report.summary = summary

    mock_repo.get_compliance_report_by_id = AsyncMock(return_value=report)
    mock_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=None)

    locked = await compliance_report_summary_service.calculate_compliance_report_summary(
        report_id=report.compliance_report_id
    )

    line_map = {r.line: r for r in locked.renewable_fuel_target_summary}
    assert line_map[1].gasoline == 10000
    assert line_map[2].gasoline == 5000
    assert line_map[3].gasoline == 15000
    assert line_map[4].gasoline == 1200
    assert line_map[5].gasoline == 250
    assert line_map[6].gasoline == 300
    assert line_map[7].gasoline == 200
    assert line_map[8].gasoline == 100
    assert line_map[9].gasoline == 0
    assert line_map[10].gasoline == 4000
    assert locked.non_compliance_penalty_summary[0].total_value == 300

    lc_map = {r.line: r for r in locked.low_carbon_fuel_target_summary}
    assert lc_map[12].value == 4000
    assert lc_map[13].value == 6000
    assert lc_map[14].value == 8000
    assert lc_map[15].value == 1000
    assert lc_map[16].value == 2000
    assert lc_map[17].value == 5000
    assert lc_map[21].value == 60000
    assert lc_map[22].value == 11000
    assert locked.lines_6_and_8_locked is True

@pytest.mark.anyio
async def test_locked_snapshot_contains_all_lines(
    compliance_report_summary_service: ComplianceReportSummaryService, mock_repo
):
    """Locked summary should return all 22 lines populated from stored values."""

    summary = make_summary(line6=300, line7=200, line8=100, line9=0, line18=5000, line19=-2000, line20=3000, locked=True)
    summary.line_1_fossil_derived_base_fuel_gasoline = 10000
    summary.line_2_eligible_renewable_fuel_supplied_gasoline = 5000
    summary.line_3_total_tracked_fuel_supplied_gasoline = 15000
    summary.line_4_eligible_renewable_fuel_required_gasoline = 1200
    summary.line_5_net_notionally_transferred_gasoline = 250
    summary.line_10_net_renewable_fuel_supplied_gasoline = 4000
    summary.line_11_non_compliance_penalty_payable_gasoline = 300
    summary.line_12_low_carbon_fuel_required = 4000
    summary.line_13_low_carbon_fuel_supplied = 6000
    summary.line_14_low_carbon_fuel_surplus = 8000
    summary.line_15_banked_units_used = 1000
    summary.line_16_banked_units_remaining = 2000
    summary.line_17_non_banked_units_used = 5000
    summary.line_21_non_compliance_penalty_payable = 60000
    summary.line_22_compliance_units_issued = 11000

    report = make_report(0, ComplianceReportStatusEnum.Recommended_by_analyst, "2025")
    report.summary = summary

    mock_repo.get_compliance_report_by_id = AsyncMock(return_value=report)
    mock_repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=None)

    locked = await compliance_report_summary_service.calculate_compliance_report_summary(
        report_id=report.compliance_report_id
    )

    assert len(locked.renewable_fuel_target_summary) == 11
    assert len(locked.low_carbon_fuel_target_summary) == 11
    assert len(locked.non_compliance_penalty_summary) >= 2
    line6_row = next(r for r in locked.renewable_fuel_target_summary if r.line == 6)
    assert line6_row.gasoline == 300
