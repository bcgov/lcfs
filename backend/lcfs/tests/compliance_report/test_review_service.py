from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from lcfs.db.models.compliance.ComplianceReport import QuantityUnitsEnum
from lcfs.web.api.compliance_report.review_service import (
    ComplianceReportReviewService,
)
from lcfs.web.api.compliance_report.schema import ComplianceReportReviewFindingSchema


def _service(repo=None, fse_repo=None):
    return ComplianceReportReviewService(
        repo=repo or MagicMock(),
        summary_service=MagicMock(),
        fse_repo=fse_repo or MagicMock(),
    )


@pytest.mark.anyio
async def test_get_fse_summary_uses_grid_backed_fse_repository():
    fse_repo = MagicMock()
    fse_repo.get_review_fse_summary_for_report = AsyncMock(
        return_value={"equipment_count": 1, "total_kwh": 1234}
    )
    service = _service(fse_repo=fse_repo)
    report = SimpleNamespace(
        organization_id=10,
        compliance_report_id=100,
        compliance_report_group_uuid="report-group-uuid",
    )

    result = await service._get_fse_summary(report, 2025)

    assert result == {"equipment_count": 1, "total_kwh": 1234}
    fse_repo.get_review_fse_summary_for_report.assert_awaited_once_with(
        10,
        100,
        date(2025, 1, 1),
        date(2025, 12, 31),
    )


def test_fse_findings_use_reported_rows_and_all_level_types():
    service = _service()

    findings = service._fse_findings(
        {
            "equipment_count": 3,
            "active_count": 3,
            "validated_count": 3,
            "active_full_year_count": 3,
            "level_counts": {"Level 1": 2, "Level 2": 1},
            "total_kwh": 115_000,
            "avg_capacity_utilization_percent": 0.03,
            "registration_numbers": ["FSE-1", "FSE-2", "FSE-3"],
        },
        {
            "equipment_count": 3,
            "total_kwh": 100_000,
            "registration_numbers": ["FSE-1", "FSE-2", "FSE-3"],
        },
        2025,
    )

    titles = [finding.title for finding in findings]
    assert "No FSE data reported" not in titles
    assert "FSE level mix includes Level 1 equipment" in titles
    assert "FSE capacity utilization pre-screen" in titles

    level_finding = next(
        finding
        for finding in findings
        if finding.title == "FSE level mix includes Level 1 equipment"
    )
    evidence = {metric.label: metric.value for metric in level_finding.evidence}
    assert evidence["Level 1 FSE"] == 2
    assert evidence["Level 2 FSE"] == 1
    assert evidence["Total FSE"] == 3


def test_fse_findings_hide_when_no_data_is_available():
    service = _service()

    findings = service._fse_findings(
        {"equipment_count": 0},
        None,
        2025,
    )

    assert findings == []


def test_fse_chart_series_merges_kwh_usage_and_capacity_utilization():
    service = _service()

    series = service._fse_chart_series(
        {
            "equipment_count": 2,
            "active_count": 2,
            "validated_count": 2,
            "level_counts": {"Level 2": 2},
            "total_kwh": 12_500,
            "avg_capacity_utilization_percent": 0.5,
        },
        {
            "equipment_count": 1,
            "active_count": 1,
            "validated_count": 1,
            "level_counts": {"Level 2": 1},
            "total_kwh": 10_000,
            "avg_capacity_utilization_percent": 0.25,
        },
        "2025",
        "2024",
    )

    usage_series = next(
        item
        for item in series
        if item.title == "FSE kWh usage and capacity utilization"
    )
    assert [point.label for point in usage_series.points] == [
        "Total kWh usage",
        "Average capacity utilization",
    ]
    assert usage_series.points[0].units == "kWh"
    assert usage_series.points[1].units == "%"

    equipment_series = next(
        item for item in series if item.title == "FSE equipment counts"
    )
    assert {point.label for point in equipment_series.points} >= {
        "Total FSE",
        "Level 2 FSE",
    }


