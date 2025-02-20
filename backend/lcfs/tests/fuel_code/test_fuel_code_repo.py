from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.exc import NoResultFound

from lcfs.db.models.fuel.AdditionalCarbonIntensity import AdditionalCarbonIntensity
from lcfs.db.models.fuel.EnergyDensity import EnergyDensity
from lcfs.db.models.fuel.EnergyEffectivenessRatio import EnergyEffectivenessRatio
from lcfs.db.models.fuel.ExpectedUseType import ExpectedUseType
from lcfs.db.models.fuel.FuelCategory import FuelCategory
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelCodePrefix import FuelCodePrefix
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatus, FuelCodeStatusEnum
from lcfs.db.models.fuel.FuelType import FuelType
from lcfs.db.models.fuel.ProvisionOfTheAct import ProvisionOfTheAct
from lcfs.db.models.fuel.TargetCarbonIntensity import TargetCarbonIntensity
from lcfs.db.models.fuel.TransportMode import TransportMode
from lcfs.db.models.fuel.UnitOfMeasure import UnitOfMeasure
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.exception.exceptions import DatabaseException


@pytest.fixture
def mock_db():
    """Fixture for mocking the database session."""
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock()
    mock_session.get_one = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.flush = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.scalar = AsyncMock()
    return mock_session


@pytest.fixture
def fuel_code_repo(mock_db):
    """Fixture for creating a repository with a mocked database."""
    repo = FuelCodeRepository()
    repo.db = mock_db
    return repo


@pytest.fixture
def valid_fuel_code():
    """Fixture for creating a repository with a mocked database."""
    fc = FuelCode(
        fuel_code_id=5,
        fuel_suffix="105.0",
        prefix_id=1,  # Assuming prefix_id=1 exists
        fuel_type_id=1,  # Assuming fuel_type_id=1 exists
        company="Test Company",
        contact_name="Test Contact",
        contact_email="test@example.com",
        carbon_intensity=50.00,
        edrms="EDRMS-001",
        application_date=date.today(),
        feedstock="Corn",
        feedstock_location="USA",
        feedstock_misc="",
        fuel_production_facility_city="CityA",
        fuel_production_facility_province_state="ProvinceA",
        fuel_production_facility_country="CountryA",
        last_updated=date.today(),
    )
    return fc


@pytest.mark.anyio
async def test_get_fuel_types(fuel_code_repo, mock_db):
    mock_fuel_type = FuelType(fuel_type_id=1, fuel_type="Diesel")
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_fuel_type]

    mock_db.execute.return_value = mock_result
    result = await fuel_code_repo.get_fuel_types()
    assert len(result) == 1
    assert result[0] == mock_fuel_type
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_formatted_fuel_types(fuel_code_repo, mock_db):
    # Setup mock data
    mock_fuel_type = FuelType(
        fuel_type_id=1,
        fuel_type="Diesel",
        default_carbon_intensity=80.0,
        units="gCO2e/MJ",
        unrecognized=False,
    )
    mock_result = MagicMock()
    mock_result.unique.return_value.scalars.return_value.all.return_value = [
        mock_fuel_type
    ]
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_formatted_fuel_types()
    assert len(result) == 1
    assert result[0]["fuel_type"] == "Diesel"
    mock_db.execute.assert_called_once()

    # Test with compliance period
    mock_db.execute.reset_mock()
    mock_db.execute.return_value = mock_result
    fuel_code_repo.get_compliance_period_id = AsyncMock(return_value=1)

    result = await fuel_code_repo.get_formatted_fuel_types(compliance_period="2024")
    assert len(result) == 1
    assert result[0]["fuel_type"] == "Diesel"
    assert mock_db.execute.call_count > 0


@pytest.mark.anyio
async def test_get_fuel_type_by_name_found(fuel_code_repo, mock_db):
    mock_fuel_type = FuelType(fuel_type_id=2, fuel_type="Gasoline")
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = mock_fuel_type
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_fuel_type_by_name("Gasoline")
    assert result == mock_fuel_type


