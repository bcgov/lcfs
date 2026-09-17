"""
Database-backed tests for the next-available fuel code helpers (issue #4101).

``get_next_available_fuel_code_by_prefix`` and
``get_next_available_sub_version_fuel_code_by_prefix`` were rewritten from raw
SQL to SQLAlchemy Core. The query-shape tests in
``test_fuel_code_query_shapes.py`` only compile the statements; these tests
execute them against seeded prefixes and assert the returned code values for
the gap-selection cases the helpers exist for.

The pytest database is migrated but holds no fuel codes, so every test starts
from an empty ``fuel_code`` table and inserts exactly the rows it needs.
"""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from lcfs.db.models.fuel import FuelCode, FuelCodePrefix, FuelCodeStatus, FuelType
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.web.api.fuel_code.repo import FuelCodeRepository


@pytest.fixture
def repo(dbsession):
    return FuelCodeRepository(db=dbsession)


@pytest.fixture
async def prefix_ids(dbsession):
    """Seeded prefix name -> id (BCLCF and PROXY come from the migrations)."""
    rows = await dbsession.execute(
        select(FuelCodePrefix.prefix, FuelCodePrefix.fuel_code_prefix_id)
    )
    ids = dict(rows.all())
    assert {"BCLCF", "PROXY"} <= set(ids), ids
    return ids


@pytest.fixture
async def status_ids(dbsession):
    rows = await dbsession.execute(
        select(FuelCodeStatus.status, FuelCodeStatus.fuel_code_status_id)
    )
    return dict(rows.all())


@pytest.fixture
async def next_code_fuel_type(dbsession):
    fuel_type = FuelType(
        fuel_type_id=980,
        fuel_type="Next code test fuel",
        units="Litres",
        unrecognized=False,
        fossil_derived=False,
    )
    dbsession.add(fuel_type)
    await dbsession.flush()
    return fuel_type


@pytest.fixture
async def add_fuel_codes(dbsession, prefix_ids, status_ids, next_code_fuel_type):
    """
    Factory: ``await add_fuel_codes("BCLCF", "101.0", "102.0")`` inserts one
    code per suffix under the named prefix.
    """
    existing = await dbsession.scalar(select(func.count()).select_from(FuelCode))
    assert existing == 0, (
        "the test database already holds fuel codes; the expectations in this "
        "module assume an empty fuel_code table"
    )

    async def _add(prefix, *suffixes, status=FuelCodeStatusEnum.Approved):
        codes = [
            FuelCode(
                prefix_id=prefix_ids[prefix],
                fuel_status_id=status_ids[status],
                fuel_suffix=suffix,
                fuel_type_id=next_code_fuel_type.fuel_type_id,
                company="Next code test",
                carbon_intensity=Decimal("10.00"),
                edrms="EDRMS-next-code",
                application_date=date(2026, 1, 1),
                feedstock="Corn",
                feedstock_location="BC",
                co_processed="No",
            )
            for suffix in suffixes
        ]
        dbsession.add_all(codes)
        await dbsession.flush()
        return codes

    return _add


# --- main version -----------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize("prefix, expected", [("BCLCF", "101.0"), ("PROXY", "001.0")])
async def test_next_fuel_code_for_empty_prefix_starts_at_the_range_minimum(
    repo, add_fuel_codes, prefix, expected
):
    assert await repo.get_next_available_fuel_code_by_prefix(prefix) == expected


@pytest.mark.anyio
async def test_next_fuel_code_after_contiguous_codes_is_max_plus_one(
    repo, add_fuel_codes
):
    # sub versions share the main version and must not count as a gap
    await add_fuel_codes("BCLCF", "101.0", "101.1", "102.0", "103.0")

    assert await repo.get_next_available_fuel_code_by_prefix("BCLCF") == "104.0"


@pytest.mark.anyio
async def test_next_fuel_code_reuses_an_interior_gap(repo, add_fuel_codes):
    await add_fuel_codes("BCLCF", "101.0", "103.0", "104.0")

    assert await repo.get_next_available_fuel_code_by_prefix("BCLCF") == "102.0"


@pytest.mark.anyio
async def test_next_fuel_code_reuses_the_lowest_of_several_gaps(repo, add_fuel_codes):
    await add_fuel_codes("BCLCF", "101.0", "104.0", "106.0")

    assert await repo.get_next_available_fuel_code_by_prefix("BCLCF") == "102.0"


@pytest.mark.anyio
async def test_next_fuel_code_treats_a_deleted_status_code_as_taken(
    repo, add_fuel_codes
):
    # Parity with the raw SQL this replaced: only physically removed rows free
    # up a number; a code whose status is Deleted still occupies it.
    await add_fuel_codes("BCLCF", "101.0", "103.0")
    await add_fuel_codes("BCLCF", "102.0", status=FuelCodeStatusEnum.Deleted)

    assert await repo.get_next_available_fuel_code_by_prefix("BCLCF") == "104.0"


@pytest.mark.anyio
async def test_next_fuel_code_is_scoped_to_the_prefix(repo, add_fuel_codes):
    await add_fuel_codes("PROXY", "001.0", "002.0")

    assert await repo.get_next_available_fuel_code_by_prefix("PROXY") == "003.0"
    assert await repo.get_next_available_fuel_code_by_prefix("BCLCF") == "101.0"


# --- sub version ------------------------------------------------------------


@pytest.mark.anyio
async def test_next_sub_version_with_no_rows_for_the_main_version_is_zero(
    repo, add_fuel_codes, prefix_ids
):
    await add_fuel_codes("BCLCF", "101.0", "101.1")

    result = await repo.get_next_available_sub_version_fuel_code_by_prefix(
        "102", prefix_ids["BCLCF"]
    )

    assert result == "102.0"


@pytest.mark.anyio
async def test_next_sub_version_after_contiguous_sub_versions_is_max_plus_one(
    repo, add_fuel_codes, prefix_ids
):
    await add_fuel_codes("BCLCF", "101.0", "101.1", "101.2")

    result = await repo.get_next_available_sub_version_fuel_code_by_prefix(
        "101", prefix_ids["BCLCF"]
    )

    assert result == "101.3"


@pytest.mark.anyio
async def test_next_sub_version_reuses_an_interior_gap(
    repo, add_fuel_codes, prefix_ids
):
    await add_fuel_codes("BCLCF", "101.0", "101.1", "101.3")

    result = await repo.get_next_available_sub_version_fuel_code_by_prefix(
        "101", prefix_ids["BCLCF"]
    )

    assert result == "101.2"


@pytest.mark.anyio
async def test_next_sub_version_reuses_a_missing_zero(repo, add_fuel_codes, prefix_ids):
    await add_fuel_codes("BCLCF", "101.1", "101.2")

    result = await repo.get_next_available_sub_version_fuel_code_by_prefix(
        "101", prefix_ids["BCLCF"]
    )

    assert result == "101.0"


@pytest.mark.anyio
async def test_next_sub_version_is_scoped_to_the_prefix(
    repo, add_fuel_codes, prefix_ids
):
    await add_fuel_codes("BCLCF", "101.0", "101.1")

    result = await repo.get_next_available_sub_version_fuel_code_by_prefix(
        "101", prefix_ids["PROXY"]
    )

    assert result == "101.0"
