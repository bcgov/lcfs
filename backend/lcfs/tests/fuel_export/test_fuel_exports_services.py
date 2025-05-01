import pytest
from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, AsyncMock

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance.FuelExport import FuelExport
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.fuel_export.schema import (
    FuelExportSchema,
    FuelExportCreateUpdateSchema,
    FuelTypeSchema,
    FuelCategoryResponseSchema,
    FuelExportsSchema,
    FuelTypeOptionsResponse,
    DeleteFuelExportResponseSchema,
)
from lcfs.web.exception.exceptions import ValidationErrorException
from lcfs.web.api.fuel_export.actions_service import FuelExportActionService

# Mock common data for reuse
mock_fuel_type = FuelTypeSchema(
    fuel_type_id=1,
    fuel_type="Diesel",
    fossil_derived=True,
    provision_1_id=None,
    provision_2_id=None,
    default_carbon_intensity=10.5,
    units="L",
)

mock_fuel_category = FuelCategoryResponseSchema(
    fuel_category_id=1,
    category="Diesel",
)

# FuelExportServices Tests


@pytest.mark.anyio
async def test_get_fuel_export_options_success(fuel_export_service, mock_repo):
    dummy_user = SimpleNamespace(id=1, role_names=[RoleEnum.GOVERNMENT])
    dummy_request = MagicMock()
    dummy_request.user = dummy_user
    fuel_export_service.request = dummy_request

    mock_repo.get_fuel_export_table_options.return_value = []
    result = await fuel_export_service.get_fuel_export_options("2024")
    assert isinstance(result, FuelTypeOptionsResponse)
    mock_repo.get_fuel_export_table_options.assert_called_once_with("2024")


@pytest.mark.anyio
async def test_get_fuel_export_list_success(fuel_export_service, mock_repo):
    # Set up a dummy request with a valid user
    dummy_user = SimpleNamespace(id=1, role_names=[RoleEnum.GOVERNMENT])
    dummy_request = MagicMock()
    dummy_request.user = dummy_user
    fuel_export_service.request = dummy_request

    # Create a mock FuelExport with all required fields
    mock_export = FuelExport(
        fuel_export_id=1,
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_type=mock_fuel_type,
        fuel_category_id=1,
        fuel_category=mock_fuel_category,
        quantity=100,
        units="L",
        export_date=date.today(),
        group_uuid="test-uuid",
        provision_of_the_act_id=1,
        provision_of_the_act={"provision_of_the_act_id": 1, "name": "Test Provision"},
        version=0,
        action_type=ActionTypeEnum.CREATE,
    )
    mock_repo.get_fuel_export_list.return_value = [mock_export]

    result = await fuel_export_service.get_fuel_export_list(1)

    assert isinstance(result, FuelExportsSchema)
    # Expect the repo call to include exclude_draft_reports=True based on the user
    mock_repo.get_fuel_export_list.assert_called_once_with(
        1, False, exclude_draft_reports=True
    )


@pytest.mark.anyio
async def test_get_fuel_exports_paginated_success(fuel_export_service, mock_repo):
    # Set up a dummy request with a valid user
    dummy_user = SimpleNamespace(id=1, role_names=[RoleEnum.GOVERNMENT])
    dummy_request = MagicMock()
    dummy_request.user = dummy_user
    fuel_export_service.request = dummy_request

    mock_export = FuelExport(
        fuel_export_id=1,
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_type=mock_fuel_type,
        fuel_category_id=1,
        fuel_category=mock_fuel_category,
        quantity=100,
        units="L",
        export_date=date.today(),
        provision_of_the_act_id=1,
        provision_of_the_act={"provision_of_the_act_id": 1, "name": "Test Provision"},
    )
    mock_repo.get_fuel_exports_paginated.return_value = ([mock_export], 1)

    pagination_mock = MagicMock()
    pagination_mock.page = 1
    pagination_mock.size = 10

    result = await fuel_export_service.get_fuel_exports_paginated(pagination_mock, 1)

    assert isinstance(result, FuelExportsSchema)
    assert result.pagination.total == 1
    assert result.pagination.page == 1
    assert result.pagination.size == 10
    # Expect the extra parameter to be passed
    mock_repo.get_fuel_exports_paginated.assert_called_once_with(pagination_mock, 1)


