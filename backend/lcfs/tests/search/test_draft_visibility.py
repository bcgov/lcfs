"""Global search shows each caller only what their own lists show (#5231).

A Draft belongs to whoever is drafting it. IDIR users must not find a
supplier's draft compliance report, transfer or CI application through
search, nor follow a search result to one. Search also leaves out the
government's own drafts, which stay on their module pages.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.search.entities.admin_adjustments import search_admin_adjustments
from lcfs.web.api.search.entities.base import SearchContext
from lcfs.web.api.search.entities.ci_applications import search_ci_applications
from lcfs.web.api.search.entities.compliance_reports import (
    _hidden_statuses,
    search_compliance_reports,
)
from lcfs.web.api.search.entities.fuel_codes import search_fuel_codes
from lcfs.web.api.search.entities.initiative_agreements import (
    search_initiative_agreements,
)
from lcfs.web.api.search.entities.transfers import search_transfers
from lcfs.web.api.search.query import parse_query
from lcfs.web.api.search.services import SearchService


def _db_without_rows() -> AsyncMock:
    result = MagicMock()
    result.all.return_value = []
    db = AsyncMock(spec=AsyncSession)
    db.execute.return_value = result
    return db


def _where_clause(db: AsyncMock) -> str:
    statement = db.execute.await_args.args[0]
    sql = str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    return " ".join(sql.split("WHERE", 1)[1].split())


def _government(query: str, *, analyst: bool = False) -> SearchContext:
    return SearchContext(
        query=parse_query(query),
        organization_id=None,
        is_government=True,
        is_analyst=analyst,
    )


def _supplier(query: str, organization_id: int = 17) -> SearchContext:
    return SearchContext(
        query=parse_query(query),
        organization_id=organization_id,
        is_government=False,
    )


# ---------------------------------------------------------------------------
# Compliance reports: the list's latest-visible-version rule
# ---------------------------------------------------------------------------


def test_report_statuses_hidden_match_the_report_list():
    """Mirrors ComplianceReportRepository.get_reports_paginated."""
    assert {s.name for s in _hidden_statuses(_government("report"))} == {
        "Draft",
        "Analyst_adjustment",
    }
    assert {s.name for s in _hidden_statuses(_government("report", analyst=True))} == {
        "Draft"
    }
    assert {s.name for s in _hidden_statuses(_supplier("report"))} == {
        "Analyst_adjustment"
    }


@pytest.mark.anyio
async def test_government_report_search_never_returns_a_draft():
    db = _db_without_rows()

    await search_compliance_reports(db, _government("report"))

    where = _where_clause(db)
    # The row itself is not a draft ...
    assert where.startswith(
        "(v_compliance_report.report_status_id NOT IN (SELECT "
        "compliance_report_status.compliance_report_status_id FROM "
        "compliance_report_status WHERE compliance_report_status.status IN "
        "('Analyst_adjustment', 'Draft')))"
    )
    # ... and it is the newest version that is not, so a report whose
    # newest version is a draft supplemental shows its last submitted
    # version instead of disappearing.
    assert (
        "v_compliance_report.version = (SELECT max(compliance_report.version)" in where
    )
    assert "compliance_report.current_status_id NOT IN" in where
    assert "is_latest" not in where


@pytest.mark.anyio
async def test_analysts_still_find_reports_in_analyst_adjustment():
    db = _db_without_rows()

    await search_compliance_reports(db, _government("report", analyst=True))

    where = _where_clause(db)
    assert "compliance_report_status.status IN ('Draft')" in where
    assert "Analyst_adjustment" not in where


@pytest.mark.anyio
async def test_suppliers_do_not_find_unassessed_government_reassessments():
    """The supplier's report list hides a government reassessment until it
    is assessed; search now does too, and still shows their own drafts."""
    db = _db_without_rows()

    await search_compliance_reports(db, _supplier("report"))

    where = _where_clause(db)
    assert "'Draft'" not in where
    assert (
        "compliance_report.supplemental_initiator != 'GOVERNMENT_REASSESSMENT'" in where
    )
    assert "compliance_report_status.status = 'Assessed'" in where
    assert "v_compliance_report.organization_id = 17" in where


@pytest.mark.anyio
async def test_asking_for_draft_reports_by_name_cannot_get_round_the_rule():
    db = _db_without_rows()
    context = _government("draft reports")
    assert context.query.values("status") == ("draft",)

    await search_compliance_reports(db, context)

    # The status filter is applied on top of the rule, never instead of it.
    assert "NOT IN (SELECT compliance_report_status.compliance_report_status_id" in (
        _where_clause(db)
    )
    assert "IN ('Analyst_adjustment', 'Draft')" in _where_clause(db)


# ---------------------------------------------------------------------------
# Transfers: the transfer_status visibility flags
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_government_transfer_search_uses_the_government_visibility_flag():
    """Draft, Sent, Declined and Deleted transfers are not visible to
    government; a Rescinded one is, only if it was submitted first."""
    db = _db_without_rows()

    await search_transfers(db, _government("transfer"))

    where = _where_clause(db)
    assert "transfer_status.visible_to_government IS true" in where
    assert "transfer_status.status != 'Rescinded'" in where
    assert "history_status.status = 'Submitted'" in where


@pytest.mark.anyio
async def test_supplier_transfer_search_uses_each_sides_visibility_flag():
    """The receiving organization never finds the sender's Draft."""
    db = _db_without_rows()

    await search_transfers(db, _supplier("transfer"))

    where = _where_clause(db)
    assert (
        "transfer.from_organization_id = 17 AND "
        "transfer_status.visible_to_transferor IS true" in where
    )
    assert (
        "transfer.to_organization_id = 17 AND "
        "transfer_status.visible_to_transferee IS true" in where
    )
    assert "visible_to_government" not in where


