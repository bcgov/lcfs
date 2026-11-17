"""Database-backed tests for fuel code numbering and iteration helpers.

The query-shape tests only compile repository statements; these tests execute
the number generators against seeded prefixes and assert returned values.
The pytest database holds no fuel codes, so every test starts from an empty
``fuel_code`` table and inserts exactly the rows it needs.
"""

from datetime import date
from decimal import Decimal

from fastapi import HTTPException
import pytest
from sqlalchemy import func, select

from lcfs.db.models.fuel.FuelType import QuantityUnitsEnum
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
        # the enum member, not its name: the instance stays in the identity
        # map and the clone schema validates whatever is set on it
        units=QuantityUnitsEnum.Litres,
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

    async def _add(
        prefix,
        *suffixes,
        status=FuelCodeStatusEnum.Approved,
    ):
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
async def test_next_fuel_code_does_not_backfill_an_interior_gap(repo, add_fuel_codes):
    await add_fuel_codes("BCLCF", "101.0", "103.0", "104.0")

    assert await repo.get_next_available_fuel_code_by_prefix("BCLCF") == "105.0"


@pytest.mark.anyio
async def test_next_fuel_code_does_not_backfill_multiple_gaps(repo, add_fuel_codes):
    await add_fuel_codes("BCLCF", "101.0", "104.0", "106.0")

    assert await repo.get_next_available_fuel_code_by_prefix("BCLCF") == "107.0"


@pytest.mark.anyio
async def test_next_fuel_code_treats_a_deleted_status_code_as_taken(
    repo, add_fuel_codes
):
    await add_fuel_codes("BCLCF", "101.0")
    await add_fuel_codes(
        "BCLCF", "1000.0", status=FuelCodeStatusEnum.Deleted
    )

    assert await repo.get_next_available_fuel_code_by_prefix("BCLCF") == "1001.0"


@pytest.mark.anyio
@pytest.mark.parametrize("highest_prefix", ["BCLCF", "C-BCLCF"])
async def test_next_fuel_code_uses_shared_sequence_for_bclcf_prefixes(
    repo, add_fuel_codes, highest_prefix
):
    await add_fuel_codes(highest_prefix, "999.0")

    assert await repo.get_next_available_fuel_code_by_prefix("BCLCF") == "1000.0"
    assert await repo.get_next_available_fuel_code_by_prefix("C-BCLCF") == "1000.0"

    other_prefix = "C-BCLCF" if highest_prefix == "BCLCF" else "BCLCF"
    await add_fuel_codes(other_prefix, "1000.0")

    assert await repo.get_next_available_fuel_code_by_prefix("BCLCF") == "1001.0"
    assert await repo.get_next_available_fuel_code_by_prefix("C-BCLCF") == "1001.0"


@pytest.mark.anyio
async def test_next_fuel_code_does_not_truncate_existing_four_digit_number(
    repo, add_fuel_codes
):
    await add_fuel_codes("BCLCF", "1234.0")

    assert await repo.get_next_available_fuel_code_by_prefix("C-BCLCF") == "1235.0"


@pytest.mark.anyio
async def test_next_fuel_code_reports_exhausted_suffix_storage_range(
    repo, add_fuel_codes
):
    await add_fuel_codes("BCLCF", "999999999999999999.0")

    with pytest.raises(HTTPException) as exc:
        await repo.get_next_available_fuel_code_by_prefix("C-BCLCF")

    assert exc.value.status_code == 409
    assert "supported fuel suffix length" in exc.value.detail
    assert (
        await repo.get_next_available_fuel_code_by_prefix(
            "C-BCLCF", return_none_if_exhausted=True
        )
        is None
    )


@pytest.mark.anyio
async def test_next_fuel_code_is_scoped_to_the_prefix(repo, add_fuel_codes):
    await add_fuel_codes("PROXY", "001.0", "002.0")

    assert await repo.get_next_available_fuel_code_by_prefix("PROXY") == "003.0"
    assert await repo.get_next_available_fuel_code_by_prefix("BCLCF") == "101.0"


@pytest.mark.anyio
async def test_proxy_numbering_keeps_lowest_gap_behavior(repo, add_fuel_codes):
    await add_fuel_codes("PROXY", "001.0", "003.0")

    assert await repo.get_next_available_fuel_code_by_prefix("PROXY") == "002.0"


