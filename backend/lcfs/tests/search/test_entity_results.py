from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.admin_adjustment.AdminAdjustmentStatus import (
    AdminAdjustmentStatusEnum,
)
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatusEnum,
)
from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.web.api.search.entities.admin_adjustments import search_admin_adjustments
from lcfs.web.api.search.entities.base import SearchContext
from lcfs.web.api.search.entities.compliance_reports import search_compliance_reports
from lcfs.web.api.search.entities.fuel_codes import (
    FUEL_CODE_RESULT_LIMIT,
    search_fuel_codes,
)
from lcfs.web.api.search.entities.initiative_agreements import (
    search_initiative_agreements,
)
from lcfs.web.api.search.entities.transfers import search_transfers
from lcfs.web.api.search.entities.users import search_users
from lcfs.web.api.search.query import parse_query


def _db_returning(*rows) -> AsyncMock:
    result = MagicMock()
    result.all.return_value = list(rows)
    db = AsyncMock(spec=AsyncSession)
    db.execute.return_value = result
    return db


def _context(query: str, *, organization_id: int = 17) -> SearchContext:
    return SearchContext(
        query=parse_query(query),
        organization_id=organization_id,
        is_government=False,
    )


def _executed_sql(db: AsyncMock) -> str:
    statement = db.execute.await_args.args[0]
    return str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


@pytest.mark.anyio
async def test_supplier_user_result_keeps_organization_context():
    user = UserProfile(
        user_profile_id=4,
        keycloak_username="jsmith",
        first_name="Jordan",
        last_name="Smith",
        email="jordan@example.com",
        title="Compliance manager",
        organization_id=17,
        is_active=True,
    )
    db = _db_returning((user, "Example Fuels", None))

    results = await search_users(db, _context("user"))

    assert len(results) == 1
    assert results[0].route == "/organization/users/4"
    assert results[0].meta == "Compliance manager · Example Fuels"
    assert [(detail.label, detail.value) for detail in results[0].details] == [
        ("Email", "jordan@example.com"),
        ("Title", "Compliance manager"),
        ("Organization", "Example Fuels"),
    ]


@pytest.mark.anyio
async def test_fuel_code_result_exposes_professional_labelled_details():
    fuel_code = SimpleNamespace(
        fuel_code_id=42,
        prefix="PROXY",
        fuel_suffix="42.1",
        company="Example Fuels",
        fuel_type="HDRD",
        carbon_intensity=12.58,
        feedstock="Yellow grease",
        fuel_production_facility_city="Prince George",
        status="Approved",
    )
    db = _db_returning((fuel_code, "Facility city: Prince George"))

    results = await search_fuel_codes(db, _context("prin"))

    assert len(results) == 1
    assert results[0].title == "PROXY42.1"
    assert results[0].route == "/fuel-codes/42/view"
    assert results[0].match_context == "Facility city: Prince George"
    assert [(detail.label, detail.value) for detail in results[0].details] == [
        ("Company", "Example Fuels"),
        ("Fuel type", "HDRD"),
        ("Carbon intensity", "12.58"),
        ("Feedstock", "Yellow grease"),
        ("Facility", "Prince George"),
    ]


@pytest.mark.anyio
async def test_bceid_fuel_code_search_includes_owned_and_all_approved_records():
    db = _db_returning()

    await search_fuel_codes(db, _context("fuel_code", organization_id=17))

    sql = _executed_sql(db)
    assert "fuel_code.organization_id = 17" in sql
    assert "CAST(vw_fuel_code_base.status AS VARCHAR) = 'Approved'" in sql
    assert " OR " in sql
    where_clause = sql.split("WHERE", maxsplit=1)[1]
    assert "effective_date <" not in where_clause
    assert "expiration_date >" not in where_clause


@pytest.mark.anyio
async def test_bceid_without_an_organization_only_sees_approved_records():
    db = _db_returning()
    context = SearchContext(
        query=parse_query("fuel_code"),
        organization_id=None,
        is_government=False,
    )

    await search_fuel_codes(db, context)

    sql = _executed_sql(db)
    assert "CAST(vw_fuel_code_base.status AS VARCHAR) = 'Approved'" in sql
    assert "fuel_code.organization_id" not in sql


