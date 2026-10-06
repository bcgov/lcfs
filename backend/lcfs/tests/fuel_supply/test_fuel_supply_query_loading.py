"""
Query-shape tests for the fuel supply repository (issue #4101).

The FuelSupply loaders join the many-to-one reference rows (fuel type, fuel
category, fuel code, provision, end use) but must not join the reference-data
collections that hang off fuel_type / fuel_category. Joining those multiplied
every fuel supply row by the product of the collection sizes.

The two collections that are ``lazy="selectin"`` on the mapping
(``FuelType.default_carbon_intensities``,
``FuelCategory.category_carbon_intensities``) are switched off per query with
``raiseload``; the database-backed tests at the bottom check that no extra
query is issued for them and that touching them raises.
"""

import uuid
from datetime import date
from unittest.mock import MagicMock

import pytest
from sqlalchemy import event, select
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.sql import Select

from lcfs.db.models.compliance import (
    CompliancePeriod,
    ComplianceReport,
    ComplianceReportStatus,
    FuelSupply,
)
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.db.models.fuel import (
    CategoryCarbonIntensity,
    DefaultCarbonIntensity,
    FuelCategory,
    FuelType,
)
from lcfs.db.models.organization import Organization
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import ModeEnum
from lcfs.web.api.fuel_supply.services import FuelSupplyServices

REFERENCE_COLLECTION_JOINS = (
    "JOIN energy_density",
    "JOIN energy_effectiveness_ratio",
    "JOIN target_carbon_intensity",
    "JOIN additional_carbon_intensity",
    "JOIN default_carbon_intensity",
)


def _sql(stmt) -> str:
    return " ".join(str(stmt.compile(dialect=postgresql.dialect())).split())


class _CapturingSession:
    """Records every statement handed to execute() and returns empty results."""

    def __init__(self):
        self.statements = []

    async def execute(self, statement, *args, **kwargs):
        self.statements.append(statement)
        result = MagicMock()
        result.unique.return_value.scalars.return_value.all.return_value = []
        result.scalars.return_value.all.return_value = []
        result.unique.return_value.scalar_one_or_none.return_value = None
        result.scalar.return_value = 0
        return result

    async def scalar(self, statement, *args, **kwargs):
        self.statements.append(statement)
        return 0

    def fuel_supply_selects(self):
        return [
            s
            for s in self.statements
            if isinstance(s, Select) and "fuel_supply.fuel_supply_id" in _sql(s)
        ]


@pytest.fixture
def session():
    return _CapturingSession()


@pytest.fixture
def repo(session):
    return FuelSupplyRepository(db=session)


def test_row_loader_joins_only_many_to_one(repo):
    sql = _sql(repo.query)

    for fragment in REFERENCE_COLLECTION_JOINS:
        assert fragment not in sql, fragment
    for table in (
        "fuel_type",
        "fuel_category",
        "fuel_code",
        "fuel_code_status",
        "fuel_code_prefix",
        "provision_of_the_act",
        "end_use_type",
    ):
        assert f"LEFT OUTER JOIN {table} AS" in sql, table


@pytest.mark.anyio
async def test_get_fuel_supply_by_id_uses_row_loader(repo, session):
    await repo.get_fuel_supply_by_id(1)

    sql = _sql(session.fuel_supply_selects()[-1])
    for fragment in REFERENCE_COLLECTION_JOINS:
        assert fragment not in sql, fragment


@pytest.mark.anyio
@pytest.mark.parametrize("mode", [ModeEnum.VIEW, ModeEnum.EDIT, ModeEnum.CHANGELOG])
async def test_get_effective_fuel_supplies_joins_no_collections(repo, session, mode):
    await repo.get_effective_fuel_supplies("group-uuid", 1, 0, mode)

    sql = _sql(session.fuel_supply_selects()[-1])
    for fragment in REFERENCE_COLLECTION_JOINS:
        assert fragment not in sql, fragment
    assert "LEFT OUTER JOIN fuel_type AS" in sql
    assert "LEFT OUTER JOIN fuel_code_prefix AS" in sql


@pytest.mark.anyio
async def test_organization_fuel_supply_paginated_joins_each_table_once(repo, session):
    pagination = PaginationRequestSchema(page=1, size=10, filters=[], sort_orders=[])

    await repo.get_organization_fuel_supply_paginated(1, pagination)

    sql = _sql(session.fuel_supply_selects()[-1])
    for table in (
        "fuel_type",
        "fuel_category",
        "provision_of_the_act",
        "fuel_code",
        "compliance_report",
        "compliance_period",
    ):
        assert sql.count(f"JOIN {table} ") == 1, table
    assert "LIMIT" in sql


@pytest.mark.anyio
async def test_organization_fuel_supply_analytics_joins_each_table_once(repo, session):
    await repo.get_organization_fuel_supply_analytics(1)

    sql = _sql(session.fuel_supply_selects()[-1])
    for table in (
        "fuel_type",
        "fuel_category",
        "provision_of_the_act",
        "fuel_code",
        "compliance_report",
        "compliance_period",
    ):
        assert sql.count(f"JOIN {table} ") == 1, table


# --- database-backed: the mapping-level selectin collections -----------------


