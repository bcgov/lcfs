"""Compliance-report search definition."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.compliance.ComplianceReportListView import ComplianceReportListView
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.web.api.search.entities.base import (
    RESULT_LIMIT,
    EntitySearch,
    SearchContext,
    where_present,
)
from lcfs.web.api.search.matching import (
    SearchField,
    applies,
    equals_any,
    match_context_expression,
    search_clause,
    starts_with_any,
    text_expression,
)
from lcfs.web.api.search.schema import SearchResultDetail, SearchResultItem

ENTITY_TYPE = "report"
SUPPORTED_FILTERS = {"status", "year"}

# DB-level status values that must never be shown to BCeID (supplier) users.
# Every record in one of these states is displayed as "Submitted" on all
# supplier-facing pages (mirrors ComplianceReportServices._mask_report_status).
_SUPPLIER_MASKED_STATUS_VALUES: frozenset[str] = frozenset(
    {
        ComplianceReportStatusEnum.Recommended_by_analyst.value,
        ComplianceReportStatusEnum.Recommended_by_manager.value,
        ComplianceReportStatusEnum.Analyst_adjustment.value,
        ComplianceReportStatusEnum.Analyst_adjustment.underscore_value(),
    }
)
_SUBMITTED_VALUE = ComplianceReportStatusEnum.Submitted.value

# Field labels that must not be included in supplier-facing searches.
# Exposing them would allow a supplier to discover: who the assigned analyst
# is, or what draft assessment text the analyst has written.
_SUPPLIER_EXCLUDED_FIELD_LABELS: frozenset[str] = frozenset(
    {"Analyst first name", "Analyst last name", "Assessment statement"}
)


def _effective_status_values_for_supplier(
    raw_values: tuple[str, ...],
) -> tuple[str, ...]:
    """
    Translate a BCeID-supplied status filter into actual DB-level values.

    - Any name that belongs to an internal-only status is silently dropped:
      the supplier should not know those states exist.
    - If "Submitted" is requested it is expanded to include every status
      that is *displayed* as "Submitted" to suppliers, so the filter
      keeps working correctly after the status-masking step.
    """
    masked_casefold = frozenset(v.casefold() for v in _SUPPLIER_MASKED_STATUS_VALUES)
    wants_submitted = any(
        v.strip().casefold() == _SUBMITTED_VALUE.casefold() for v in raw_values
    )
    # Drop any value whose casefolded form is an internal-only status name.
    safe = [v for v in raw_values if v.strip().casefold() not in masked_casefold]
    if wants_submitted:
        # Include the real "Submitted" value plus every masked equivalent so
        # the supplier's "submitted" filter returns all visible records.
        safe = [v for v in safe if v.strip().casefold() != _SUBMITTED_VALUE.casefold()]
        safe.append(_SUBMITTED_VALUE)
        safe.extend(_SUPPLIER_MASKED_STATUS_VALUES)
    return tuple(safe)


async def search_compliance_reports(
    db: AsyncSession, context: SearchContext
) -> list[SearchResultItem]:
    """Search the latest compliance-report revisions visible to the caller."""
    query = context.query
    if not context.can_access_organization_records or not applies(
        query, SUPPORTED_FILTERS, ENTITY_TYPE
    ):
        return []

    view = ComplianceReportListView
    all_fields = [
        SearchField("Organization", view.organization_name, primary=True, fuzzy=True),
        SearchField("Compliance period", view.compliance_period, primary=True),
        SearchField("Report type", view.report_type, primary=True),
        SearchField("Status", text_expression(view.report_status), primary=True),
        SearchField("Report ID", view.compliance_report_id, primary=True),
        SearchField(
            "Analyst first name", view.assigned_analyst_first_name, primary=True
        ),
        SearchField("Analyst last name", view.assigned_analyst_last_name, primary=True),
        SearchField("Supplemental initiator", view.supplemental_initiator),
        SearchField("Reporting frequency", view.reporting_frequency),
        SearchField("Assessment statement", view.assessment_statement),
        SearchField("Legacy ID", view.legacy_id),
    ]
    # Government-only fields are removed for supplier queries so that
    # sensitive data is neither matched against nor echoed in match_context.
    fields = (
        all_fields
        if context.is_government
        else [
            f
            for f in all_fields
            if f.label not in _SUPPLIER_EXCLUDED_FIELD_LABELS
        ]
    )

    match_context = match_context_expression(fields, query)
    clause, score = search_clause(fields, query)
    if clause is None and query.numeric_id is not None:
        clause = view.compliance_report_id == query.numeric_id
    if query.text and clause is None:
        return []

    # For non-government callers, translate the status filter so that
    # searching for "submitted" also surfaces records in masked internal
    # states, and searching for an internal-only status name yields nothing.
    status_values = query.values("status")
    if not context.is_government and status_values:
        status_values = _effective_status_values_for_supplier(status_values)

    statement = select(view, match_context).where(view.is_latest.is_(True))
    statement = where_present(
        statement,
        clause,
        equals_any(view.report_status, status_values),
        starts_with_any(view.compliance_period, query.values("year")),
        (
            view.organization_id == context.organization_id
            if context.organization_id is not None
            else None
        ),
    )
    if score is not None:
        statement = statement.order_by(score.desc())
    statement = statement.order_by(view.update_date.desc()).limit(RESULT_LIMIT)

    rows = (await db.execute(statement)).all()
    results = []
    for report, matched_value in rows:
        # Mask internal workflow statuses for BCeID users (mirrors
        # ComplianceReportServices._mask_report_status).
        if report.report_status is not None:
            raw_status = report.report_status.value
            displayed_status = (
                _SUBMITTED_VALUE
                if not context.is_government
                and raw_status in _SUPPLIER_MASKED_STATUS_VALUES
                else raw_status
            )
        else:
            displayed_status = None

        meta = [report.report_type] if report.report_type else []
        details: list[SearchResultDetail] = []
        if report.report_type:
            details.append(
                SearchResultDetail(label="Report type", value=report.report_type)
            )
        # Analyst assignment is a government-internal field; never expose it
        # to supplier users.
        if context.is_government:
            analyst = " ".join(
                value
                for value in (
                    report.assigned_analyst_first_name,
                    report.assigned_analyst_last_name,
                )
                if value
            )
            if analyst:
                meta.append(f"Analyst: {analyst}")
                details.append(SearchResultDetail(label="Analyst", value=analyst))
        results.append(
            SearchResultItem(
                entity_type=ENTITY_TYPE,
                entity_id=report.compliance_report_id,
                title=f"{report.organization_name} — {report.compliance_period}",
                subtitle=report.report_type or "",
                route=(
                    f"/compliance-reporting/{report.compliance_period}/"
                    f"{report.compliance_report_id}"
                ),
                status=displayed_status,
                meta=" · ".join(meta) or None,
                match_context=matched_value or None,
                details=details,
            )
        )
    return results


ENTITY = EntitySearch(
    entity_type=ENTITY_TYPE,
    label="Compliance reports",
    handler=search_compliance_reports,
)
