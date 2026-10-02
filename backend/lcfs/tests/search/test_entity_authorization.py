from typing import Optional
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.web.api.search.entities import SEARCH_ENTITIES
from lcfs.web.api.search.entities.admin_adjustments import search_admin_adjustments
from lcfs.web.api.search.entities.base import EntitySearch, SearchContext
from lcfs.web.api.search.entities.compliance_reports import (
    _effective_status_values_for_supplier,
    search_compliance_reports,
)
from lcfs.web.api.search.entities.initiative_agreements import (
    search_initiative_agreements,
)
from lcfs.web.api.search.entities.transfers import (
    _effective_transfer_status_values_for_supplier,
    search_transfers,
)
from lcfs.web.api.search.query import parse_query

_ENTITIES = {entity.entity_type: entity for entity in SEARCH_ENTITIES}


def _db_without_rows() -> AsyncMock:
    result = MagicMock()
    result.all.return_value = []
    db = AsyncMock(spec=AsyncSession)
    db.execute.return_value = result
    return db


def _supplier_context(
    entity_type: str,
    organization_id: Optional[int],
) -> SearchContext:
    return SearchContext(
        query=parse_query(entity_type),
        organization_id=organization_id,
        is_government=False,
    )


def _government_context(query_str: str) -> SearchContext:
    return SearchContext(
        query=parse_query(query_str),
        organization_id=None,
        is_government=True,
    )


def _executed_sql(db: AsyncMock) -> str:
    statement = db.execute.await_args.args[0]
    return str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


# ---------------------------------------------------------------------------
# Basic gate-keeping: unbound suppliers and government-only entities
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize(
    "entity",
    [
        _ENTITIES["report"],
        _ENTITIES["transfer"],
        _ENTITIES["ci_application"],
        _ENTITIES["initiative_agreement"],
        _ENTITIES["admin_adjustment"],
        _ENTITIES["user"],
    ],
    ids=lambda entity: entity.entity_type,
)
async def test_unbound_supplier_never_reaches_scoped_queries(entity: EntitySearch):
    db = _db_without_rows()

    results = await entity.execute(db, _supplier_context(entity.entity_type, None))

    assert results == []
    db.execute.assert_not_awaited()


@pytest.mark.anyio
async def test_organization_search_is_government_only():
    db = _db_without_rows()

    results = await _ENTITIES["organization"].execute(
        db,
        _supplier_context("organization", 17),
    )

    assert results == []
    db.execute.assert_not_awaited()


# ---------------------------------------------------------------------------
# Organization scoping
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("entity_type", "expected_scope"),
    [
        ("report", "v_compliance_report.organization_id = 17"),
        ("ci_application", "ci_application.organization_id = 17"),
        (
            "initiative_agreement",
            "initiative_agreement.to_organization_id = 17",
        ),
        ("admin_adjustment", "admin_adjustment.to_organization_id = 17"),
        ("user", "user_profile.organization_id = 17"),
    ],
)
async def test_supplier_queries_include_organization_scope(
    entity_type: str,
    expected_scope: str,
):
    db = _db_without_rows()

    await _ENTITIES[entity_type].execute(db, _supplier_context(entity_type, 17))

    sql = _executed_sql(db)
    assert expected_scope in sql


@pytest.mark.anyio
async def test_supplier_transfer_scope_includes_both_participants():
    db = _db_without_rows()

    await _ENTITIES["transfer"].execute(
        db,
        _supplier_context("transfer", 17),
    )

    sql = _executed_sql(db)
    assert "transfer.from_organization_id = 17" in sql
    assert "transfer.to_organization_id = 17" in sql


# ---------------------------------------------------------------------------
# Admin adjustment: supplier sees only Approved; gov_comment excluded
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_supplier_admin_adjustment_query_restricts_to_approved():
    """Non-government queries must include a hard Approved-status filter."""
    db = _db_without_rows()
    context = SearchContext(
        query=parse_query("admin_adjustment"),
        organization_id=17,
        is_government=False,
    )

    await search_admin_adjustments(db, context)

    sql = _executed_sql(db)
    assert "admin_adjustment_status.status = 'Approved'" in sql


@pytest.mark.anyio
async def test_government_admin_adjustment_query_has_no_approved_restriction():
    """Government queries must NOT have the supplier-only Approved filter."""
    db = _db_without_rows()

    await search_admin_adjustments(db, _government_context("admin_adjustment"))

    sql = _executed_sql(db)
    assert "admin_adjustment_status.status = 'Approved'" not in sql


@pytest.mark.anyio
async def test_supplier_admin_adjustment_query_excludes_gov_comment():
    """gov_comment must not be searchable or echoed for supplier users."""
    db = _db_without_rows()
    context = SearchContext(
        # Use a text query so the match_context expression references fields.
        query=parse_query("example org"),
        organization_id=17,
        is_government=False,
    )

    await search_admin_adjustments(db, context)

    sql = _executed_sql(db)
    assert "admin_adjustment.gov_comment" not in sql