@pytest.mark.anyio
async def test_get_fuel_type_by_name_not_found(fuel_code_repo, mock_db):
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None
    mock_db.execute.return_value = mock_result

    with pytest.raises(DatabaseException):
        await fuel_code_repo.get_fuel_type_by_name("Nonexistent")


@pytest.mark.anyio
async def test_get_fuel_type_by_id_found(fuel_code_repo, mock_db):
    mock_fuel_type = FuelType(fuel_type_id=3, fuel_type="Biofuel")
    mock_db.get_one.return_value = mock_fuel_type

    result = await fuel_code_repo.get_fuel_type_by_id(3)
    assert result == mock_fuel_type
    mock_db.get_one.assert_called_once()


@pytest.mark.anyio
async def test_get_fuel_type_by_id_not_found(fuel_code_repo, mock_db):
    mock_db.get_one.return_value = None
    with pytest.raises(DatabaseException):
        await fuel_code_repo.get_fuel_type_by_id(999)


@pytest.mark.anyio
async def test_get_fuel_categories(fuel_code_repo, mock_db):
    mock_fc = FuelCategory(
        fuel_category_id=1, category="Renewable", default_carbon_intensity=0
    )
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_fc]
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_fuel_categories()
    assert len(result) == 1
    assert result[0] == mock_fc


@pytest.mark.anyio
async def test_get_fuel_category_by(fuel_code_repo, mock_db):
    mock_fc = FuelCategory(
        fuel_category_id=2, category="Fossil", default_carbon_intensity=0
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_fc
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_fuel_category_by(category="Fossil")
    assert result == mock_fc


@pytest.mark.anyio
async def test_get_transport_modes(fuel_code_repo, mock_db):
    mock_tm = TransportMode(transport_mode_id=1, transport_mode="Truck")
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_tm]
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_transport_modes()
    assert len(result) == 1
    assert result[0] == mock_tm


@pytest.mark.anyio
async def test_get_transport_mode(fuel_code_repo, mock_db):
    mock_tm = TransportMode(transport_mode_id=10, transport_mode="Ship")
    mock_db.scalar.return_value = mock_tm

    result = await fuel_code_repo.get_transport_mode(10)
    assert result == mock_tm
    mock_db.scalar.assert_called_once()


@pytest.mark.anyio
async def test_get_transport_mode_by_name_found(fuel_code_repo, mock_db):
    mock_tm = TransportMode(transport_mode_id=1, transport_mode="Truck")
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = mock_tm
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_transport_mode_by_name("Truck")
    assert result == mock_tm


@pytest.mark.anyio
async def test_get_transport_mode_by_name_not_found(fuel_code_repo, mock_db):
    mock_result = MagicMock()
    mock_result.scalar_one.side_effect = NoResultFound
    mock_db.execute.return_value = mock_result

    with pytest.raises(DatabaseException):
        await fuel_code_repo.get_transport_mode_by_name("NonexistentMode")


@pytest.mark.anyio
async def test_get_fuel_code_prefixes(fuel_code_repo, mock_db):
    mock_prefix = FuelCodePrefix(fuel_code_prefix_id=1, prefix="BC")
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_prefix]
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_fuel_code_prefixes()
    assert len(result) == 1
    assert result[0] == mock_prefix


@pytest.mark.anyio
async def test_get_fuel_code_prefix(fuel_code_repo, mock_db):
    mock_prefix = FuelCodePrefix(fuel_code_prefix_id=2, prefix="AB")
    mock_db.get_one.return_value = mock_prefix

    result = await fuel_code_repo.get_fuel_code_prefix(2)
    assert result == mock_prefix


@pytest.mark.anyio
async def test_get_fuel_status_by_status(fuel_code_repo, mock_db):
    mock_status = FuelCodeStatus(
        fuel_code_status_id=1, status=FuelCodeStatusEnum.Approved
    )
    mock_result = MagicMock()
    mock_result.scalar.return_value = mock_status
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_fuel_status_by_status(FuelCodeStatusEnum.Approved)
    assert result == mock_status


