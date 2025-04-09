import pytest
from unittest.mock import AsyncMock
from uuid import uuid4

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models import ProvisionOfTheAct, FuelType, FuelCategory, EndUseType
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.web.api.fuel_supply.actions_service import FuelSupplyActionService
from lcfs.web.api.fuel_supply.schema import (
    FuelSupplyCreateUpdateSchema,
)
from lcfs.web.api.fuel_supply.services import FuelSupplyServices


# Constants defining fields to exclude during model operations
FUEL_SUPPLY_EXCLUDE_FIELDS = {
    "id",
    "fuel_supply_id",
    "deleted",
    "group_uuid",
    "version",
    "action_type",
    "units",
    "is_new_supplemental_entry",
}

# Global mocks for common schema fields
FUEL_TYPE_MOCK = FuelType(fuel_type_id=3, fuel_type="Electricity", units="kWh")
FUEL_CATEGORY_MOCK = FuelCategory(category="Diesel")


@pytest.fixture
def mock_fuel_code_repo():
    fuel_code_repo = AsyncMock()
    fuel_code_repo.get_standardized_fuel_data = AsyncMock()
    return fuel_code_repo


@pytest.fixture
def mock_fuel_supply_service():
    return FuelSupplyServices()


@pytest.fixture
def fuel_supply_action_service(
    mock_repo, mock_fuel_code_repo, mock_fuel_supply_service
):
    return FuelSupplyActionService(
        repo=mock_repo,
        fuel_repo=mock_fuel_code_repo,
        fuel_supply_service=mock_fuel_supply_service,
    )


@pytest.fixture
def mock_fuel_supply(mock_fuel_code_repo, mock_fuel_supply_service):
    fe_data = create_sample_fs_data()
    fe_data_dict = fe_data.model_dump(exclude=FUEL_SUPPLY_EXCLUDE_FIELDS)
    return FuelSupply(
        **fe_data_dict,
        fuel_supply_id=1,
        version=0,
        group_uuid="test_uuid",
        action_type=ActionTypeEnum.UPDATE,
        compliance_units=-100,
        fuel_category=FuelCategory(category="Diesel"),
        units="Litres",
        provision_of_the_act=ProvisionOfTheAct(name="Mock Provision"),
        fuel_type=FuelType(
            fuel_type_id=3,
            fuel_type="Electricity",
            units="kWh",
        ),
        end_use_type=EndUseType(type="Mock Type"),
    )


# Helper function to create sample FuelSupplyCreateUpdateSchema data
def create_sample_fs_data() -> FuelSupplyCreateUpdateSchema:
    return FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=1,
        fuel_code_id=1,
        quantity=1000,
        units="L",
        energy_density=35.0,
        group_uuid=str(uuid4()),
        version=0,
        provision_of_the_act_id=123,
    )