@pytest.fixture
async def fuel_supply_rows(dbsession):
    """
    One report with two fuel supplies whose fuel type and fuel category each
    own a carbon-intensity row, so the mapping-level ``selectin`` collections
    have something to load if they are not switched off.
    Returns ``(compliance_report, [fuel_supply_ids])``.
    """
    organization = Organization(
        organization_id=970,
        organization_code="o970",
        name="Fuel supply loader org",
        total_balance=0,
        reserved_balance=0,
        count_transfers_in_progress=0,
    )
    period = CompliancePeriod(compliance_period_id=970, description="970")
    status = ComplianceReportStatus(compliance_report_status_id=970, status="Draft")
    fuel_type = FuelType(
        fuel_type_id=970,
        fuel_type="Loader test diesel",
        units="Litres",
        unrecognized=False,
        fossil_derived=True,
    )
    fuel_category = FuelCategory(
        fuel_category_id=970, category="Diesel", default_carbon_intensity=0
    )
    dbsession.add_all([organization, period, status, fuel_type, fuel_category])
    await dbsession.flush()

    report = ComplianceReport(
        compliance_report_id=970,
        compliance_period_id=period.compliance_period_id,
        organization_id=organization.organization_id,
        nickname="Loader test report",
        reporting_frequency=ReportingFrequency.ANNUAL,
        current_status_id=status.compliance_report_status_id,
        compliance_report_group_uuid=str(uuid.uuid4()),
        version=0,
    )
    dbsession.add_all(
        [
            report,
            DefaultCarbonIntensity(
                compliance_period_id=period.compliance_period_id,
                fuel_type_id=fuel_type.fuel_type_id,
                default_carbon_intensity=88.83,
                effective_date=date(2026, 1, 1),
                expiration_date=date(2026, 12, 31),
            ),
            CategoryCarbonIntensity(
                compliance_period_id=period.compliance_period_id,
                fuel_category_id=fuel_category.fuel_category_id,
                category_carbon_intensity=79.28,
                effective_date=date(2026, 1, 1),
                expiration_date=date(2026, 12, 31),
            ),
        ]
    )
    await dbsession.flush()

    fuel_supply_ids = [970, 971]
    dbsession.add_all(
        [
            FuelSupply(
                fuel_supply_id=fuel_supply_id,
                compliance_report_id=report.compliance_report_id,
                quantity=1000,
                units="Litres",
                fuel_category_id=fuel_category.fuel_category_id,
                fuel_type_id=fuel_type.fuel_type_id,
                provision_of_the_act_id=1,
            )
            for fuel_supply_id in fuel_supply_ids
        ]
    )
    await dbsession.commit()
    # Force the repository to load the graph from the database instead of
    # reusing the fixture objects in the identity map.
    dbsession.expunge_all()
    return report, fuel_supply_ids


@pytest.fixture
def captured_orm_statements(dbsession):
    statements = []
    event.listen(
        dbsession.sync_session, "do_orm_execute", lambda state: statements.append(state)
    )
    return statements


def _assert_scalar_reference_graph(fuel_supply):
    # Reads mirror FuelSupplyServices.map_entity_to_schema; outside a database
    # call an unloaded relationship raises MissingGreenlet.
    assert fuel_supply.fuel_type.fuel_type == "Loader test diesel"
    assert fuel_supply.fuel_category.category == "Diesel"
    assert fuel_supply.provision_of_the_act.name
    assert fuel_supply.fuel_code is None
    assert fuel_supply.end_use_type is None
    service = FuelSupplyServices(
        repo=MagicMock(), fuel_repo=MagicMock(), compliance_report_repo=MagicMock()
    )
    schema = service.map_entity_to_schema(fuel_supply)
    assert schema.fuel_type == "Loader test diesel"
    assert schema.fuel_category == "Diesel"

    # The collections are disabled for these rows, loudly.
    with pytest.raises(InvalidRequestError, match="default_carbon_intensities"):
        fuel_supply.fuel_type.default_carbon_intensities
    with pytest.raises(InvalidRequestError, match="category_carbon_intensities"):
        fuel_supply.fuel_category.category_carbon_intensities


@pytest.mark.anyio
async def test_get_effective_fuel_supplies_issues_no_collection_queries(
    dbsession, fuel_supply_rows, captured_orm_statements
):
    report, fuel_supply_ids = fuel_supply_rows
    repo = FuelSupplyRepository(db=dbsession)

    rows = await repo.get_effective_fuel_supplies(
        report.compliance_report_group_uuid, report.compliance_report_id, report.version
    )

    assert sorted(row.fuel_supply_id for row in rows) == fuel_supply_ids
    # One SELECT for the rows; nothing fetched the selectin collections.
    assert [s for s in captured_orm_statements if s.is_relationship_load] == []
    assert len(captured_orm_statements) == 1
    for row in rows:
        _assert_scalar_reference_graph(row)


@pytest.mark.anyio
async def test_get_fuel_supply_by_id_issues_no_collection_queries(
    dbsession, fuel_supply_rows, captured_orm_statements
):
    _, fuel_supply_ids = fuel_supply_rows
    repo = FuelSupplyRepository(db=dbsession)

    row = await repo.get_fuel_supply_by_id(fuel_supply_ids[0])

    assert row.fuel_supply_id == fuel_supply_ids[0]
    assert [s for s in captured_orm_statements if s.is_relationship_load] == []
    _assert_scalar_reference_graph(row)


@pytest.mark.anyio
async def test_fuel_type_loaded_on_its_own_still_fetches_the_collection(
    dbsession, fuel_supply_rows, captured_orm_statements
):
    """
    Control for the two tests above: the override is scoped to the fuel supply
    loaders. A FuelType loaded directly keeps the mapping-level selectin, so
    the statement capture used above really does see collection loads.
    """
    fuel_type = (
        await dbsession.execute(select(FuelType).where(FuelType.fuel_type_id == 970))
    ).scalar_one()

    collection_loads = [
        _sql(s.statement) for s in captured_orm_statements if s.is_relationship_load
    ]
    assert any(
        sql.startswith("SELECT default_carbon_intensity.") for sql in collection_loads
    )
    assert [
        float(row.default_carbon_intensity)
        for row in fuel_type.default_carbon_intensities
    ] == [88.83]