# FuelExportActionService Tests


@pytest.mark.anyio
async def test_action_create_fuel_export_success(fuel_export_action_service, mock_repo):
    input_data = FuelExportCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_type=mock_fuel_type.dict(),
        fuel_category_id=1,
        end_use_id=1,
        provisionOfTheActId=1,
        provisionOfTheAct="Test Provision",
        quantity=100,
        units="L",
        export_date=date.today(),
    )

    # Changing energy_density from MagicMock to be a real number
    class MockFuelData:
        def __init__(self):
            self.energy_density = 10.0
            self.effective_carbon_intensity = 90.0
            self.target_ci = 90.0
            self.eer = 1.0
            self.uci = 0.0

    mock_fuel_data = MockFuelData()

    fuel_export_action_service.fuel_repo.get_standardized_fuel_data = AsyncMock(
        return_value=mock_fuel_data
    )

    mock_created_export = FuelExport(
        fuel_export_id=1,
        compliance_report_id=1,
        group_uuid="test-uuid",
        version=0,
        action_type=ActionTypeEnum.CREATE,
        provision_of_the_act_id=1,
        provision_of_the_act={"provision_of_the_act_id": 1, "name": "Act Provision"},
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=1,
        quantity=100,
        units="L",
        export_date=date.today(),
        fuel_type=mock_fuel_type.dict(),
        fuel_category=mock_fuel_category.dict(),
    )
    mock_repo.create_fuel_export = AsyncMock(return_value=mock_created_export)

    result = await fuel_export_action_service.create_fuel_export(input_data, "2024")

    assert isinstance(result, FuelExportSchema)
    mock_repo.create_fuel_export.assert_awaited_once()


@pytest.mark.anyio
async def test_action_update_fuel_export_success(fuel_export_action_service, mock_repo):
    input_data = FuelExportCreateUpdateSchema(
        fuel_export_id=1,
        compliance_report_id=1,
        group_uuid="test-uuid",
        version=0,
        fuel_type_id=1,
        fuel_type=mock_fuel_type.dict(),
        fuel_category_id=1,
        end_use_id=1,
        quantity=100,
        provisionOfTheActId=1,
        provisionOfTheAct="Test Provision",
        units="L",
        export_date=date.today(),
    )

    # Changing energy_density from MagicMock to be a real number
    class MockFuelData:
        def __init__(self):
            self.energy_density = 10.0
            self.effective_carbon_intensity = 90.0
            self.target_ci = 90.0
            self.eer = 1.0
            self.uci = 0.0

    mock_fuel_data = MockFuelData()

    fuel_export_action_service.fuel_repo.get_standardized_fuel_data = AsyncMock(
        return_value=mock_fuel_data
    )

    mock_existing_export = FuelExport(
        fuel_export_id=1,
        compliance_report_id=1,
        group_uuid="test-uuid",
        version=0,
        action_type=ActionTypeEnum.CREATE,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=1,
        provision_of_the_act_id=1,
        provision_of_the_act={"provision_of_the_act_id": 1, "name": "Act Provision"},
        quantity=100,
        units="L",
        export_date=date.today(),
        fuel_type=mock_fuel_type.dict(),
        fuel_category=mock_fuel_category.dict(),
    )
    # Setup async mocks properly
    mock_repo.get_fuel_export_by_id = AsyncMock(return_value=mock_existing_export)
    mock_repo.update_fuel_export = AsyncMock(return_value=mock_existing_export)

    result = await fuel_export_action_service.update_fuel_export(input_data, "2024")

    assert isinstance(result, FuelExportSchema)
    mock_repo.get_fuel_export_by_id.assert_awaited_once()
    mock_repo.update_fuel_export.assert_awaited_once()


