"""Compliance report workflow: the transition table the API enforces.

Each status request is checked against where the stored report stands and
the caller's roles, mirroring the report page's buttons.
"""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatusEnum as S,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.compliance_report.workflow import (
    can_edit_summary,
    can_override_penalty,
    ensure_report_transition,
)

RETURN_TO_SUPPLIER = "Return to supplier"
RETURN_TO_ANALYST = "Return to analyst"
RETURN_TO_MANAGER = "Return to manager"


def _user(*roles):
    user = MagicMock()
    user.role_names = list(roles)
    return user


def _report(current):
    report = MagicMock()
    report.current_status.status = current
    return report


REPORTER = _user(RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING)
SIGNER = _user(RoleEnum.SUPPLIER, RoleEnum.SIGNING_AUTHORITY)
READ_ONLY = _user(RoleEnum.SUPPLIER, RoleEnum.READ_ONLY)
ANALYST = _user(RoleEnum.GOVERNMENT, RoleEnum.ANALYST)
MANAGER = _user(RoleEnum.GOVERNMENT, RoleEnum.COMPLIANCE_MANAGER)
DIRECTOR = _user(RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR)


def _status_code(user, current, requested):
    try:
        ensure_report_transition(user, _report(current), requested)
    except HTTPException as exc:
        return exc.status_code
    return 200


@pytest.mark.parametrize(
    "user, current, requested",
    [
        (SIGNER, S.Draft, S.Submitted.value),
        (ANALYST, S.Submitted, S.Recommended_by_analyst.value),
        (DIRECTOR, S.Submitted, S.Recommended_by_analyst.value),
        (ANALYST, S.Analyst_adjustment, S.Recommended_by_analyst.value),
        (ANALYST, S.Submitted, RETURN_TO_SUPPLIER),
        (MANAGER, S.Recommended_by_analyst, S.Recommended_by_manager.value),
        (MANAGER, S.Recommended_by_analyst, RETURN_TO_ANALYST),
        (DIRECTOR, S.Recommended_by_manager, S.Assessed.value),
        (DIRECTOR, S.Analyst_adjustment, S.Assessed.value),
        (DIRECTOR, S.Recommended_by_manager, RETURN_TO_MANAGER),
        # Saves that keep the status.
        (REPORTER, S.Draft, S.Draft.value),
        (ANALYST, S.Submitted, S.Submitted.value),
        (MANAGER, S.Recommended_by_analyst, S.Recommended_by_analyst.value),
        (DIRECTOR, S.Recommended_by_manager, S.Recommended_by_manager.value),
    ],
)
def test_moves_the_report_page_offers_are_allowed(user, current, requested):
    assert _status_code(user, current, requested) == 200


@pytest.mark.parametrize(
    "user, current, requested",
    [
        # A supplier cannot return its own report, or reopen it as a draft.
        (SIGNER, S.Assessed, RETURN_TO_SUPPLIER),
        (SIGNER, S.Submitted, RETURN_TO_ANALYST),
        (SIGNER, S.Submitted, RETURN_TO_MANAGER),
        (SIGNER, S.Assessed, S.Draft.value),
        (SIGNER, S.Submitted, S.Draft.value),
        # Only a signing authority submits.
        (REPORTER, S.Draft, S.Submitted.value),
        (READ_ONLY, S.Draft, S.Draft.value),
        # A report already assessed stays assessed.
        (ANALYST, S.Assessed, RETURN_TO_SUPPLIER),
        (DIRECTOR, S.Assessed, S.Assessed.value),
        (DIRECTOR, S.Exempted, RETURN_TO_MANAGER),
        # Government steps keep their order and their roles.
        (ANALYST, S.Submitted, S.Assessed.value),
        (ANALYST, S.Recommended_by_analyst, S.Recommended_by_manager.value),
        (MANAGER, S.Submitted, S.Recommended_by_analyst.value),
        (MANAGER, S.Recommended_by_manager, S.Assessed.value),
        (DIRECTOR, S.Submitted, S.Assessed.value),
        (ANALYST, S.Recommended_by_analyst, RETURN_TO_ANALYST),
        (ANALYST, S.Draft, S.Draft.value),
        # No route moves a report to Analyst adjustment by status alone.
        (ANALYST, S.Submitted, S.Analyst_adjustment.value),
        (ANALYST, S.Submitted, "Not a status"),
    ],
)
def test_moves_outside_the_table_are_refused(user, current, requested):
    assert _status_code(user, current, requested) == 403


@pytest.mark.parametrize(
    "user, current, expected",
    [
        (REPORTER, S.Draft, True),
        (SIGNER, S.Draft, True),
        (READ_ONLY, S.Draft, False),
        (REPORTER, S.Submitted, False),
        (ANALYST, S.Analyst_adjustment, True),
        (ANALYST, S.Submitted, False),
        (DIRECTOR, S.Recommended_by_manager, False),
    ],
)
def test_who_edits_summary_lines(user, current, expected):
    assert can_edit_summary(user, _report(current)) is expected


@pytest.mark.parametrize(
    "user, current, expected",
    [
        (DIRECTOR, S.Recommended_by_analyst, True),
        (DIRECTOR, S.Recommended_by_manager, True),
        (DIRECTOR, S.Assessed, False),
        (ANALYST, S.Recommended_by_manager, False),
        (SIGNER, S.Draft, False),
    ],
)
def test_who_overrides_the_penalty(user, current, expected):
    assert can_override_penalty(user, _report(current)) is expected
