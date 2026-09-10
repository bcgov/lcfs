"""Initiative-agreement search definition."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatus,
)
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

ENTITY_TYPE = "initiative_agreement"
SUPPORTED_FILTERS = {"status", "year"}


async def search_initiative_agreements(
    db: AsyncSession, context: SearchContext
) -> list[SearchResultItem]:
    """Search initiative agreements visible to the caller."""
    query = context.query
    if not context.can_access_organization_records or not applies(
        query, SUPPORTED_FILTERS, ENTITY_TYPE
    ):
        return []

    fields = [
        SearchField("Organization", Organization.name, primary=True, fuzzy=True),
        SearchField(
            "Initiative agreement ID",
            InitiativeAgreement.initiative_agreement_id,
            primary=True,
        ),
        SearchField("Status", InitiativeAgreementStatus.status, primary=True),
        SearchField("Compliance units", InitiativeAgreement.compliance_units),
        SearchField("Government comment", InitiativeAgreement.gov_comment),
        SearchField(
            "Effective date",
            date_text_expression(InitiativeAgreement.transaction_effective_date),
        ),
    ]
    match_context = match_context_expression(fields, query)
    clause, score = search_clause(fields, query)
    if clause is None and query.numeric_id is not None:
        clause = InitiativeAgreement.initiative_agreement_id == query.numeric_id
    if query.text and clause is None:
        return []

    statement = (
        select(
            InitiativeAgreement.initiative_agreement_id,
            InitiativeAgreement.compliance_units,
            Organization.name.label("org_name"),
            InitiativeAgreementStatus.status.label("status"),
            match_context,
        )
        .join(
            Organization,
            InitiativeAgreement.to_organization_id == Organization.organization_id,
        )
        .join(
            InitiativeAgreementStatus,
            InitiativeAgreement.current_status_id
            == InitiativeAgreementStatus.initiative_agreement_status_id,
        )
    )
    statement = where_present(
        statement,
        clause,
        equals_any(InitiativeAgreementStatus.status, query.values("status")),
        date_years(
            InitiativeAgreement.transaction_effective_date, query.values("year")
        ),
        (
            InitiativeAgreement.to_organization_id == context.organization_id
            if not context.is_government and context.organization_id is not None
            else None
        ),
    )
    if score is not None:
        statement = statement.order_by(score.desc())
    statement = statement.order_by(
        InitiativeAgreement.initiative_agreement_id.desc()
    ).limit(RESULT_LIMIT)

    rows = (await db.execute(statement)).all()
    results = []
    for agreement in rows:
        route_prefix = "" if context.is_government else "org-"
        details: list[SearchResultDetail] = []
        if agreement.org_name:
            details.append(
                SearchResultDetail(label="Organization", value=agreement.org_name)
            )
        if agreement.compliance_units is not None:
            details.append(
                SearchResultDetail(
                    label="Compliance units", value=f"{agreement.compliance_units:,}"
                )
            )
        results.append(
            SearchResultItem(
                entity_type=ENTITY_TYPE,
                entity_id=agreement.initiative_agreement_id,
                title=f"Initiative Agreement #{agreement.initiative_agreement_id}",
                subtitle=agreement.org_name or "",
                route=(
                    f"/{route_prefix}initiative-agreement/"
                    f"{agreement.initiative_agreement_id}"
                ),
                status=agreement.status.value if agreement.status else None,
                meta=(
                    f"{agreement.compliance_units:,} units"
                    if agreement.compliance_units is not None
                    else None
                ),
                match_context=agreement.match_context or None,
                details=details,
            )
        )
    return results


ENTITY = EntitySearch(
    entity_type=ENTITY_TYPE,
    label="Initiative agreements",
    handler=search_initiative_agreements,
)