@pytest.mark.anyio
async def test_action_delete_fuel_export(fuel_export_action_service, mock_repo):
    input_data = FuelExportCreateUpdateSchema(
        fuel_export_id=1,
        compliance_report_id=1,
        group_uuid="test-uuid",
        version=0,
        fuel_type_id=1,
        fuel_category_id=1,
        provision_of_the_act_id=1,
        end_use_id=1,
        quantity=100,
        units="L",
        export_date=date.today(),
    )

    mock_latest_export = FuelExport(
        fuel_export_id=1,
        compliance_report_id=1,
        group_uuid="test-uuid",
        version=0,
        action_type=ActionTypeEnum.CREATE,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=1,
        provision_of_the_act_id=1,
        quantity=100,
        units="L",
        export_date=date.today(),
        fuel_type=mock_fuel_type.dict(),
        fuel_category=mock_fuel_category.dict(),
    )

    mock_repo.get_latest_fuel_export_by_group_uuid.return_value = mock_latest_export
    result = await fuel_export_action_service.delete_fuel_export(input_data)

    assert isinstance(result, DeleteFuelExportResponseSchema)
    assert result.message == "Marked as deleted."
    mock_repo.get_latest_fuel_export_by_group_uuid.assert_called_once()
    mock_repo.delete_fuel_export.assert_called_once()


@pytest.mark.anyio
async def test_action_delete_fuel_export_changelog(
    fuel_export_action_service, mock_repo
):
    input_data = FuelExportCreateUpdateSchema(
        fuel_export_id=1,
        compliance_report_id=2,
        group_uuid="test-uuid",
        version=0,
        fuel_type_id=1,
        fuel_category_id=1,
        provision_of_the_act_id=1,
        end_use_id=1,
        quantity=100,
        units="L",
        export_date=date.today(),
        compliance_period="2024",
    )

    mock_latest_export = FuelExport(
        fuel_export_id=1,
        compliance_report_id=1,
        group_uuid="test-uuid",
        version=0,
        action_type=ActionTypeEnum.CREATE,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=1,
        provision_of_the_act_id=1,
        quantity=100,
        units="L",
        export_date=date.today(),
        fuel_type=mock_fuel_type.dict(),
        fuel_category=mock_fuel_category.dict(),
    )

    mock_repo.get_latest_fuel_export_by_group_uuid.return_value = mock_latest_export
    mock_repo.create_fuel_export.return_value = None

    result = await fuel_export_action_service.delete_fuel_export(input_data)

    assert isinstance(result, DeleteFuelExportResponseSchema)
    assert result.message == "Marked as deleted."
    mock_repo.get_latest_fuel_export_by_group_uuid.assert_called_once()
    mock_repo.create_fuel_export.assert_called_once()


@pytest.mark.anyio
async def test_action_create_fuel_export_energy_too_high(
    fuel_export_action_service, mock_repo
):
    """Test that creating a fuel export with energy exceeding the maximum raises ValidationErrorException."""
    # Create input data with extremely high quantity
    input_data = FuelExportCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_type=mock_fuel_type.dict(),
        end_use_id=1,
        fuel_category_id=1,
        fuel_category=mock_fuel_category.dict(),
        provisionOfTheActId=1,
        provisionOfTheAct="Test Provision",
        quantity=1000000000,
        units="L",
        export_date=date.today(),
    )

    # Mock fuel data with high energy density
    class MockFuelData:
        def __init__(self):
            self.energy_density = 141.76  # Hydrogen energy density
            self.effective_carbon_intensity = 90.0
            self.target_ci = 90.0
            self.eer = 1.0
            self.uci = 0.0

    mock_fuel_data = MockFuelData()

    # Set up the mock
    fuel_export_action_service.fuel_repo.get_standardized_fuel_data = AsyncMock(
        return_value=mock_fuel_data
    )

    # Attempt to create the fuel export and expect a ValidationErrorException
    with pytest.raises(ValidationErrorException) as exc_info:
        await fuel_export_action_service.create_fuel_export(input_data, "2024")

    # Verify exception contains the expected structure and message
    error_data = exc_info.value.errors
    assert "errors" in error_data
    assert isinstance(error_data["errors"], list)
    assert len(error_data["errors"]) == 1
    assert "fields" in error_data["errors"][0]
    assert "message" in error_data["errors"][0]
    assert error_data["errors"][0]["fields"] == ["quantity"]
    assert "Reduce quantity" in error_data["errors"][0]["message"]
    assert "141.76" in error_data["errors"][0]["message"]  # Energy density s
