import pytest
from unittest.mock import MagicMock, AsyncMock

from lcfs.db.base import ActionTypeEnum
from lcfs.tests.other_uses.conftest import create_mock_schema, create_mock_entity
from lcfs.web.api.other_uses.repo import OtherUsesRepository
from lcfs.web.api.other_uses.schema import OtherUsesSchema
from lcfs.web.api.other_uses.schema import (
    OtherUsesTableOptionsSchema,
)
from lcfs.web.api.other_uses.services import OtherUsesServices


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

    response = await service.get_table_options("2024")

    assert isinstance(response, OtherUsesTableOptionsSchema)
    mock_repo.get_table_options.assert_awaited_once()


@pytest.mark.anyio
async def test_create_other_use(other_uses_service):
    service, mock_repo, mock_fuel_repo = other_uses_service

    # Mock the schema data
    other_use_data = create_mock_schema({})

    # Mock related entities for other uses with actual string attributes
    mock_fuel_type = create_mock_entity({})
    mock_fuel_type.fuel_type = "Gasoline"

    mock_fuel_category = MagicMock()
    mock_fuel_category.category = "Petroleum-based"

    mock_expected_use = MagicMock()
    mock_expected_use.name = "Transportation"

    mock_provision_of_the_act = MagicMock()
    mock_provision_of_the_act.name = "Provision A"

    mock_fuel_code = MagicMock()
    mock_fuel_code.fuel_code = "FuelCode123"

    # Mock fuel repository methods
    mock_fuel_repo.get_fuel_category_by = AsyncMock(return_value=mock_fuel_category)
    mock_fuel_repo.get_fuel_type_by_name = AsyncMock(return_value=mock_fuel_type)
    mock_fuel_repo.get_expected_use_type_by_name = AsyncMock(
        return_value=mock_expected_use
    )
    mock_fuel_repo.get_provision_of_the_act_by_name = AsyncMock(
        return_value=mock_provision_of_the_act
    )
    mock_fuel_repo.get_fuel_code_by_name = AsyncMock(return_value=mock_fuel_code)

    # Create a mock for the created other use
    mock_created_use = create_mock_entity({})
    mock_created_use.other_uses_id = 1
    mock_created_use.compliance_report_id = 1
    mock_created_use.quantity_supplied = 1000
    mock_created_use.fuel_type = mock_fuel_type
    mock_created_use.fuel_category = mock_fuel_category
    mock_created_use.expected_use = mock_expected_use
    mock_created_use.provision_of_the_act = mock_provision_of_the_act
    mock_created_use.fuel_code = mock_fuel_code
    mock_created_use.units = "L"
    mock_created_use.ci_of_fuel = 10.5
    mock_created_use.rationale = "Test rationale"
    mock_created_use.group_uuid = "test-group-uuid"
    mock_created_use.version = 1
    mock_created_use.action_type = "Create"

    mock_repo.create_other_use = AsyncMock(return_value=mock_created_use)

    response = await service.create_other_use(other_use_data)

    # Assertions
    assert isinstance(response, OtherUsesSchema)
    assert response.fuel_type == "Gasoline"
    assert response.fuel_category == "Petroleum-based"
    assert response.expected_use == "Transportation"
    assert response.fuel_code == "FuelCode123"

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
    mock_repo.get_other_use = AsyncMock(return_value=mock_existing_use)

    # Mock related entities with proper string attributes
    mock_fuel_type = MagicMock()
    mock_fuel_type.fuel_type = "Diesel"

    mock_fuel_category = MagicMock()
    mock_fuel_category.category = "Petroleum-based"

    mock_expected_use = MagicMock()
    mock_expected_use.name = "Transportation"

    mock_provision_of_the_act = MagicMock()
    mock_provision_of_the_act.name = "Provision B"

    mock_fuel_code = MagicMock()
    mock_fuel_code.fuel_code = "NewFuelCode"

    # Mock fuel repository methods
    mock_fuel_repo.get_fuel_type_by_name = AsyncMock(return_value=mock_fuel_type)
    mock_fuel_repo.get_fuel_category_by = AsyncMock(return_value=mock_fuel_category)
    mock_fuel_repo.get_expected_use_type_by_name = AsyncMock(
        return_value=mock_expected_use
    )
    mock_fuel_repo.get_provision_of_the_act_by_name = AsyncMock(
        return_value=mock_provision_of_the_act
    )
    mock_fuel_repo.get_fuel_code_by_name = AsyncMock(return_value=mock_fuel_code)

    # Mock the updated use returned after the update
    mock_updated_use = MagicMock()
    mock_updated_use.other_uses_id = 1
    mock_updated_use.compliance_report_id = 1
    mock_updated_use.quantity_supplied = 2222
    mock_updated_use.rationale = "Updated rationale"
    mock_updated_use.units = "L"
    mock_updated_use.fuel_type = mock_fuel_type
    mock_updated_use.fuel_category = mock_fuel_category
    mock_updated_use.expected_use = mock_expected_use
    mock_updated_use.provision_of_the_act = mock_provision_of_the_act
    mock_updated_use.fuel_code = mock_fuel_code
    mock_updated_use.ci_of_fuel = 15.5
    mock_updated_use.group_uuid = "test-group-uuid"
    mock_updated_use.version = 2
    mock_updated_use.action_type = ActionTypeEnum.UPDATE

    # Set the return value for update_other_use
    mock_repo.update_other_use = AsyncMock(return_value=mock_updated_use)

    # Execute the update function and capture the response
    response = await service.update_other_use(other_use_data)

    # Assertions
    assert isinstance(response, OtherUsesSchema)
    assert response.action_type == ActionTypeEnum.UPDATE.value
    assert response.quantity_supplied == 2222
    assert response.rationale == "Updated rationale"
    assert response.fuel_type == "Diesel"
    assert response.fuel_category == "Petroleum-based"
    assert response.expected_use == "Transportation"
    assert response.provision_of_the_act == "Provision B"
    assert response.fuel_code == "NewFuelCode"

    # Check that the update method was called
    mock_repo.update_other_use.assert_awaited_once()


@pytest.mark.anyio
async def test_update_other_use_not_found(other_uses_service):
    service, mock_repo, _ = other_uses_service
    other_use_data = create_mock_schema({})

    mock_repo.get_other_use = AsyncMock(return_value=None)

    with pytest.raises(ValueError, match="Other use not found"):
        await service.update_other_use(other_use_data)


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
    response = await service.delete_other_use(other_use_data)

    # Assertions
    assert response.message == "Marked as deleted."
    mock_repo.create_other_use.assert_awaited_once()
