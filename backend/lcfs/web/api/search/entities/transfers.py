"""Transfer search definition."""

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.transfer.TransferCategory import TransferCategory
from lcfs.db.models.transfer.TransferComment import TransferComment
from lcfs.db.models.transfer.TransferStatus import TransferStatus
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

ENTITY_TYPE = "transfer"
SUPPORTED_FILTERS = {"status", "year"}


async def search_transfers(
    db: AsyncSession, context: SearchContext
) -> list[SearchResultItem]:
    """Search transfers while enforcing organization visibility."""
    query = context.query
    if not context.can_access_organization_records or not applies(
        query, SUPPORTED_FILTERS, ENTITY_TYPE
    ):
        return []

    from_organization = aliased(Organization, name="from_org")
    to_organization = aliased(Organization, name="to_org")
    comments = (
        select(func.string_agg(TransferComment.comment, " "))
        .where(TransferComment.transfer_id == Transfer.transfer_id)
        .correlate(Transfer)
        .scalar_subquery()
    )
    fields = [
        SearchField(
            "From organization", from_organization.name, primary=True, fuzzy=True
        ),
        SearchField("To organization", to_organization.name, primary=True, fuzzy=True),
        SearchField("Transfer ID", Transfer.transfer_id, primary=True),
        SearchField("Status", TransferStatus.status, primary=True),
        SearchField("Category", TransferCategory.category),
        SearchField("Quantity", Transfer.quantity),
        SearchField("Price per unit", Transfer.price_per_unit),
        SearchField("Agreement date", date_text_expression(Transfer.agreement_date)),
        SearchField(
            "Effective date",
            date_text_expression(Transfer.transaction_effective_date),
        ),
        SearchField("Recommendation", Transfer.recommendation),
        SearchField("Comment", func.coalesce(comments, "")),
    ]
    match_context = match_context_expression(fields, query)
    clause, score = search_clause(fields, query)
    if clause is None and query.numeric_id is not None:
        clause = Transfer.transfer_id == query.numeric_id
    if query.text and clause is None:
        return []

    statement = (
        select(
            Transfer.transfer_id,
            from_organization.name.label("from_name"),
            to_organization.name.label("to_name"),
            TransferStatus.status.label("status"),
            Transfer.quantity,
            Transfer.price_per_unit,
            Transfer.agreement_date,
            match_context,
        )
        .join(
            from_organization,
            Transfer.from_organization_id == from_organization.organization_id,
        )
        .join(
            to_organization,
            Transfer.to_organization_id == to_organization.organization_id,
        )
        .join(
            TransferStatus,
            Transfer.current_status_id == TransferStatus.transfer_status_id,
        )
        .outerjoin(
            TransferCategory,
            Transfer.transfer_category_id == TransferCategory.transfer_category_id,
        )
    )
    organization_scope = None
    if not context.is_government and context.organization_id is not None:
        organization_scope = or_(
            Transfer.from_organization_id == context.organization_id,
            Transfer.to_organization_id == context.organization_id,
        )
    statement = where_present(
        statement,
        clause,
        equals_any(TransferStatus.status, query.values("status")),
        date_years(Transfer.agreement_date, query.values("year")),
        organization_scope,
    )
    if score is not None:
        statement = statement.order_by(score.desc())
    statement = statement.order_by(Transfer.transfer_id.desc()).limit(RESULT_LIMIT)

    rows = (await db.execute(statement)).all()
    results = []
    for transfer in rows:
        meta = []
        details = [
            SearchResultDetail(label="Transfer ID", value=str(transfer.transfer_id))
        ]
        if transfer.quantity is not None:
            meta.append(f"{transfer.quantity:,} units")
            details.append(
                SearchResultDetail(
                    label="Quantity", value=f"{transfer.quantity:,} units"
                )
            )
        if transfer.price_per_unit is not None:
            meta.append(f"${transfer.price_per_unit:,.2f}/unit")
            details.append(
                SearchResultDetail(
                    label="Unit price", value=f"${transfer.price_per_unit:,.2f}"
                )
            )
        if transfer.agreement_date:
            formatted_date = transfer.agreement_date.strftime("%Y-%m-%d")
            meta.append(formatted_date)
            details.append(
                SearchResultDetail(label="Agreement date", value=formatted_date)
            )
        results.append(
            SearchResultItem(
                entity_type=ENTITY_TYPE,
                entity_id=transfer.transfer_id,
                title=f"{transfer.from_name} → {transfer.to_name}",
                subtitle=f"Transfer #{transfer.transfer_id}",
                route=f"/transfers/{transfer.transfer_id}",
                status=transfer.status.value if transfer.status else None,
                meta=" · ".join(meta) or None,
                match_context=transfer.match_context or None,
                details=details,
            )
        )
    return results


ENTITY = EntitySearch(
    entity_type=ENTITY_TYPE,
    label="Transfers",
    handler=search_transfers,
)
