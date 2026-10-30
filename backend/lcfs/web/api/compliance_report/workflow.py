"""Compliance report workflow transitions.

The whole workflow is one declarative table: for each status a request may
ask for, which statuses the report may be in and which roles may ask. It
mirrors the report page's buttons (BUTTON_RULES in the frontend's
buttonConfigs.jsx), so the API refuses what the page would never send.

A request that keeps the current status is a save, not a transition; the
second table says who may save in each status. Assessed and Exempted are
terminal: a supplemental report, which has its own route, is how a report
changes after assessment.

The tables check roles and the stored status only. The view has already
confirmed the caller may reach the report's organization.
"""

from fastapi import HTTPException
from starlette import status

from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.compliance_report.schema import ReturnStatus

Status = ComplianceReportStatusEnum


class ReportTransition:
    """Who may ask for one status, and from where.

    The caller must hold any one of *roles*, and the stored report must be
    in one of *from_statuses*.
    """

    def __init__(self, *, roles, from_statuses):
        self.roles = roles
        self.from_statuses = from_statuses


_ANALYST = (RoleEnum.ANALYST, RoleEnum.DIRECTOR)
_MANAGER = (RoleEnum.COMPLIANCE_MANAGER, RoleEnum.DIRECTOR)
_DIRECTOR = (RoleEnum.DIRECTOR,)

# Keyed by the status the request names. A Return status names the action;
# RETURN_STATUS_MAPPER (and the reassessment rule) says where it lands.
TRANSITIONS = {
    Status.Submitted.value: ReportTransition(
        roles=(RoleEnum.SIGNING_AUTHORITY,), from_statuses=(Status.Draft,)
    ),
    Status.Recommended_by_analyst.value: ReportTransition(
        roles=_ANALYST,
        from_statuses=(Status.Submitted, Status.Analyst_adjustment),
    ),
    Status.Recommended_by_manager.value: ReportTransition(
        roles=_MANAGER, from_statuses=(Status.Recommended_by_analyst,)
    ),
    # A director may assess an analyst adjustment directly; the service then
    # runs the recommend step's work first.
    Status.Assessed.value: ReportTransition(
        roles=_DIRECTOR,
        from_statuses=(Status.Recommended_by_manager, Status.Analyst_adjustment),
    ),
    Status.Exempted.value: ReportTransition(
        roles=_DIRECTOR,
        from_statuses=(Status.Recommended_by_manager, Status.Analyst_adjustment),
    ),
    ReturnStatus.SUPPLIER.value: ReportTransition(
        roles=_ANALYST, from_statuses=(Status.Submitted,)
    ),
    ReturnStatus.ANALYST.value: ReportTransition(
        roles=_MANAGER, from_statuses=(Status.Recommended_by_analyst,)
    ),
    ReturnStatus.MANAGER.value: ReportTransition(
        roles=_DIRECTOR, from_statuses=(Status.Recommended_by_manager,)
    ),
}

_GOVERNMENT_REVIEWERS = (
    RoleEnum.ANALYST,
    RoleEnum.COMPLIANCE_MANAGER,
    RoleEnum.DIRECTOR,
)

# Who may save fields on a report without moving it: the supplier on their
# draft, and government reviewers (assessment statement, exemption and
# non-assessment flags) while it is under review. Which of those fields each
# role may change is a separate, per-field rule.
SAVERS = {
    Status.Draft: (RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY),
    Status.Submitted: _GOVERNMENT_REVIEWERS,
    Status.Analyst_adjustment: _GOVERNMENT_REVIEWERS,
    Status.Recommended_by_analyst: _GOVERNMENT_REVIEWERS,
    Status.Recommended_by_manager: _GOVERNMENT_REVIEWERS,
}

# Who may save summary lines in each status: the people the report page
# lets edit the summary grid then. Everything else on the summary is
# calculated server-side.
SUMMARY_EDITORS = {
    Status.Draft: (RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY),
    Status.Analyst_adjustment: _ANALYST,
}

# The penalty override is the director's, on a report recommended to them.
PENALTY_OVERRIDE_EDITORS = _DIRECTOR
PENALTY_OVERRIDE_STATUSES = (
    Status.Recommended_by_analyst,
    Status.Recommended_by_manager,
)


def _holds_any(user, roles) -> bool:
    return any(role in user.role_names for role in roles)


def _forbidden(detail):
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def ensure_report_transition(user, report, requested_status: str) -> None:
    """Refuse a status request the workflow does not allow from where the
    stored report stands. A request for the current status is a save."""
    current = report.current_status.status if report.current_status else None

    if requested_status == getattr(current, "value", None):
        savers = SAVERS.get(current)
        if savers is None or not _holds_any(user, savers):
            raise _forbidden("This report cannot be changed in its current status.")
        return

    transition = TRANSITIONS.get(requested_status)
    if (
        transition is None
        or current not in transition.from_statuses
        or not _holds_any(user, transition.roles)
    ):
        raise _forbidden("This report cannot move to that status.")


def can_edit_summary(user, report) -> bool:
    current = report.current_status.status if report.current_status else None
    editors = SUMMARY_EDITORS.get(current)
    return editors is not None and _holds_any(user, editors)


def can_override_penalty(user, report) -> bool:
    current = report.current_status.status if report.current_status else None
    return current in PENALTY_OVERRIDE_STATUSES and _holds_any(
        user, PENALTY_OVERRIDE_EDITORS
    )
