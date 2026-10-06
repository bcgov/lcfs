"""Administrative-adjustment search definition."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.admin_adjustment.AdminAdjustment import AdminAdjustment
from lcfs.db.models.admin_adjustment.AdminAdjustmentStatus import AdminAdjustmentStatus
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

ENTITY_TYPE = "admin_adjustment"
SUPPORTED_FILTERS = {"status", "year"}


async def search_admin_adjustments(
    db: AsyncSession, context: SearchContext
) -> list[SearchResultItem]:
    """Search administrative adjustments visible to the caller."""
    query = context.query
    if not context.can_access_organization_records or not applies(
        query, SUPPORTED_FILTERS, ENTITY_TYPE
    ):
        return []

    fields = [
        SearchField("Organization", Organization.name, primary=True, fuzzy=True),
        SearchField("Adjustment ID", AdminAdjustment.admin_adjustment_id, primary=True),
        SearchField("Status", AdminAdjustmentStatus.status, primary=True),
        SearchField("Compliance units", AdminAdjustment.compliance_units),
        SearchField("Government comment", AdminAdjustment.gov_comment),
        SearchField(
            "Effective date",
            date_text_expression(AdminAdjustment.transaction_effective_date),
        ),
    ]
    match_context = match_context_expression(fields, query)
    clause, score = search_clause(fields, query)
    if clause is None and query.numeric_id is not None:
        clause = AdminAdjustment.admin_adjustment_id == query.numeric_id
    if query.text and clause is None:
        return []

    statement = (
        select(
            AdminAdjustment.admin_adjustment_id,
            AdminAdjustment.compliance_units,
            Organization.name.label("org_name"),
            AdminAdjustmentStatus.status.label("status"),
            match_context,
        )
        .join(
            Organization,
            AdminAdjustment.to_organization_id == Organization.organization_id,
        )
        .join(
            AdminAdjustmentStatus,
            AdminAdjustment.current_status_id
            == AdminAdjustmentStatus.admin_adjustment_status_id,
        )
    )
    statement = where_present(
        statement,
        clause,
        equals_any(AdminAdjustmentStatus.status, query.values("status")),
        date_years(AdminAdjustment.transaction_effective_date, query.values("year")),
        (
            AdminAdjustment.to_organization_id == context.organization_id
            if not context.is_government and context.organization_id is not None
            else None
        ),
    )
    if score is not None:
        statement = statement.order_by(score.desc())
    statement = statement.order_by(AdminAdjustment.admin_adjustment_id.desc()).limit(
        RESULT_LIMIT
    )

    rows = (await db.execute(statement)).all()
    results = []
    for adjustment in rows:
        route_prefix = "" if context.is_government else "org-"
        details: list[SearchResultDetail] = []
        if adjustment.org_name:
            details.append(
                SearchResultDetail(label="Organization", value=adjustment.org_name)
            )
        if adjustment.compliance_units is not None:
            details.append(
                SearchResultDetail(
                    label="Compliance units",
                    value=f"{adjustment.compliance_units:,}",
                )
            )
        results.append(
            SearchResultItem(
                entity_type=ENTITY_TYPE,
                entity_id=adjustment.admin_adjustment_id,
                title=(f"Administrative Adjustment #{adjustment.admin_adjustment_id}"),
                subtitle=adjustment.org_name or "",
                route=(
                    f"/{route_prefix}admin-adjustment/"
                    f"{adjustment.admin_adjustment_id}"
                ),
                status=adjustment.status.value if adjustment.status else None,
                meta=(
                    f"{adjustment.compliance_units:,} units"
                    if adjustment.compliance_units is not None
                    else None
                ),
                match_context=adjustment.match_context or None,
                details=details,
            )
        )
    return results


ENTITY = EntitySearch(
    entity_type=ENTITY_TYPE,
    label="Administrative adjustments",
    handler=search_admin_adjustments,
)
