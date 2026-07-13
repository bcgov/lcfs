from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from lcfs.web.api.compliance_report.review_service import (
    ComplianceReportReviewService,
)


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


def test_fse_findings_no_data_message_is_group_aware():
    service = _service()

    findings = service._fse_findings(
        {"equipment_count": 0},
        None,
        2025,
    )

    assert len(findings) == 1
    assert findings[0].title == "No FSE data reported"
    assert "grid-backed row set" in findings[0].detail


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
