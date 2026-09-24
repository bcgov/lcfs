"""Organization search definition."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.organization.OrganizationAddress import OrganizationAddress
from lcfs.db.models.organization.OrganizationStatus import OrganizationStatus
from lcfs.db.models.organization.OrganizationType import OrganizationType
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
    relevance_rank,
    search_clause,
    text_expression,
)
from lcfs.web.api.search.schema import SearchResultDetail, SearchResultItem

ENTITY_TYPE = "organization"
SUPPORTED_FILTERS = {"status"}


async def search_organizations(
    db: AsyncSession, context: SearchContext
) -> list[SearchResultItem]:
    """Search organizations visible to a government caller."""
    query = context.query
    if not context.is_government or not applies(query, SUPPORTED_FILTERS, ENTITY_TYPE):
        return []

    address = aliased(OrganizationAddress)
    status = aliased(OrganizationStatus)
    organization_type = aliased(OrganizationType)
    fields = [
        SearchField("Organization", Organization.name, primary=True, fuzzy=True),
        SearchField("Organization ID", Organization.organization_id, primary=True),
        SearchField(
            "Operating name", Organization.operating_name, primary=True, fuzzy=True
        ),
        SearchField("Organization code", Organization.organization_code, primary=True),
        SearchField("City", address.city, primary=True),
        SearchField("Province/state", address.province_state, primary=True),
        SearchField("Status", text_expression(status.status), primary=True),
        SearchField("Email", Organization.email),
        SearchField("Phone", Organization.phone),
        SearchField("Contact", Organization.contact_name),
        SearchField("EDRMS record", Organization.edrms_record),
        SearchField("Records address", Organization.records_address),
        SearchField("Credit market contact", Organization.credit_market_contact_name),
        SearchField("Credit market email", Organization.credit_market_contact_email),
        SearchField("Street address", address.street_address),
        SearchField("Country", address.country),
        SearchField("Postal code", address.postalCode_zipCode),
        SearchField("Organization type", organization_type.org_type),
    ]
    match_context = match_context_expression(fields, query)
    clause, score = search_clause(fields, query)
    if clause is None and query.numeric_id is not None:
        clause = Organization.organization_id == query.numeric_id
    if query.text and clause is None:
        return []

    statement = (
        select(Organization, address, status, match_context)
        .outerjoin(
            address,
            Organization.organization_address_id == address.organization_address_id,
        )
        .outerjoin(
            status,
            Organization.organization_status_id == status.organization_status_id,
        )
        .outerjoin(
            organization_type,
            Organization.organization_type_id == organization_type.organization_type_id,
        )
    )
    statement = where_present(
        statement,
        clause,
        equals_any(status.status, query.values("status")),
    )
    if score is not None:
        statement = statement.order_by(score.desc())
    statement = statement.order_by(
        relevance_rank(Organization.name, query).desc(), Organization.name
    ).limit(RESULT_LIMIT)

    rows = (await db.execute(statement)).all()
    results = []
    for organization, organization_address, organization_status, matched_value in rows:
        location = ", ".join(
            value
            for value in (
                getattr(organization_address, "city", None),
                getattr(organization_address, "province_state", None),
            )
            if value
        )
        details: list[SearchResultDetail] = []
        if organization.operating_name:
            details.append(
                SearchResultDetail(
                    label="Operating name", value=organization.operating_name
                )
            )
        elif organization.organization_code:
            details.append(
                SearchResultDetail(
                    label="Organization code", value=organization.organization_code
                )
            )
        if location:
            details.append(SearchResultDetail(label="Location", value=location))
        results.append(
            SearchResultItem(
                entity_type=ENTITY_TYPE,
                entity_id=organization.organization_id,
                title=organization.name,
                subtitle=(
                    organization.operating_name or organization.organization_code or ""
                ),
                route=f"/organizations/{organization.organization_id}",
                status=(
                    organization_status.status.value
                    if organization_status and organization_status.status
                    else None
                ),
                meta=location or None,
                match_context=matched_value or None,
                details=details,
            )
        )
    return results


ENTITY = EntitySearch(
    entity_type=ENTITY_TYPE,
    label="Organizations",
    handler=search_organizations,
)