@pytest.mark.anyio
async def test_get_energy_densities(fuel_code_repo, mock_db):
    ed = EnergyDensity(energy_density_id=1, density=35.0)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [ed]
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_energy_densities()
    assert len(result) == 1
    assert result[0] == ed


@pytest.mark.anyio
async def test_get_energy_density(fuel_code_repo, mock_db):
    ed = EnergyDensity(energy_density_id=2, density=40.0)
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = ed
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_energy_density(
        fuel_type_id=10,
        compliance_period_id=1
    )
    assert result == ed


@pytest.mark.anyio
async def test_get_energy_effectiveness_ratios(fuel_code_repo, mock_db):
    eer = EnergyEffectivenessRatio(eer_id=1, ratio=2.0)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [eer]
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_energy_effectiveness_ratios()
    assert len(result) == 1
    assert result[0] == eer


@pytest.mark.anyio
async def test_get_units_of_measure(fuel_code_repo, mock_db):
    uom = UnitOfMeasure(uom_id=1, name="gCO2e/MJ")
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [uom]
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_units_of_measure()
    assert len(result) == 1
    assert result[0] == uom


@pytest.mark.anyio
async def test_get_expected_use_types(fuel_code_repo, mock_db):
    eut = ExpectedUseType(expected_use_type_id=1, name="Vehicle")
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [eut]
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_expected_use_types()
    assert len(result) == 1
    assert result[0] == eut


@pytest.mark.anyio
async def test_get_expected_use_type_by_name(fuel_code_repo, mock_db):
    eut = ExpectedUseType(expected_use_type_id=2, name="Heating")
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = eut
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_expected_use_type_by_name("Heating")
    assert result == eut


@pytest.mark.anyio
async def test_get_fuel_codes_paginated(fuel_code_repo, mock_db):
    fc = FuelCode(fuel_code_id=1, fuel_suffix="101.0")
    mock_db.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=FuelCodeStatus())),
        MagicMock(scalar=MagicMock(return_value=1)),
        MagicMock(
            unique=MagicMock(
                return_value=MagicMock(
                    scalars=MagicMock(
                        return_value=MagicMock(
                            all=MagicMock(return_value=[fc]))
                    )
                )
            )
        ),
    ]
    pagination = MagicMock(page=1, size=10, filters=[], sort_orders=[])
    result, count = await fuel_code_repo.get_fuel_codes_paginated(pagination)
    assert len(result) == 1
    assert result[0] == fc
    assert count == 1


@pytest.mark.anyio
async def test_get_fuel_code_statuses(fuel_code_repo, mock_db):
    fcs = FuelCodeStatus(fuel_code_status_id=1,
                         status=FuelCodeStatusEnum.Approved)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [fcs]
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_fuel_code_statuses()
    assert len(result) == 1
    assert result[0] == fcs


@pytest.mark.anyio
async def test_create_fuel_code(fuel_code_repo, mock_db, valid_fuel_code):
    mock_db.flush = AsyncMock()
    mock_db.scalar.return_value = valid_fuel_code

    result = await fuel_code_repo.create_fuel_code(valid_fuel_code)
    assert result == valid_fuel_code
    mock_db.add.assert_called_once_with(valid_fuel_code)


@pytest.mark.anyio
async def test_get_fuel_code(fuel_code_repo, mock_db, valid_fuel_code):
    mock_db.scalar.return_value = valid_fuel_code
    result = await fuel_code_repo.get_fuel_code(1)
    assert result == valid_fuel_code


@pytest.mark.anyio
async def test_get_fuel_code_status_enum(fuel_code_repo, mock_db):
    fcs = FuelCodeStatus(fuel_code_status_id=2,
                         status=FuelCodeStatusEnum.Deleted)
    mock_db.scalar.return_value = fcs
    result = await fuel_code_repo.get_fuel_code_status(FuelCodeStatusEnum.Deleted)
    assert result == fcs