def test_fse_usage_utilization_series_hides_when_no_usage_or_utilization_data():
    service = _service()

    series = service._fse_chart_series(
        {
            "equipment_count": 2,
            "active_count": 2,
            "validated_count": 2,
            "level_counts": {"Level 2": 2},
            "total_kwh": 0,
            "avg_capacity_utilization_percent": None,
        },
        {
            "equipment_count": 1,
            "active_count": 1,
            "validated_count": 1,
            "level_counts": {"Level 2": 1},
            "total_kwh": 0,
            "avg_capacity_utilization_percent": None,
        },
        "2025",
        "2024",
    )

    titles = [item.title for item in series]
    assert "FSE kWh usage and capacity utilization" not in titles
    assert "FSE equipment counts" in titles


def test_supplemental_line_20_finding_uses_magnitude_gap_delta():
    service = _service()
    current_summary = SimpleNamespace(
        low_carbon_fuel_target_summary=[SimpleNamespace(line=20, value=890)]
    )
    previous_summary = SimpleNamespace(
        low_carbon_fuel_target_summary=[SimpleNamespace(line=20, value=-180)]
    )

    findings = service._supplemental_summary_findings(
        current_summary,
        previous_summary,
    )

    assert len(findings) == 1
    metric = findings[0].evidence[0]
    assert metric.value == 890
    assert metric.comparison_value == -180
    assert metric.delta == 710


def test_comparison_point_can_use_magnitude_gap_delta_mode():
    service = _service()

    point = service._comparison_point(
        "Line 20",
        890,
        -180,
        units="compliance units",
        delta_mode="magnitude_gap",
    )

    assert point.current_value == 890
    assert point.comparison_value == -180
    assert point.delta == 710


def test_correlation_findings_identify_aligned_supply_and_fse_trends():
    service = _service()

    findings = service._correlation_findings(
        {"fuel_supplies": {"Diesel - HDRD": 1_400_000}},
        {"fuel_supplies": {"Diesel - HDRD": 1_000_000}},
        {"equipment_count": 12, "total_kwh": 180_000},
        {"equipment_count": 10, "total_kwh": 150_000},
    )

    assert len(findings) == 1
    assert findings[0].review_area == "Correlative variance analysis"
    assert findings[0].severity == "informational"
    assert findings[0].title == "Fuel supply variance aligns with FSE trend"
    evidence = {metric.label: metric for metric in findings[0].evidence}
    assert evidence["Total fuel supply"].delta == 400_000
    assert evidence["FSE count"].delta == 2


def test_correlation_findings_skip_when_current_report_has_no_fse_count():
    service = _service()

    findings = service._correlation_findings(
        {"fuel_supplies": {"Diesel - HDRD": 1_400_000}},
        {"fuel_supplies": {"Diesel - HDRD": 1_000_000}},
        {"equipment_count": 0, "total_kwh": 0},
        {"equipment_count": 10, "total_kwh": 150_000},
    )

    assert findings == []


def test_correlation_findings_skip_when_prior_report_has_no_fse_count():
    service = _service()

    findings = service._correlation_findings(
        {"fuel_supplies": {"Diesel - HDRD": 1_400_000}},
        {"fuel_supplies": {"Diesel - HDRD": 1_000_000}},
        {"equipment_count": 12, "total_kwh": 180_000},
        {"equipment_count": 0, "total_kwh": 0},
    )

    assert findings == []


def test_supply_fse_trend_series_skip_when_current_report_has_no_fse_count():
    service = _service()

    series = service._build_supply_fse_trend_series(
        {"fuel_supplies": {"Diesel - HDRD": 1_400_000}},
        [
            (
                SimpleNamespace(
                    compliance_report_id=200,
                    compliance_period=SimpleNamespace(description="2024"),
                ),
                {"fuel_supplies": {"Diesel - HDRD": 1_000_000}},
            )
        ],
        {"equipment_count": 0, "total_kwh": 0},
        [
            (
                SimpleNamespace(
                    compliance_report_id=200,
                    compliance_period=SimpleNamespace(description="2024"),
                ),
                {"equipment_count": 10, "total_kwh": 150_000},
            )
        ],
        "2025",
    )

    assert series == []


