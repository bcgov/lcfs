from unittest.mock import MagicMock, AsyncMock

import pytest

from lcfs.db.base import ActionTypeEnum
from lcfs.db.base import UserTypeEnum
from lcfs.web.api.other_uses.repo import OtherUsesRepository
from lcfs.web.api.other_uses.schema import OtherUsesSchema
from lcfs.web.api.other_uses.schema import (
    OtherUsesTableOptionsSchema,
)
from lcfs.web.api.other_uses.services import OtherUsesServices
from lcfs.web.exception.exceptions import ServiceException
from lcfs.tests.other_uses.conftest import create_mock_schema, create_mock_entity


@pytest.fixture
def other_uses_service():
    mock_repo = MagicMock(spec=OtherUsesRepository)
    mock_fuel_repo = MagicMock()
    service = OtherUsesServices(repo=mock_repo, fuel_repo=mock_fuel_repo)
    return service, mock_repo, mock_fuel_repo


@pytest.mark.anyio
async def test_get_table_options(other_uses_service):
    service, mock_repo, _ = other_uses_service
    mock_repo.get_table_options = AsyncMock(
        return_value={
            "fuel_categories": [],
            "fuel_types": [],
            "units_of_measure": [],
            "expected_uses": [],
            "provisions_of_the_act": [],
            "fuel_codes": [],
        }
    )

    response = await service.get_table_options()

    assert isinstance(response, OtherUsesTableOptionsSchema)
    mock_repo.get_table_options.assert_awaited_once()


@pytest.mark.anyio
async def test_create_other_use(other_uses_service):
    service, mock_repo, mock_fuel_repo = other_uses_service

    # Mock the schema data
    other_use_data = create_mock_schema({})

    # Mock fuel repository methods to return valid mocked data
    mock_fuel_repo.get_fuel_category_by_name = AsyncMock(
        return_value=MagicMock(fuel_category_id=1, category="Petroleum-based")
    )
    mock_fuel_repo.get_fuel_type_by_name = AsyncMock(
        return_value=MagicMock(fuel_type_id=1, fuel_type="Gasoline")
    )
    mock_fuel_repo.get_expected_use_type_by_name = AsyncMock(
        return_value=MagicMock(expected_use_type_id=1, name="Transportation")
    )
    mock_fuel_repo.get_provision_of_the_act_by_name = AsyncMock(
        return_value=MagicMock(provision_of_the_act_id=1, name="Act123")
    )
    mock_fuel_repo.get_fuel_code_by_name = AsyncMock(
        return_value=MagicMock(fuel_code_id=1, fuel_code="Code123")
    )

    # Mock the created entity to match the expected schema structure
    mock_created_use = MagicMock(
        other_uses_id=1,
        compliance_report_id=2,
        quantity_supplied=100.0,
        rationale="Rationale test",
        units="Liters",
        fuel_type=MagicMock(fuel_type="Gasoline"),
        fuel_category=MagicMock(category="Petroleum-based"),
        provision_of_the_act="Act123",  # Mock as string
        expected_use=MagicMock(name="Transportation"),
        expected_use="Transportation",  # Mock as string
    )
    mock_repo.create_other_use = AsyncMock(return_value=mock_created_use)

    # Call the service method
    response = await service.create_other_use(other_use_data, UserTypeEnum.SUPPLIER)

    # Validate the response
    assert isinstance(response, OtherUsesSchema)
    assert response.fuel_type == "Gasoline"
    assert response.fuel_category == "Petroleum-based"
    assert response.expected_use == "Transportation"
    assert response.provision_of_the_act == "Act123"
    assert response.fuel_code == "Code123"

    # Ensure the repository method was called as expected
    mock_repo.create_other_use.assert_awaited_once()


@pytest.mark.anyio
async def test_update_other_use(other_uses_service):
    service, mock_repo, mock_fuel_repo = other_uses_service

    # Create test data with OtherUsesCreateSchema
    other_use_data = create_mock_schema(
        {"quantity_supplied": 4444, "rationale": "Updated rationale"}
    )
    mock_existing_use = create_mock_entity({})

    # Configure repository methods to return these mocked objects
    mock_repo.get_other_use_version_by_user = AsyncMock(return_value=mock_existing_use)
    mock_fuel_repo.get_fuel_type_by_name = AsyncMock(
        return_value=MagicMock(fuel_type="Diesel")
    )
    mock_fuel_repo.get_fuel_category_by_name = AsyncMock(
        return_value=MagicMock(category="Petroleum-based")
    )
    mock_fuel_repo.get_expected_use_type_by_name = AsyncMock(
        return_value=MagicMock(name="Transportation")
    )
    mock_fuel_repo.get_provision_of_the_act_by_name = AsyncMock(
        return_value=MagicMock(name="Provision B")
    )
    # Mock the updated use that will be returned after the update
    mock_updated_use = create_mock_entity(
        {
            "rationale": "Updated rationale",
            "action_type": ActionTypeEnum.UPDATE,
            "quantity_supplied": 2222,
        }
    )

    mock_updated_use.provision_of_the_act = MagicMock()
    mock_updated_use.provision_of_the_act.name = "Provision B"
    mock_fuel_repo.get_fuel_code_by_name = AsyncMock(
        return_value=MagicMock(fuel_code="NewFuelCode")
    )
    # Set the return value for update_other_use
    mock_repo.update_other_use = AsyncMock(return_value=mock_updated_use)

    # Execute the update function and capture the response
    response = await service.update_other_use(other_use_data, UserTypeEnum.SUPPLIER)

    # Assertions
    assert isinstance(response, OtherUsesSchema)
    assert response.action_type == ActionTypeEnum.UPDATE.value
    assert response.quantity_supplied == 2222
    assert response.rationale == "Updated rationale"

    # Check that the update method was called
    mock_repo.update_other_use.assert_awaited_once()


@pytest.mark.anyio
async def test_update_other_use_not_found(other_uses_service):
    service, mock_repo, _ = other_uses_service
    other_use_data = create_mock_schema({})

    mock_repo.get_other_use_version_by_user = AsyncMock(return_value=None)

    with pytest.raises(ServiceException):
        await service.update_other_use(other_use_data, UserTypeEnum.SUPPLIER)


@pytest.mark.anyio
async def test_delete_other_use(other_uses_service):
    service, mock_repo, _ = other_uses_service
    other_use_data = create_mock_schema({})

    # Mock the existing other use with a "CREATE" action type
    mock_existing_use = MagicMock()
    mock_existing_use.group_uuid = "test-group-uuid"
    mock_existing_use.version = 1
    mock_existing_use.action_type = ActionTypeEnum.CREATE

    # Set up the mock __table__.columns.keys() to return field names as a list
    mock_existing_use.__table__ = MagicMock()
    mock_existing_use.__table__.columns.keys.return_value = [
        "other_uses_id",
        "compliance_report_id",
        "quantity_supplied",
        "fuel_type",
        "fuel_category",
        "expected_use",
        "units",
        "rationale",
        "deleted",
        "group_uuid",
        "user_type",
        "version",
        "action_type",
    ]

    # Mock repository methods
    mock_repo.get_latest_other_uses_by_group_uuid = AsyncMock(
        return_value=mock_existing_use
    )
    mock_repo.create_other_use = AsyncMock(return_value=mock_existing_use)

    # Call the delete service
    response = await service.delete_other_use(other_use_data, UserTypeEnum.SUPPLIER)

    # Assertions
    assert response.message == "Marked as deleted."
    mock_repo.create_other_use.assert_awaited_once()