@pytest.mark.anyio
async def test_idir_fuel_code_search_remains_unscoped():
    db = _db_returning()
    context = SearchContext(
        query=parse_query("fuel_code"),
        organization_id=None,
        is_government=True,
    )

    await search_fuel_codes(db, context)

    sql = _executed_sql(db)
    assert "CAST(vw_fuel_code_base.status AS VARCHAR) = 'Approved'" not in sql
    assert "fuel_code.organization_id" not in sql


@pytest.mark.anyio
async def test_fuel_code_search_supports_large_company_result_sets():
    db = _db_returning()

    await search_fuel_codes(db, _context("company"))

    assert FUEL_CODE_RESULT_LIMIT == 100
    assert f"LIMIT {FUEL_CODE_RESULT_LIMIT}" in _executed_sql(db)


@pytest.mark.anyio
async def test_transfer_result_formats_quantities_prices_and_dates():
    transfer = SimpleNamespace(
        transfer_id=7,
        from_name="Supplier A",
        to_name="Supplier B",
        status=TransferStatusEnum.Draft,
        quantity=1_250,
        price_per_unit=3.5,
        agreement_date=date(2026, 8, 27),
        match_context=None,
    )
    db = _db_returning(transfer)

    results = await search_transfers(db, _context("transfer"))

    assert len(results) == 1
    assert results[0].title == "Supplier A → Supplier B"
    assert results[0].status == "Draft"
    assert results[0].meta == "1,250 units · $3.50/unit · 2026-08-27"
    assert [(detail.label, detail.value) for detail in results[0].details] == [
        ("Transfer ID", "7"),
        ("Quantity", "1,250 units"),
        ("Unit price", "$3.50"),
        ("Agreement date", "2026-08-27"),
    ]


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("is_government", "expected_route"),
    [
        (True, "/initiative-agreement/42"),
        (False, "/org-initiative-agreement/42"),
    ],
)
async def test_initiative_agreement_link_uses_entity_id(
    is_government: bool,
    expected_route: str,
):
    agreement = SimpleNamespace(
        initiative_agreement_id=42,
        compliance_units=1_500,
        org_name="Example Fuels",
        status=InitiativeAgreementStatusEnum.Draft,
        match_context=None,
    )
    db = _db_returning(agreement)
    context = SearchContext(
        query=parse_query("initiative_agreement"),
        organization_id=None if is_government else 17,
        is_government=is_government,
    )

    results = await search_initiative_agreements(db, context)

    assert len(results) == 1
    assert results[0].entity_id == 42
    assert results[0].route == expected_route


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("is_government", "expected_route"),
    [
        (True, "/admin-adjustment/24"),
        (False, "/org-admin-adjustment/24"),
    ],
)
async def test_admin_adjustment_link_uses_entity_id(
    is_government: bool,
    expected_route: str,
):
    adjustment = SimpleNamespace(
        admin_adjustment_id=24,
        compliance_units=750,
        org_name="Example Fuels",
        status=AdminAdjustmentStatusEnum.Draft,
        match_context=None,
    )
    db = _db_returning(adjustment)
    context = SearchContext(
        query=parse_query("admin_adjustment"),
        organization_id=None if is_government else 17,
        is_government=is_government,
    )

    results = await search_admin_adjustments(db, context)

    assert len(results) == 1
    assert results[0].entity_id == 24
    assert results[0].route == expected_route


# ---------------------------------------------------------------------------
# Compliance report: status masking and analyst-field hiding for suppliers
# ---------------------------------------------------------------------------

