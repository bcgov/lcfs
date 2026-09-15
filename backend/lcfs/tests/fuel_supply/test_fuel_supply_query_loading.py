"""
Query-shape tests for the fuel supply repository (issue #4101).

The FuelSupply loaders join the many-to-one reference rows (fuel type, fuel
category, fuel code, provision, end use) but must not join the reference-data
collections that hang off fuel_type / fuel_category. Joining those multiplied
every fuel supply row by the product of the collection sizes.
"""

from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import Select

from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import ModeEnum

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
