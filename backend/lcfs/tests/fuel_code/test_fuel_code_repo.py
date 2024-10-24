import pytest
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.repo import FuelCodeRepository


@pytest.fixture
def fuel_code_repo(dbsession):
    return FuelCodeRepository(db=dbsession)


@pytest.mark.anyio
async def test_get_all_energy_densities(dbsession, fuel_code_repo):
    energy_densities = await fuel_code_repo.get_energy_densities()
    assert len(energy_densities) == 15


@pytest.mark.anyio
async def test_get_all_eers(dbsession, fuel_code_repo):
    eers = await fuel_code_repo.get_energy_effectiveness_ratios()
    assert len(eers) == 24


@pytest.mark.anyio
async def test_get_all_ucis(dbsession, fuel_code_repo):
    ucis = await fuel_code_repo.get_use_of_a_carbon_intensities()
    assert len(ucis) == 9


@pytest.mark.anyio
async def test_get_fuel_codes_basic_pagination(dbsession, fuel_code_repo):
    pagination = PaginationRequestSchema(page=1, size=10, sort_orders=[], filters=[])
    fuel_codes, total_count = await fuel_code_repo.get_fuel_codes_paginated(pagination)
    assert len(fuel_codes) <= 10