def test_supply_fse_trend_series_skip_when_prior_report_has_no_fse_count():
    service = _service()

    series = service._build_supply_fse_trend_series(
        {"fuel_supplies": {"Diesel - HDRD": 1_400_000}},
        [
            (
                SimpleNamespace(
                    compliance_report_id=200,
                    compliance_period=SimpleNamespace(description="2024"),
                ),
                {"fuel_supplies": {"Diesel - HDRD": 1_000_000}},
            )
        ],
        {"equipment_count": 12, "total_kwh": 180_000},
        [
            (
                SimpleNamespace(
                    compliance_report_id=200,
                    compliance_period=SimpleNamespace(description="2024"),
                ),
                {"equipment_count": 0, "total_kwh": 0},
            )
        ],
        "2025",
    )

    assert series == []


def test_fuel_supply_fse_cross_check_hides_when_one_side_has_no_data():
    service = _service()

    findings = service._fuel_supply_fse_cross_check_findings(
        {
            "fuel_supplies": [
                SimpleNamespace(units=QuantityUnitsEnum.Kilowatt_hour, quantity=0)
            ]
        },
        {"total_kwh": 1442284},
    )

    assert findings == []


def test_fuel_supply_fse_cross_check_flags_kwh_mismatch():
    service = _service()

    findings = service._fuel_supply_fse_cross_check_findings(
        {
            "fuel_supplies": [
                SimpleNamespace(
                    units=QuantityUnitsEnum.Kilowatt_hour,
                    quantity=1442600,
                )
            ]
        },
        {"total_kwh": 1442284},
    )

    assert len(findings) == 1
    assert findings[0].title == "Fuel supply and FSE kWh do not align"
    metric = findings[0].evidence[0]
    assert metric.value == 1442600
    assert metric.comparison_value == 1442284
    assert metric.delta == 316


def test_fse_findings_flag_low_charge_volume_rationale():
    service = _service()

    findings = service._fse_findings(
        {
            "equipment_count": 4,
            "active_count": 4,
            "validated_count": 4,
            "active_full_year_count": 4,
            "level_counts": {"Level 2": 4},
            "total_kwh": 2000,
            "avg_capacity_utilization_percent": 0.03,
            "registration_numbers": ["FSE-1", "FSE-2", "FSE-3", "FSE-4"],
        },
        None,
        2025,
    )

    titles = [finding.title for finding in findings]
    assert "Low FSE charge volume needs rationale" in titles


def test_allocation_findings_flag_missing_phone_numbers():
    service = _service()

    findings = service._allocation_findings(
        {
            "fuel_supplies": [],
            "allocation_agreements": [
                SimpleNamespace(
                    transaction_partner_phone=None,
                    quantity=100,
                    fuel_category=SimpleNamespace(category="Diesel"),
                    fuel_type=SimpleNamespace(fuel_type="HDRD"),
                )
            ],
        }
    )

    assert len(findings) == 1
    assert findings[0].title == "Allocation agreement contact details incomplete"


def test_build_summary_includes_analyst_style_highlights():
    service = _service()

    summary = service._build_summary(
        [
            ComplianceReportReviewFindingSchema(
                review_area="Out-of-province consumption",
                severity="review",
                title="Other uses variance needs explanation for Diesel - HDRD",
                detail=(
                    "Diesel - HDRD for other uses shows a 64.0% year-over-year "
                    "increase. Supplier rationale is captured on 1 record(s)."
                ),
                source="Other uses",
            ),
            ComplianceReportReviewFindingSchema(
                review_area="Notional transfers and exports",
                severity="informational",
                title="Confirmed no exports out of BC reported",
                detail=(
                    "The effective report data does not include active fuel exports "
                    "for this reporting period."
                ),
                source="Fuel exports",
            ),
        ],
        has_prior_year_baseline=True,
    )

    assert "found 1 item(s) for analyst review" in summary
    assert "Diesel - HDRD for other uses shows a 64.0% year-over-year increase." in summary
    assert "Prior-year assessed comparison was available." in summary


