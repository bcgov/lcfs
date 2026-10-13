"""Transfer search definition."""

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.transfer.TransferCategory import TransferCategory
from lcfs.db.models.transfer.TransferComment import TransferComment
from lcfs.db.models.transfer.TransferStatus import TransferStatus, TransferStatusEnum
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
    text_expression,
)
from lcfs.web.api.search.schema import SearchResultDetail, SearchResultItem

ENTITY_TYPE = "transfer"
SUPPORTED_FILTERS = {"status", "year"}

# Transfer statuses shown as "Submitted" to BCeID users (mirrors the
# status-masking logic in TransferService).
_SUPPLIER_MASKED_TRANSFER_STATUSES: frozenset[str] = frozenset(
    {TransferStatusEnum.Recommended.value}
)
_TRANSFER_SUBMITTED_VALUE = TransferStatusEnum.Submitted.value

# Analyst-only fields that must not be searched or echoed to suppliers.
_SUPPLIER_EXCLUDED_TRANSFER_FIELDS: frozenset[str] = frozenset({"Recommendation"})


def _effective_transfer_status_values_for_supplier(
    raw_values: tuple[str, ...],
) -> tuple[str, ...]:
    """
    For BCeID users: drop internal-only status names and expand
    "Submitted" to also match the Recommended internal state, so the
    filter keeps working after the status-masking step.
    """
    masked_casefold = frozenset(
        v.casefold() for v in _SUPPLIER_MASKED_TRANSFER_STATUSES
    )
    wants_submitted = any(
        v.strip().casefold() == _TRANSFER_SUBMITTED_VALUE.casefold()
        for v in raw_values
    )
    safe = [v for v in raw_values if v.strip().casefold() not in masked_casefold]
    if wants_submitted:
        safe = [
            v
            for v in safe
            if v.strip().casefold() != _TRANSFER_SUBMITTED_VALUE.casefold()
        ]
        safe.append(_TRANSFER_SUBMITTED_VALUE)
        safe.extend(_SUPPLIER_MASKED_TRANSFER_STATUSES)
    return tuple(safe)


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
    # Suppliers see Recommended as "Submitted", so match and echo that
    # instead of the raw internal status.
    status_text = text_expression(TransferStatus.status)
    supplier_status_text = case(
        (
            status_text.in_(sorted(_SUPPLIER_MASKED_TRANSFER_STATUSES)),
            _TRANSFER_SUBMITTED_VALUE,
        ),
        else_=status_text,
    )
    all_fields = [
        SearchField(
            "From organization", from_organization.name, primary=True, fuzzy=True
        ),
        SearchField("To organization", to_organization.name, primary=True, fuzzy=True),
        SearchField("Transfer ID", Transfer.transfer_id, primary=True),
        SearchField(
            "Status",
            status_text if context.is_government else supplier_status_text,
            primary=True,
        ),
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
    # The Recommendation field contains analyst-only information; strip it
    # for suppliers so it is neither searched nor echoed in match_context.
    fields = (
        all_fields
        if context.is_government
        else [
            f
            for f in all_fields
            if f.label not in _SUPPLIER_EXCLUDED_TRANSFER_FIELDS
        ]
    )
    match_context = match_context_expression(fields, query)
    clause, score = search_clause(fields, query)
    if clause is None and query.numeric_id is not None:
        clause = Transfer.transfer_id == query.numeric_id
    if query.text and clause is None:
        return []

    # For non-government callers, expand "submitted" to include Recommended
    # and strip any direct references to internal-only status names.
    status_values = query.values("status")
    if not context.is_government and status_values:
        status_values = _effective_transfer_status_values_for_supplier(status_values)
        if not status_values:
            # Only internal-only statuses were requested; an empty filter
            # would otherwise be treated as "no status restriction".
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
        equals_any(TransferStatus.status, status_values),
        date_years(Transfer.agreement_date, query.values("year")),
        organization_scope,
    )
    if score is not None:
        statement = statement.order_by(score.desc())
    statement = statement.order_by(Transfer.transfer_id.desc()).limit(RESULT_LIMIT)

    rows = (await db.execute(statement)).all()
    results = []
    for transfer in rows:
        # Mask Recommended status as Submitted for BCeID users (mirrors
        # the masking applied in TransferService).
        status_value = transfer.status
        if status_value is not None:
            displayed_status = (
                _TRANSFER_SUBMITTED_VALUE
                if not context.is_government
                and status_value.value in _SUPPLIER_MASKED_TRANSFER_STATUSES
                else status_value.value
            )
        else:
            displayed_status = None

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
                status=displayed_status,
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