@pytest.mark.anyio
async def test_update_fuel_code(fuel_code_repo, mock_db, valid_fuel_code):
    mock_db.flush = AsyncMock()
    mock_db.refresh = AsyncMock()
    updated = await fuel_code_repo.update_fuel_code(valid_fuel_code)
    assert updated.fuel_code_id == 5


@pytest.mark.anyio
async def test_delete_fuel_code(fuel_code_repo, mock_db):
    mock_delete_status = FuelCodeStatus(
        fuel_code_status_id=3, status=FuelCodeStatusEnum.Deleted
    )
    mock_execute_result = MagicMock()
    mock_execute_result.scalar.return_value = mock_delete_status
    mock_db.execute.return_value = mock_execute_result

    mock_db.flush = AsyncMock()

    await fuel_code_repo.delete_fuel_code(10)
    mock_db.execute.assert_awaited()  # Check that execute was awaited


@pytest.mark.anyio
async def test_get_distinct_company_names(fuel_code_repo, mock_db):
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [
        "CompanyA", "CompanyB"]
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_distinct_company_names("Com")
    assert len(result) == 2


@pytest.mark.anyio
async def test_get_contact_names_by_company(fuel_code_repo, mock_db):
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [
        "John Doe", "Jane Doe"]
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_contact_names_by_company("CompanyA", "J")
    assert len(result) == 2


@pytest.mark.anyio
async def test_get_contact_email_by_company_and_name(fuel_code_repo, mock_db):
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = ["john@example.com"]
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_contact_email_by_company_and_name(
        "CompanyA", "John Doe", "john@"
    )
    assert len(result) == 1


@pytest.mark.anyio
async def test_get_distinct_fuel_codes_by_code(fuel_code_repo, mock_db):
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = ["101.0", "101.1"]
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_distinct_fuel_codes_by_code("101", "BC")
    assert len(result) == 2


@pytest.mark.anyio
async def test_get_fuel_code_by_code_prefix(fuel_code_repo, mock_db):
    fc = FuelCode(fuel_code_id=10, fuel_suffix="200.0")
    mock_result = MagicMock()
    mock_result.unique.return_value.scalars.return_value.all.return_value = [
        fc]
    mock_db.execute.return_value = mock_result

    # Mock the next available suffix
    fuel_code_repo.get_next_available_sub_version_fuel_code_by_prefix = AsyncMock(
        return_value="200.1"
    )

    result = await fuel_code_repo.get_fuel_code_by_code_prefix("200.0", "BC")
    assert len(result) == 1
    assert result[0].fuel_suffix == "200.1"


@pytest.mark.anyio
async def test_validate_fuel_code(fuel_code_repo, mock_db):
    # Mock no existing code
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.validate_fuel_code("300.0", 1)
    assert result == "300.0"

    # Mock existing code
    mock_result.scalar_one_or_none.return_value = FuelCode(
        fuel_code_id=5, fuel_suffix="300.0"
    )
    mock_db.execute.return_value = mock_result
    fuel_code_repo.get_next_available_sub_version_fuel_code_by_prefix = AsyncMock(
        return_value="300.1"
    )
    result = await fuel_code_repo.validate_fuel_code("300.0", 1)
    assert result == "300.1"


@pytest.mark.anyio
async def test_get_next_available_fuel_code_by_prefix(fuel_code_repo, mock_db):
    mock_execute_result = MagicMock()
    mock_execute_result.scalar_one_or_none.return_value = "102.0"
    mock_db.execute.return_value = mock_execute_result

    result = await fuel_code_repo.get_next_available_fuel_code_by_prefix("BC")
    assert result == "102.0"


@pytest.mark.anyio
async def test_get_next_available_sub_version_fuel_code_by_prefix(
    fuel_code_repo, mock_db
):
    mock_execute_result = MagicMock()
    mock_execute_result.scalar_one_or_none.return_value = "200.1"
    mock_db.execute.return_value = mock_execute_result

    result = await fuel_code_repo.get_next_available_sub_version_fuel_code_by_prefix(
        "200", 1
    )
    assert result == "200.1"