@pytest.mark.anyio
async def test_government_admin_adjustment_query_includes_gov_comment():
    """Government users can search and see gov_comment."""
    db = _db_without_rows()

    await search_admin_adjustments(db, _government_context("example org"))

    sql = _executed_sql(db)
    assert "admin_adjustment.gov_comment" in sql


# ---------------------------------------------------------------------------
# Initiative agreement: supplier sees only Approved; gov_comment excluded
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_supplier_initiative_agreement_query_restricts_to_approved():
    """Non-government queries must include a hard Approved-status filter."""
    db = _db_without_rows()
    context = SearchContext(
        query=parse_query("initiative_agreement"),
        organization_id=17,
        is_government=False,
    )

    await search_initiative_agreements(db, context)

    sql = _executed_sql(db)
    assert "initiative_agreement_status.status = 'Approved'" in sql


@pytest.mark.anyio
async def test_government_initiative_agreement_query_has_no_approved_restriction():
    """Government queries must NOT have the supplier-only Approved filter."""
    db = _db_without_rows()

    await search_initiative_agreements(db, _government_context("initiative_agreement"))

    sql = _executed_sql(db)
    assert "initiative_agreement_status.status = 'Approved'" not in sql


@pytest.mark.anyio
async def test_supplier_initiative_agreement_query_excludes_gov_comment():
    """gov_comment must not be searchable or echoed for supplier users."""
    db = _db_without_rows()
    context = SearchContext(
        query=parse_query("example org"),
        organization_id=17,
        is_government=False,
    )

    await search_initiative_agreements(db, context)

    sql = _executed_sql(db)
    assert "initiative_agreement.gov_comment" not in sql


@pytest.mark.anyio
async def test_government_initiative_agreement_query_includes_gov_comment():
    """Government users can search and see gov_comment."""
    db = _db_without_rows()

    await search_initiative_agreements(db, _government_context("example org"))

    sql = _executed_sql(db)
    assert "initiative_agreement.gov_comment" in sql


# ---------------------------------------------------------------------------
# Compliance report: analyst fields and assessment statement excluded for suppliers
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_supplier_compliance_report_excludes_analyst_and_assessment_fields():
    """Analyst name and assessment statement must not be in supplier match-context."""
    db = _db_without_rows()
    context = SearchContext(
        # Use a text query so match_context_expression references all fields.
        query=parse_query("example assessment"),
        organization_id=17,
        is_government=False,
    )

    await search_compliance_reports(db, context)

    sql = _executed_sql(db)
    # The field labels appear in the match_context concat string only when
    # the corresponding SearchField is included in the fields list.
    assert "Analyst first name" not in sql
    assert "Analyst last name" not in sql
    assert "Assessment statement" not in sql


@pytest.mark.anyio
async def test_government_compliance_report_includes_analyst_and_assessment_fields():
    """Government users can search and see analyst fields and assessment statement."""
    db = _db_without_rows()

    await search_compliance_reports(db, _government_context("example assessment"))

    sql = _executed_sql(db)
    assert "Analyst first name" in sql
    assert "Analyst last name" in sql
    assert "Assessment statement" in sql


# ---------------------------------------------------------------------------
# Transfer: Recommendation field excluded for suppliers
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_supplier_transfer_query_excludes_recommendation_field():
    """The Recommendation field must not be searchable or echoed for suppliers."""
    db = _db_without_rows()
    context = SearchContext(
        query=parse_query("example transfer"),
        organization_id=17,
        is_government=False,
    )

    await search_transfers(db, context)

    sql = _executed_sql(db)
    assert "Recommendation" not in sql


@pytest.mark.anyio
async def test_government_transfer_query_includes_recommendation_field():
    """Government users can search and see the Recommendation field."""
    db = _db_without_rows()

    await search_transfers(db, _government_context("example transfer"))

    sql = _executed_sql(db)
    assert "Recommendation" in sql


# ---------------------------------------------------------------------------
# Status filter translation for suppliers
# ---------------------------------------------------------------------------


def test_supplier_compliance_report_submitted_filter_expands_to_masked_statuses():
    """Searching for 'submitted' should surface records in all masked states."""
    result = _effective_status_values_for_supplier(("Submitted",))
    values_casefold = {v.casefold() for v in result}
    assert "submitted" in values_casefold
    assert "recommended by analyst" in values_casefold
    assert "recommended by manager" in values_casefold
    assert "analyst adjustment" in values_casefold


def test_supplier_compliance_report_internal_status_names_are_stripped():
    """An explicit internal-only status name must produce an empty filter."""
    result = _effective_status_values_for_supplier(("Recommended by analyst",))
    assert result == ()


def test_supplier_transfer_submitted_filter_expands_to_include_recommended():
    """Searching for 'submitted' on transfers should surface Recommended records."""
    result = _effective_transfer_status_values_for_supplier(("Submitted",))
    values_casefold = {v.casefold() for v in result}
    assert "submitted" in values_casefold
    assert "recommended" in values_casefold


def test_supplier_transfer_recommended_filter_is_stripped():
    """An explicit 'recommended' status name must produce an empty filter."""
    result = _effective_transfer_status_values_for_supplier(("Recommended",))
    assert result == ()
