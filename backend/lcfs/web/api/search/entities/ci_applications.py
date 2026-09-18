"""Carbon-intensity application search definition."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.ci_application.CIApplication import CIApplication
from lcfs.db.models.ci_application.CIApplicationStatus import CIApplicationStatus
from lcfs.db.models.organization.Organization import Organization
from lcfs.web.api.search.entities.base import (
    RESULT_LIMIT,
    EntitySearch,
    SearchContext,
    where_present,
)
from lcfs.web.api.search.matching import (
    SearchField,
    applies,
    date_text_expression,
    date_years,
    equals_any,
    match_context_expression,
    search_clause,
)
from lcfs.web.api.search.schema import SearchResultDetail, SearchResultItem

ENTITY_TYPE = "ci_application"
SUPPORTED_FILTERS = {"status", "year"}


async def search_ci_applications(
    db: AsyncSession, context: SearchContext
) -> list[SearchResultItem]:
    """Search CI applications while enforcing organization visibility."""
    query = context.query
    if not context.can_access_organization_records or not applies(
        query, SUPPORTED_FILTERS, ENTITY_TYPE
    ):
        return []

    fields = [
        SearchField("Organization", Organization.name, primary=True, fuzzy=True),
        SearchField("Application ID", CIApplication.ci_application_id, primary=True),
        SearchField("Status", CIApplicationStatus.status, primary=True),
        SearchField("Facility city", CIApplication.facility_city, primary=True),
        SearchField("Province/state", CIApplication.facility_province_state),
        SearchField("Country", CIApplication.facility_country),
        SearchField("Consultant name", CIApplication.consultant_name),
        SearchField("Consultant company", CIApplication.consultant_company),
        SearchField("Consultant email", CIApplication.consultant_email),
        SearchField("Pathway description", CIApplication.pathway_description),
        SearchField("Verification level", CIApplication.verification_level),
        SearchField("Risk assessment", CIApplication.preliminary_risk_assessment),
        SearchField(
            "Created date",
            date_text_expression(CIApplication.create_date),
            searchable=False,
        ),
    ]
    match_context = match_context_expression(fields, query)
    clause, score = search_clause(fields, query)
    if clause is None and query.numeric_id is not None:
        clause = CIApplication.ci_application_id == query.numeric_id
    if query.text and clause is None:
        return []

    statement = (
        select(
            CIApplication.ci_application_id,
            Organization.name.label("org_name"),
            CIApplicationStatus.status.label("status"),
            CIApplication.facility_city,
            CIApplication.facility_province_state,
            match_context,
        )
        .join(
            Organization,
            CIApplication.organization_id == Organization.organization_id,
        )
        .join(
            CIApplicationStatus,
            CIApplication.status_id == CIApplicationStatus.ci_application_status_id,
        )
    )
    statement = where_present(
        statement,
        clause,
        equals_any(CIApplicationStatus.status, query.values("status")),
        date_years(CIApplication.create_date, query.values("year")),
        (
            CIApplication.organization_id == context.organization_id
            if not context.is_government and context.organization_id is not None
            else None
        ),
    )
    if score is not None:
        statement = statement.order_by(score.desc())
    statement = statement.order_by(CIApplication.ci_application_id.desc()).limit(
        RESULT_LIMIT
    )

    rows = (await db.execute(statement)).all()
    results = []
    for application in rows:
        location = ", ".join(
            value
            for value in (
                application.facility_city,
                application.facility_province_state,
            )
            if value
        )
        details: list[SearchResultDetail] = []
        if application.org_name:
            details.append(
                SearchResultDetail(label="Organization", value=application.org_name)
            )
        if location:
            details.append(SearchResultDetail(label="Facility", value=location))
        results.append(
            SearchResultItem(
                entity_type=ENTITY_TYPE,
                entity_id=application.ci_application_id,
                title=f"CI Application #{application.ci_application_id}",
                subtitle=application.org_name or "",
                route=f"/ci-applications/{application.ci_application_id}",
                status=application.status,
                meta=location or None,
                match_context=application.match_context or None,
                details=details,
            )
        )
    return results


ENTITY = EntitySearch(
    entity_type=ENTITY_TYPE,
    label="CI applications",
    handler=search_ci_applications,
)