@pytest.mark.anyio
async def test_proxy_numbering_does_not_enumerate_through_large_suffixes(
    repo, add_fuel_codes
):
    await add_fuel_codes("PROXY", "999999999999999999.0")

    assert await repo.get_next_available_fuel_code_by_prefix("PROXY") == "001.0"


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
async def test_next_sub_version_for_four_digit_code(repo, add_fuel_codes, prefix_ids):
    await add_fuel_codes("BCLCF", "1000.0")

    result = await repo.get_next_available_sub_version_fuel_code_by_prefix(
        "1000", prefix_ids["BCLCF"]
    )

    assert result == "1000.1"


@pytest.mark.anyio
async def test_next_sub_version_skips_database_and_batch_reservations(
    repo, add_fuel_codes, prefix_ids
):
    await add_fuel_codes("BCLCF", "1000.0", "1000.2")

    result = await repo.get_next_available_sub_version_fuel_code_by_prefix(
        "1000", prefix_ids["BCLCF"], reserved_suffixes={"1000.1"}
    )

    assert result == "1000.3"


@pytest.mark.anyio
async def test_copying_four_digit_code_suggests_next_iteration(
    repo, add_fuel_codes, prefix_ids
):
    await add_fuel_codes("BCLCF", "1000.0")

    clones = await repo.get_fuel_code_by_code_prefix("1000.0", "BCLCF")

    assert len(clones) == 1
    assert clones[0].fuel_suffix == "1000.1"
    assert clones[0].prefix_id == prefix_ids["BCLCF"]


@pytest.mark.anyio
async def test_ninth_iteration_rolls_to_next_shared_main_number(
    repo, add_fuel_codes, prefix_ids
):
    await add_fuel_codes("BCLCF", "1001.0")
    await add_fuel_codes(
        "C-BCLCF", *(f"1000.{iteration}" for iteration in range(10))
    )

    next_suffix = await repo.get_next_available_sub_version_fuel_code_by_prefix(
        "1000", prefix_ids["C-BCLCF"]
    )

    assert next_suffix == "1002.0"


@pytest.mark.anyio
async def test_copying_ninth_iteration_rolls_to_next_main_number(
    repo, add_fuel_codes
):
    await add_fuel_codes(
        "BCLCF", *(f"1000.{iteration}" for iteration in range(10))
    )

    clones = await repo.get_fuel_code_by_code_prefix("1000.9", "BCLCF")

    assert len(clones) == 1
    assert clones[0].fuel_suffix == "1001.0"


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


# --- get_fuel_code_by_code_prefix -------------------------------------------
#
# Clones the codes matching a suffix under a prefix, re-numbered to the next
# free sub version. The sub-version helper filters on fuel_code.prefix_id, so
# the prefix *name* the endpoint receives has to be resolved to its id first;
# passing the name through bound a string to an integer column and failed at
# the driver.


@pytest.mark.anyio
async def test_clone_by_code_prefix_uses_the_next_sub_version(
    repo, add_fuel_codes, prefix_ids
):
    await add_fuel_codes("BCLCF", "101.0", "101.1")

    clones = await repo.get_fuel_code_by_code_prefix("101.0", "BCLCF")

    assert [clone.fuel_suffix for clone in clones] == ["101.2"]
    clone = clones[0]
    assert clone.prefix_id == prefix_ids["BCLCF"]
    assert clone.fuel_code_prefix.prefix == "BCLCF"
    assert clone.company == "Next code test"  # copied from the matched code


@pytest.mark.anyio
async def test_clone_by_code_prefix_without_a_match_returns_a_blank_clone(
    repo, add_fuel_codes, prefix_ids
):
    # the same suffix under another prefix is not a match for BCLCF
    await add_fuel_codes("PROXY", "101.0")

    clones = await repo.get_fuel_code_by_code_prefix("101.0", "BCLCF")

    assert len(clones) == 1
    assert clones[0].fuel_suffix == "101.0"
    assert clones[0].prefix_id == prefix_ids["BCLCF"]
    assert clones[0].fuel_code_prefix.prefix == "BCLCF"
    assert clones[0].company is None


@pytest.mark.anyio
async def test_clone_by_code_prefix_skips_deleted_codes_but_keeps_their_number(
    repo, add_fuel_codes
):
    await add_fuel_codes("BCLCF", "101.0", status=FuelCodeStatusEnum.Deleted)

    clones = await repo.get_fuel_code_by_code_prefix("101.0", "BCLCF")

    # A deleted code is not cloned, but its number stays taken.
    assert len(clones) == 1
    assert clones[0].company is None
    assert clones[0].fuel_suffix == "101.1"
