"""Summary autosave: the client's save is cut to what the caller may change.

The save goes to the report the route authorized, keeps the stored lock,
carries only the lines people enter, and changes the penalty override only
for the director on a recommended report.
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatusEnum as S,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportSummaryRowSchema,
    ComplianceReportSummaryUpdateSchema,
)

REPORT_ID = 10
SUMMARY_ID = 20


def _user(*roles):
    user = MagicMock()
    user.role_names = list(roles)
    user.user_profile_id = 99
    return user


SUPPLIER = _user(RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING)
ANALYST = _user(RoleEnum.GOVERNMENT, RoleEnum.ANALYST)
DIRECTOR = _user(RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR)


def _report(current, is_locked=False):
    report = MagicMock()
    report.compliance_report_id = REPORT_ID
    report.current_status.status = current
    report.summary.summary_id = SUMMARY_ID
    report.summary.is_locked = is_locked
    report.summary.penalty_override_enabled = True
    report.summary.renewable_penalty_override = 111.0
    report.summary.low_carbon_penalty_override = 222.0
    report.summary.penalty_override_date = datetime(2026, 1, 1)
    report.summary.penalty_override_user = 1
    return report


def _save(**overrides):
    data = {
        "compliance_report_id": REPORT_ID,
        "summary_id": SUMMARY_ID,
        "is_locked": False,
        "renewable_fuel_target_summary": [
            ComplianceReportSummaryRowSchema(line=line, field="f", gasoline=5)
            for line in (1, 6, 7, 8, 9, 10, 11)
        ],
        "low_carbon_fuel_target_summary": [
            ComplianceReportSummaryRowSchema(line=11, field="invoice_sent", value=1),
            ComplianceReportSummaryRowSchema(line=20, field="x", value=-500),
        ],
        "non_compliance_penalty_summary": [
            ComplianceReportSummaryRowSchema(line=11, total_value=0)
        ],
        "penalty_override_enabled": False,
        "renewable_penalty_override": None,
        "low_carbon_penalty_override": None,
    }
    data.update(overrides)
    return ComplianceReportSummaryUpdateSchema(**data)


def _editable(service, report, user, data=None, year=2025):
    return service._editable_summary_data(report, data or _save(), user, year)


@pytest.mark.parametrize(
    "field, value",
    [("compliance_report_id", REPORT_ID + 1), ("summary_id", SUMMARY_ID + 1)],
)
def test_save_naming_another_report_or_summary_is_refused(
    compliance_report_summary_service, field, value
):
    with pytest.raises(HTTPException) as exc:
        _editable(
            compliance_report_summary_service,
            _report(S.Draft),
            SUPPLIER,
            _save(**{field: value}),
        )
    assert exc.value.status_code == 400


def test_supplier_draft_save_keeps_only_entered_lines(
    compliance_report_summary_service,
):
    result = _editable(compliance_report_summary_service, _report(S.Draft), SUPPLIER)

    assert [row.line for row in result.renewable_fuel_target_summary] == [6, 7, 8, 9]
    assert result.low_carbon_fuel_target_summary == []
    assert result.non_compliance_penalty_summary == []


@pytest.mark.parametrize(
    "report, user",
    [(_report(S.Draft), SUPPLIER), (_report(S.Analyst_adjustment), ANALYST)],
)
def test_client_cannot_set_the_lock(compliance_report_summary_service, report, user):
    result = _editable(
        compliance_report_summary_service, report, user, _save(is_locked=True)
    )
    assert result.is_locked is False


def test_non_director_save_keeps_the_stored_penalty_override(
    compliance_report_summary_service,
):
    result = _editable(compliance_report_summary_service, _report(S.Draft), SUPPLIER)

    assert result.penalty_override_enabled is True
    assert result.renewable_penalty_override == 111.0
    assert result.low_carbon_penalty_override == 222.0
    assert result.penalty_override_user == 1


def test_director_override_is_stamped_server_side(compliance_report_summary_service):
    data = _save(
        penalty_override_enabled=True,
        renewable_penalty_override=5.0,
        low_carbon_penalty_override=6.0,
        penalty_override_user=12345,
    )
    result = _editable(
        compliance_report_summary_service,
        _report(S.Recommended_by_manager, is_locked=True),
        DIRECTOR,
        data,
    )

    assert result.renewable_penalty_override == 5.0
    assert result.low_carbon_penalty_override == 6.0
    assert result.penalty_override_user == DIRECTOR.user_profile_id
    # A locked summary takes no line values, even from the director.
    assert result.renewable_fuel_target_summary == []


@pytest.mark.parametrize(
    "report, user",
    [
        (_report(S.Submitted), SUPPLIER),
        (_report(S.Assessed), SUPPLIER),
        (_report(S.Draft, is_locked=True), SUPPLIER),
        (_report(S.Submitted), ANALYST),
        (_report(S.Recommended_by_manager, is_locked=True), ANALYST),
    ],
)
def test_save_outside_an_editable_status_is_refused(
    compliance_report_summary_service, report, user
):
    with pytest.raises(HTTPException) as exc:
        _editable(compliance_report_summary_service, report, user)
    assert exc.value.status_code == 403


def test_director_override_needs_a_2024_or_later_report(
    compliance_report_summary_service,
):
    with pytest.raises(HTTPException) as exc:
        _editable(
            compliance_report_summary_service,
            _report(S.Recommended_by_manager, is_locked=True),
            DIRECTOR,
            year=2023,
        )
    assert exc.value.status_code == 403


@pytest.mark.anyio
async def test_update_saves_the_cut_down_summary(
    compliance_report_summary_service, mock_repo, mock_summary_repo
):
    report = _report(S.Draft)
    report.compliance_period.description = "2025"
    mock_repo.get_compliance_report_by_id = AsyncMock(return_value=report)
    compliance_report_summary_service.calculate_compliance_report_summary = AsyncMock(
        return_value="recalculated"
    )
    compliance_report_summary_service._clear_compliance_report_summary_cache = (
        MagicMock()
    )

    result = await compliance_report_summary_service.update_compliance_report_summary(
        REPORT_ID, _save(), SUPPLIER
    )

    assert result == "recalculated"
    saved = mock_summary_repo.save_compliance_report_summary.call_args.args[0]
    assert saved.compliance_report_id == REPORT_ID
    assert [row.line for row in saved.renewable_fuel_target_summary] == [6, 7, 8, 9]
    assert saved.low_carbon_fuel_target_summary == []