@pytest.mark.anyio
async def test_supplier_transfer_visibility_binds_tighter_than_the_text_match():
    db = _db_without_rows()

    await search_transfers(db, _supplier("acme"))

    where = _where_clause(db)
    # Both sides of the OR sit inside one parenthesised group, so the
    # text match applies to each of them.
    assert (
        "(transfer.from_organization_id = 17 AND "
        "transfer_status.visible_to_transferor IS true OR "
        "transfer.to_organization_id = 17 AND "
        "transfer_status.visible_to_transferee IS true)" in where
    )


# ---------------------------------------------------------------------------
# Every other entity: government search leaves drafts out
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize(
    "handler, query, expected",
    [
        (
            search_ci_applications,
            "ci_application",
            "ci_application_status.status != 'Draft'",
        ),
        (
            search_admin_adjustments,
            "admin_adjustment",
            "admin_adjustment_status.status != 'Draft'",
        ),
        (
            search_initiative_agreements,
            "initiative_agreement",
            "initiative_agreement_status.status != 'Draft'",
        ),
        (
            search_fuel_codes,
            "fuel_code",
            "CAST(vw_fuel_code_base.status AS VARCHAR) != 'Draft'",
        ),
    ],
    ids=["ci_application", "admin_adjustment", "initiative_agreement", "fuel_code"],
)
async def test_government_search_leaves_drafts_out(handler, query, expected):
    db = _db_without_rows()

    await handler(db, _government(query))

    assert expected in _where_clause(db)


@pytest.mark.anyio
async def test_a_supplier_still_finds_its_own_draft_ci_application():
    db = _db_without_rows()

    await search_ci_applications(db, _supplier("ci_application"))

    where = _where_clause(db)
    assert "'Draft'" not in where
    assert "ci_application.organization_id = 17" in where


# ---------------------------------------------------------------------------
# The caller's roles reach the entity searches
# ---------------------------------------------------------------------------


def _user(*roles, organization_id=None):
    return SimpleNamespace(
        role_names=list(roles),
        organization_id=organization_id,
        user_roles=[
            SimpleNamespace(
                role=SimpleNamespace(
                    name=role,
                    is_government_role=role
                    in (RoleEnum.GOVERNMENT, RoleEnum.ANALYST, RoleEnum.DIRECTOR),
                )
            )
            for role in roles
        ],
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "roles, is_government, is_analyst",
    [
        ((RoleEnum.GOVERNMENT, RoleEnum.ANALYST), True, True),
        ((RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR), True, False),
        ((RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING), False, False),
    ],
    ids=["analyst", "director", "supplier"],
)
async def test_search_service_passes_the_callers_roles(
    monkeypatch, roles, is_government, is_analyst
):
    seen = []

    async def capture(self, context):
        seen.append(context)
        return []

    monkeypatch.setattr(SearchService, "_search_entities", capture)

    await SearchService(db=None).search(
        "report", _user(*roles, organization_id=None if is_government else 17)
    )

    assert seen[0].is_government is is_government
    assert seen[0].is_analyst is is_analyst