def _compliance_report_row(
    status: ComplianceReportStatusEnum,
    analyst_first: str = "Jane",
    analyst_last: str = "Analyst",
) -> SimpleNamespace:
    return SimpleNamespace(
        compliance_report_id=1,
        organization_name="Test Org",
        compliance_period="2025",
        report_type="Annual",
        report_status=status,
        assigned_analyst_first_name=analyst_first,
        assigned_analyst_last_name=analyst_last,
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "internal_status",
    [
        ComplianceReportStatusEnum.Recommended_by_analyst,
        ComplianceReportStatusEnum.Recommended_by_manager,
        ComplianceReportStatusEnum.Analyst_adjustment,
    ],
    ids=lambda s: s.name,
)
async def test_supplier_compliance_report_masks_internal_statuses(
    internal_status: ComplianceReportStatusEnum,
):
    """Any internal workflow status must be presented as 'Submitted' to suppliers."""
    db = _db_returning((_compliance_report_row(internal_status), None))
    context = SearchContext(
        query=parse_query("report"),
        organization_id=17,
        is_government=False,
    )

    results = await search_compliance_reports(db, context)

    assert len(results) == 1
    assert results[0].status == "Submitted"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "internal_status",
    [
        ComplianceReportStatusEnum.Recommended_by_analyst,
        ComplianceReportStatusEnum.Recommended_by_manager,
        ComplianceReportStatusEnum.Analyst_adjustment,
    ],
    ids=lambda s: s.name,
)
async def test_government_compliance_report_shows_raw_internal_status(
    internal_status: ComplianceReportStatusEnum,
):
    """Government users must see the real (unmasked) status."""
    db = _db_returning((_compliance_report_row(internal_status), None))
    context = SearchContext(
        query=parse_query("report"),
        organization_id=None,
        is_government=True,
    )

    results = await search_compliance_reports(db, context)

    assert len(results) == 1
    assert results[0].status == internal_status.value


@pytest.mark.anyio
async def test_supplier_compliance_report_hides_analyst_in_result():
    """Analyst name must not appear in meta or details for supplier users."""
    db = _db_returning(
        (_compliance_report_row(ComplianceReportStatusEnum.Submitted), None)
    )
    context = SearchContext(
        query=parse_query("report"),
        organization_id=17,
        is_government=False,
    )

    results = await search_compliance_reports(db, context)

    assert len(results) == 1
    assert results[0].meta is not None
    assert "Analyst" not in (results[0].meta or "")
    detail_labels = [d.label for d in results[0].details]
    assert "Analyst" not in detail_labels


@pytest.mark.anyio
async def test_government_compliance_report_shows_analyst_in_result():
    """Government users must see the assigned analyst in meta and details."""
    db = _db_returning(
        (_compliance_report_row(ComplianceReportStatusEnum.Submitted), None)
    )
    context = SearchContext(
        query=parse_query("report"),
        organization_id=None,
        is_government=True,
    )

    results = await search_compliance_reports(db, context)

    assert len(results) == 1
    assert "Analyst: Jane Analyst" in (results[0].meta or "")
    detail_labels = [d.label for d in results[0].details]
    assert "Analyst" in detail_labels


# ---------------------------------------------------------------------------
# Transfer: Recommended status masked as Submitted for suppliers
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_supplier_transfer_masks_recommended_status():
    """Transfers in Recommended state must appear as Submitted to suppliers."""
    transfer = SimpleNamespace(
        transfer_id=8,
        from_name="Supplier A",
        to_name="Supplier B",
        status=TransferStatusEnum.Recommended,
        quantity=None,
        price_per_unit=None,
        agreement_date=None,
        match_context=None,
    )
    db = _db_returning(transfer)
    context = SearchContext(
        query=parse_query("transfer"),
        organization_id=17,
        is_government=False,
    )

    results = await search_transfers(db, context)

    assert len(results) == 1
    assert results[0].status == "Submitted"


@pytest.mark.anyio
async def test_government_transfer_shows_recommended_status():
    """Government users must see the unmasked Recommended status on transfers."""
    transfer = SimpleNamespace(
        transfer_id=9,
        from_name="Supplier A",
        to_name="Supplier B",
        status=TransferStatusEnum.Recommended,
        quantity=None,
        price_per_unit=None,
        agreement_date=None,
        match_context=None,
    )
    db = _db_returning(transfer)
    context = SearchContext(
        query=parse_query("transfer"),
        organization_id=None,
        is_government=True,
    )

    results = await search_transfers(db, context)

    assert len(results) == 1
    assert results[0].status == "Recommended"
