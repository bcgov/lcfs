"""Guards on the energy effectiveness ratio reference data (#5113).

These run against the pytest database, which is built by applying every
migration, so they check the data a fresh environment actually ends up with
rather than a mocked session.
"""

import pytest
from sqlalchemy import select

from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.db.models.fuel.EnergyEffectivenessRatio import EnergyEffectivenessRatio
from lcfs.db.models.fuel.FuelCategory import FuelCategory
from lcfs.db.models.fuel.FuelType import FuelType
from lcfs.web.api.fuel_code.repo import FuelCodeRepository

# The regulatory schedule does not change after 2026 unless regulation says so.
LATEST_SCHEDULE_YEAR = "2026"
EXTENDED_YEARS = ["2027", "2028", "2029", "2030"]


async def _eer_set(dbsession, year):
    result = await dbsession.execute(
        select(
            EnergyEffectivenessRatio.fuel_type_id,
            EnergyEffectivenessRatio.fuel_category_id,
            EnergyEffectivenessRatio.end_use_type_id,
            EnergyEffectivenessRatio.ratio,
        )
        .join(
            CompliancePeriod,
            CompliancePeriod.compliance_period_id
            == EnergyEffectivenessRatio.compliance_period_id,
        )
        .where(CompliancePeriod.description == year)
    )
    return sorted(result.all(), key=lambda row: tuple(str(v) for v in row))


async def _ids(dbsession, fuel_type, category, end_use, year):
    fuel_type_id = await dbsession.scalar(
        select(FuelType.fuel_type_id).where(FuelType.fuel_type == fuel_type)
    )
    category_id = await dbsession.scalar(
        select(FuelCategory.fuel_category_id).where(FuelCategory.category == category)
    )
    end_use_id = await dbsession.scalar(
        select(EndUseType.end_use_type_id).where(EndUseType.type == end_use)
    )
    period_id = await dbsession.scalar(
        select(CompliancePeriod.compliance_period_id).where(
            CompliancePeriod.description == year
        )
    )
    return fuel_type_id, category_id, end_use_id, period_id


@pytest.mark.anyio
@pytest.mark.parametrize("year", EXTENDED_YEARS)
async def test_extended_years_match_latest_schedule(dbsession, year):
    """2027-2030 must carry the 2026 schedule forward unchanged: same fuel,
    category and end-use combinations, same ratios."""
    latest = await _eer_set(dbsession, LATEST_SCHEDULE_YEAR)
    assert latest, "the 2026 EER schedule should be seeded"
    assert await _eer_set(dbsession, year) == latest


@pytest.mark.anyio
@pytest.mark.parametrize("year", EXTENDED_YEARS)
async def test_cng_gasoline_eer_stays_at_0_9(dbsession, year):
    """The case reported in #5113."""
    repo = FuelCodeRepository(db=dbsession)
    fuel_type_id, category_id, end_use_id, period_id = await _ids(
        dbsession, "CNG", "Gasoline", "Any", year
    )
    eer = await repo.get_energy_effectiveness_ratio(
        fuel_type_id, category_id, period_id, end_use_id
    )
    assert eer is not None
    assert eer.ratio == pytest.approx(0.9)


@pytest.mark.anyio
@pytest.mark.parametrize(
    "fuel_type,category,end_use,expected",
    [
        ("Electricity", "Gasoline", "Light duty motor vehicles", 3.5),
        ("Electricity", "Diesel", "Battery bus", 3.8),
        ("Hydrogen", "Gasoline", "Fuel cell vehicle", 2.4),
    ],
)
async def test_end_use_specific_eers_resolve_in_2027(
    dbsession, fuel_type, category, end_use, expected
):
    """End-use-specific ratios must resolve to a row in 2027. When no row is
    found the calculation silently falls back to 1.0, which is how these
    were understated before #5113."""
    repo = FuelCodeRepository(db=dbsession)
    fuel_type_id, category_id, end_use_id, period_id = await _ids(
        dbsession, fuel_type, category, end_use, "2027"
    )
    eer = await repo.get_energy_effectiveness_ratio(
        fuel_type_id, category_id, period_id, end_use_id
    )
    assert eer is not None, f"no 2027 EER row for {fuel_type}/{category}/{end_use}"
    assert eer.ratio == pytest.approx(expected)