@pytest.mark.anyio
async def test_get_latest_fuel_codes(fuel_code_repo, mock_db, valid_fuel_code):
    prefix = FuelCodePrefix(fuel_code_prefix_id=1, prefix="BC")
    valid_fuel_code.fuel_code_prefix = prefix

    mock_result = MagicMock()
    mock_result.unique.return_value.scalars.return_value.all.return_value = [
        valid_fuel_code
    ]
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_latest_fuel_codes()
    assert len(result) == 1
    # The code increments the version, e.g. "BC101.0" -> "BC101.1"
    # Assuming suffix "105.0":
    assert result[0]["fuel_code"].endswith(".1")


@pytest.mark.anyio
async def test_get_fuel_code_field_options(fuel_code_repo, mock_db):
    mock_execute_result = MagicMock()
    mock_execute_result.all.return_value = [
        ("CompanyA", "Corn", "USA", None, None, "John Doe", "john@example.com")
    ]
    mock_db.execute.return_value = mock_execute_result

    result = await fuel_code_repo.get_fuel_code_field_options()
    assert len(result) == 1


@pytest.mark.anyio
async def test_get_fp_locations(fuel_code_repo, mock_db):
    mock_execute_result = MagicMock()
    mock_execute_result.all.return_value = [("CityA", "ProvinceA", "CountryA")]
    mock_db.execute.return_value = mock_execute_result

    result = await fuel_code_repo.get_fp_locations()
    assert len(result) == 1


@pytest.mark.anyio
async def test_get_fuel_code_by_name(fuel_code_repo, mock_db):
    fc = FuelCode(fuel_code_id=50, fuel_suffix="150.0")
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = fc
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_fuel_code_by_name("BC150.0")
    assert result == fc


@pytest.mark.anyio
async def test_get_provision_of_the_act_by_name(fuel_code_repo, mock_db):
    poa = ProvisionOfTheAct(provision_of_the_act_id=1, name="Act Name")
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = poa
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_provision_of_the_act_by_name("Act Name")
    assert result == poa


@pytest.mark.anyio
async def test_get_energy_effectiveness_ratio(fuel_code_repo, mock_db):
    eer = EnergyEffectivenessRatio(eer_id=1, ratio=1.5)
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = eer
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_energy_effectiveness_ratio(
        fuel_type_id=1,
        fuel_category_id=2,
        compliance_period_id=3,
        end_use_type_id=4
    )
    assert result == eer


@pytest.mark.anyio
async def test_get_target_carbon_intensity(fuel_code_repo, mock_db):
    tci = TargetCarbonIntensity(
        target_carbon_intensity_id=1, target_carbon_intensity=50.0
    )
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = tci
    mock_db.execute.return_value = mock_result

    result = await fuel_code_repo.get_target_carbon_intensity(1, "2024")
    assert result == tci


@pytest.mark.anyio
async def test_get_standardized_fuel_data(fuel_code_repo, mock_db):
    # Mock dependencies
    mock_fuel_type = FuelType(
        fuel_type_id=1, fuel_type="Diesel", default_carbon_intensity=80.0
    )
    mock_db.get_one.return_value = mock_fuel_type
    # Mock get_compliance_period_id
    fuel_code_repo.get_compliance_period_id = AsyncMock(return_value=1)

    mock_db.execute.side_effect = [
        # energy density
        MagicMock(
            scalars=MagicMock(
                return_value=MagicMock(
                    first=MagicMock(
                        return_value=EnergyDensity(
                            energy_density_id=1,
                            density=35.0,
                            fuel_type_id=1,
                            compliance_period_id=1
                        )
                    )
                )
            )
        ),
        # eer
        MagicMock(
            scalars=MagicMock(
                return_value=MagicMock(
                    first=MagicMock(
                        return_value=EnergyEffectivenessRatio(ratio=2.0))
                )
            )
        ),
        # target carbon intensities
        MagicMock(
            scalar_one=MagicMock(
                return_value=TargetCarbonIntensity(target_carbon_intensity=50.0)
            )
        ),
        # additional carbon intensity
        MagicMock(
            scalars=MagicMock(
                return_value=MagicMock(
                    one_or_none=MagicMock(
                        return_value=AdditionalCarbonIntensity(intensity=5.0)
                    )
                )
            )
        ),
    ]

    result = await fuel_code_repo.get_standardized_fuel_data(
        fuel_type_id=1, fuel_category_id=2, end_use_id=3, compliance_period="2024"
    )
    assert result.effective_carbon_intensity == 80.0
    assert result.target_ci == 50.0
    assert result.eer == 2.0
    assert result.energy_density == 35.0
    assert result.uci == 5.0