def test_zero_value_narratives_confirm_consistent_absence():
    service = _service()

    findings = service._zero_value_narrative_findings(
        {
            "fuel_exports": {},
            "notional_transfers": {},
            "other_uses": {},
        },
        {
            "fuel_exports": {},
            "notional_transfers": {},
            "other_uses": {},
        },
    )

    titles = {finding.title for finding in findings}
    assert "Confirmed no reportable exports" in titles
    assert "Confirmed no reportable notional transfers" in titles
    assert "Confirmed no reportable other uses" in titles


def test_zero_value_narratives_flag_cessation_against_prior_year():
    service = _service()

    findings = service._zero_value_narrative_findings(
        {
            "fuel_exports": {},
            "notional_transfers": {},
            "other_uses": {},
        },
        {
            "fuel_exports": {"Gasoline - Ethanol": 1000},
            "notional_transfers": {},
            "other_uses": {},
        },
    )

    assert len(findings) == 3
    export_finding = next(
        finding for finding in findings if finding.title == "No exports reported this year"
    )
    assert export_finding.severity == "review"
    assert "No rationale was found in the available data." in export_finding.detail


def test_large_supply_drop_findings_reference_available_rationale_text():
    service = _service()

    findings = service._large_supply_drop_findings(
        SimpleNamespace(
            supplemental_note="Shell Canada took over reporting responsibility under the new supply agreement."
        ),
        {"fuel_supplies": {"Diesel - HDRD": 100}},
        {"fuel_supplies": {"Diesel - HDRD": 1000}},
    )

    assert len(findings) == 1
    assert "documented in the available report text" in findings[0].detail
    assert findings[0].severity == "review"


def test_large_supply_drop_findings_require_follow_up_without_rationale():
    service = _service()

    findings = service._large_supply_drop_findings(
        SimpleNamespace(supplemental_note=None, assessment_statement=None, nickname=None),
        {"fuel_supplies": {"Diesel - HDRD": 100}},
        {"fuel_supplies": {"Diesel - HDRD": 1000}},
    )

    assert len(findings) == 1
    assert "No reporting-responsibility rationale was found" in findings[0].detail
    assert findings[0].severity == "concern"


def test_fuel_mix_shift_findings_identify_possible_blending_shift():
    service = _service()

    findings = service._fuel_mix_shift_findings(
        {
            "fuel_supplies": {
                "Diesel - HDRD": 1200,
                "Diesel - Fossil-derived diesel": 800,
            }
        },
        {
            "fuel_supplies": {
                "Diesel - HDRD": 400,
                "Diesel - Fossil-derived diesel": 1200,
            }
        },
    )

    assert len(findings) == 1
    assert findings[0].title == "Fuel mix indicates a possible blending shift"
    assert "possible blending shift" in findings[0].detail


def test_historical_presence_gap_flags_fuel_missing_after_two_prior_years():
    service = _service()

    findings = service._historical_presence_gap_findings(
        {"fuel_supplies": {}},
        [
            (
                SimpleNamespace(
                    compliance_period=SimpleNamespace(description="2024")
                ),
                {"fuel_supplies": {"Gasoline - Ethanol": 250_000}},
            ),
            (
                SimpleNamespace(
                    compliance_period=SimpleNamespace(description="2023")
                ),
                {"fuel_supplies": {"Gasoline - Ethanol": 175_000}},
            ),
        ],
    )

    assert len(findings) == 1
    assert findings[0].review_area == "Historical presence gap"
    assert findings[0].severity == "concern"
    assert findings[0].title == "Gasoline - Ethanol is no longer reported"
