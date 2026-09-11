"""
Query-shape tests for the fuel code repository (issue #4101).
"""

from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import Select

from lcfs.web.api.fuel_code.repo import FuelCodeRepository


def _sql(stmt, literal_binds: bool = False) -> str:
    compiled = stmt.compile(
        dialect=postgresql.dialect(),
        compile_kwargs={"literal_binds": literal_binds},
    )
    return " ".join(str(compiled).split())


class _CapturingSession:
    def __init__(self):
        self.statements = []

    async def execute(self, statement, *args, **kwargs):
        self.statements.append(statement)
        result = MagicMock()
        result.scalar_one_or_none.return_value = "101.0"
        result.unique.return_value.scalars.return_value.all.return_value = []
        return result

    async def scalar(self, statement, *args, **kwargs):
        self.statements.append(statement)
        return None


@pytest.fixture
def session():
    return _CapturingSession()


@pytest.fixture
def repo(session):
    return FuelCodeRepository(db=session)


@pytest.mark.anyio
@pytest.mark.parametrize(
    "prefix, first_code", [("BCLCF", 101), ("C-BCLCF", 101), ("PROXY", 1)]
)
async def test_next_available_fuel_code_is_a_core_select(
    repo, session, prefix, first_code
):
    await repo.get_next_available_fuel_code_by_prefix(prefix)

    statement = session.statements[-1]
    assert isinstance(statement, Select)
    sql = _sql(statement, literal_binds=True)
    assert f"generate_series({first_code}," in sql
    assert "WITH parsed_codes AS" in sql
    assert f"fuel_code_prefix.prefix = '{prefix}'" in sql
    assert "lpad(" in sql


@pytest.mark.anyio
async def test_next_available_sub_version_is_a_core_select(repo, session):
    await repo.get_next_available_sub_version_fuel_code_by_prefix("101", 3)

    statement = session.statements[-1]
    assert isinstance(statement, Select)
    sql = _sql(statement, literal_binds=True)
    assert "WITH sub_versions AS" in sql
    assert "fuel_code.prefix_id = 3" in sql
    assert "split_part(fuel_code.fuel_suffix, '.', 1) AS INTEGER) = 101" in sql
    assert "generate_series(0," in sql
    assert sql.startswith("WITH") and "'101' || '.'" in sql


@pytest.mark.anyio
async def test_get_fuel_code_by_code_prefix_joins_the_filtered_tables(repo, session):
    await repo.get_fuel_code_by_code_prefix("200.0", "BCLCF")

    statement = next(s for s in session.statements if isinstance(s, Select))
    sql = _sql(statement)
    from_clause = sql[sql.index(" FROM ") : sql.index(" WHERE ")]
    # explicit joins for the tables used in the WHERE clause ...
    assert "FROM fuel_code JOIN fuel_code_prefix ON" in from_clause
    assert "JOIN fuel_code_status ON" in from_clause
    # ... and no bare FROM entries (cross join) for them
    assert ", fuel_code_prefix" not in from_clause
    assert ", fuel_code_status" not in from_clause
    # the transport-mode collections are loaded separately
    assert "feedstock_fuel_transport_mode" not in sql
    assert "finished_fuel_transport_mode" not in sql


@pytest.mark.anyio
async def test_get_fuel_code_loads_transport_modes_separately(repo, session):
    await repo.get_fuel_code(1)

    sql = _sql(session.statements[-1])
    assert "feedstock_fuel_transport_mode" not in sql
    assert "finished_fuel_transport_mode" not in sql
    assert "LEFT OUTER JOIN fuel_type AS" in sql
