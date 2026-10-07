"""Compliance-report search definition."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.compliance.ComplianceReportListView import ComplianceReportListView
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
    fields = [
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
    match_context = match_context_expression(fields, query)
    clause, score = search_clause(fields, query)
    if clause is None and query.numeric_id is not None:
        clause = view.compliance_report_id == query.numeric_id
    if query.text and clause is None:
        return []

    statement = select(view, match_context).where(view.is_latest.is_(True))
    statement = where_present(
        statement,
        clause,
        equals_any(view.report_status, query.values("status")),
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
        analyst = " ".join(
            value
            for value in (
                report.assigned_analyst_first_name,
                report.assigned_analyst_last_name,
            )
            if value
        )
        meta = [report.report_type] if report.report_type else []
        details: list[SearchResultDetail] = []
        if report.report_type:
            details.append(
                SearchResultDetail(label="Report type", value=report.report_type)
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
                status=report.report_status.value if report.report_status else None,
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
