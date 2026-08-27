"""Fuel-code search definition."""

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelCodeListView import FuelCodeListView
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.web.api.search.entities.base import (
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
    relevance_rank,
    search_clause,
    starts_with_any,
)
from lcfs.web.api.search.schema import SearchResultDetail, SearchResultItem

ENTITY_TYPE = "fuel_code"
SUPPORTED_FILTERS = {"status", "year"}
FUEL_CODE_RESULT_LIMIT = 100


def _visibility_scope(context: SearchContext):
    """Limit BCeID results to owned fuel codes and public approved records."""
    if context.is_government:
        return None

    approved = (
        cast(FuelCodeListView.status, String) == FuelCodeStatusEnum.Approved.value
    )
    if context.organization_id is None:
        return approved

    owned_fuel_code_ids = select(FuelCode.fuel_code_id).where(
        FuelCode.organization_id == context.organization_id
    )
    return or_(
        FuelCodeListView.fuel_code_id.in_(owned_fuel_code_ids),
        approved,
    )


async def search_fuel_codes(
    db: AsyncSession, context: SearchContext
) -> list[SearchResultItem]:
    """Search fuel-code list-view records."""
    query = context.query
    if not applies(query, SUPPORTED_FILTERS, ENTITY_TYPE):
        return []

    view = FuelCodeListView
    code = view.prefix + view.fuel_suffix
    fields = [
        SearchField("Fuel code", code, primary=True, fuzzy=True),
        SearchField("Company", view.company, primary=True, fuzzy=True),
        SearchField("Fuel type", view.fuel_type, primary=True),
        SearchField("Feedstock", view.feedstock, primary=True),
        SearchField("Status", view.status, primary=True),
        SearchField("Facility city", view.fuel_production_facility_city, primary=True),
        SearchField("Feedstock location", view.feedstock_location, primary=True),
        SearchField("Feedstock details", view.feedstock_misc),
        SearchField("Province/state", view.fuel_production_facility_province_state),
        SearchField("Country", view.fuel_production_facility_country),
        SearchField("Contact name", view.contact_name),
        SearchField("Contact email", view.contact_email),
        SearchField("Former company", view.former_company),
        SearchField("Notes", view.notes),
        SearchField("EDRMS record", view.edrms),
        SearchField("Carbon intensity", view.carbon_intensity),
        SearchField("Approval date", date_text_expression(view.approval_date)),
        SearchField("Effective date", date_text_expression(view.effective_date)),
        SearchField(
            "Finished fuel transport",
            func.array_to_string(view.finished_fuel_transport_modes, " "),
        ),
        SearchField(
            "Feedstock transport",
            func.array_to_string(view.feedstock_fuel_transport_modes, " "),
        ),
    ]
    match_context = match_context_expression(fields, query)
    clause, score = search_clause(fields, query)
    if clause is None and query.is_id_only:
        clause = starts_with_any(view.fuel_suffix, query.terms)
    if query.text and clause is None:
        return []

    statement = where_present(
        select(view, match_context),
        clause,
        _visibility_scope(context),
        equals_any(view.status, query.values("status")),
        date_years(view.approval_date, query.values("year")),
    )
    if score is not None:
        statement = statement.order_by(score.desc())
    statement = statement.order_by(
        relevance_rank(code, query).desc(), view.fuel_suffix
    ).limit(FUEL_CODE_RESULT_LIMIT)

    rows = (await db.execute(statement)).all()
    results = []
    for fuel_code, matched_value in rows:
        meta = []
        details: list[SearchResultDetail] = []
        if fuel_code.company:
            details.append(SearchResultDetail(label="Company", value=fuel_code.company))
        if fuel_code.fuel_type:
            details.append(
                SearchResultDetail(label="Fuel type", value=fuel_code.fuel_type)
            )
        if fuel_code.carbon_intensity is not None:
            meta.append(f"CI {fuel_code.carbon_intensity}")
            details.append(
                SearchResultDetail(
                    label="Carbon intensity", value=str(fuel_code.carbon_intensity)
                )
            )
        if fuel_code.feedstock:
            meta.append(fuel_code.feedstock)
            details.append(
                SearchResultDetail(label="Feedstock", value=fuel_code.feedstock)
            )
        if fuel_code.fuel_production_facility_city:
            meta.append(fuel_code.fuel_production_facility_city)
            details.append(
                SearchResultDetail(
                    label="Facility",
                    value=fuel_code.fuel_production_facility_city,
                )
            )
        results.append(
            SearchResultItem(
                entity_type=ENTITY_TYPE,
                entity_id=fuel_code.fuel_code_id,
                title=f"{fuel_code.prefix}{fuel_code.fuel_suffix}",
                subtitle=(
                    f"{fuel_code.company or ''} · {fuel_code.fuel_type or ''}"
                ).strip(" ·"),
                route=f"/fuel-codes/{fuel_code.fuel_code_id}/view",
                status=fuel_code.status,
                meta=" · ".join(meta) or None,
                match_context=matched_value or None,
                details=details,
            )
        )
    return results


ENTITY = EntitySearch(
    entity_type=ENTITY_TYPE,
    label="Fuel codes",
    handler=search_fuel_codes,
)