@pytest.mark.anyio
async def test_get_standardized_fuel_data_unrecognized(fuel_code_repo, mock_db):
    # Mock an unrecognized fuel type
    mock_fuel_type = FuelType(
        fuel_type_id=1,
        fuel_type="UnknownFuel",
        unrecognized=True,
    )

    # Mock a fuel category with a default CI
    mock_fuel_category = FuelCategory(
        fuel_category_id=2, category="SomeCategory", default_carbon_intensity=93.67
    )

    # Mock compliance period ID
    fuel_code_repo.get_compliance_period_id = AsyncMock(return_value=1)

    # The repo uses get_one to get the fuel type.
    mock_db.get_one.return_value = mock_fuel_type

    # Mock the repo method to get the fuel category
    fuel_code_repo.get_fuel_category_by = AsyncMock(
        return_value=mock_fuel_category)

    # Setup side effects for subsequent queries:
    # Energy Density
    energy_density_result = MagicMock(
        scalars=MagicMock(
            return_value=MagicMock(
                first=MagicMock(return_value=EnergyDensity(
                    energy_density_id=1,
                    density=35.0,
                    fuel_type_id=1,
                    compliance_period_id=1
                ))
            )
        )
    )
    # EER
    eer_result = MagicMock(
        scalars=MagicMock(
            return_value=MagicMock(
                first=MagicMock(
                    return_value=EnergyEffectivenessRatio(ratio=2.0))
            )
        )
    )
    # Target Carbon Intensities
    tci_result = MagicMock(
        scalar_one=MagicMock(
            return_value=TargetCarbonIntensity(target_carbon_intensity=50.0)
        )
    )
    # Additional Carbon Intensity
    aci_result = MagicMock(
        scalars=MagicMock(
            return_value=MagicMock(
                one_or_none=MagicMock(
                    return_value=AdditionalCarbonIntensity(intensity=5.0)
                )
            )
        )
    )

    # Set the side_effect for the mock_db.execute calls in the order they're invoked
    mock_db.execute.side_effect = [
        energy_density_result,
        eer_result,
        tci_result,
        aci_result,
    ]

    result = await fuel_code_repo.get_standardized_fuel_data(
        fuel_type_id=1, fuel_category_id=2, end_use_id=3, compliance_period="2024"
    )

    # Since fuel_type is unrecognized, it should use the FuelCategory's default CI
    assert result.effective_carbon_intensity == 93.67
    assert result.target_ci == 50.0
    assert result.eer == 2.0
    assert result.energy_density == 35.0
    assert result.uci == 5.0

    # Ensure get_fuel_category_by was called once with the correct parameter
    fuel_code_repo.get_fuel_category_by.assert_awaited_once_with(
        fuel_category_id=2)


@pytest.mark.anyio
async def test_get_additional_carbon_intensity(fuel_code_repo, mock_db):
    aci = AdditionalCarbonIntensity(additional_uci_id=1, intensity=10.0)
    mock_result = MagicMock()
    mock_result.scalars.return_value.one_or_none.return_value = aci
    mock_db.execute.return_value = mock_result

    # Added the compliance_period as required
    result = await fuel_code_repo.get_additional_carbon_intensity(1, 2, "2025")
    assert result == aci
