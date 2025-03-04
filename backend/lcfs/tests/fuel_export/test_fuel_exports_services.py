import pytest
from lcfs.web.api.fuel_export.schema import (
    FuelExportSchema,
    FuelExportCreateUpdateSchema,
    FuelTypeSchema,
    FuelCategoryResponseSchema,
    FuelExportsSchema,
    FuelTypeOptionsResponse,
    DeleteFuelExportResponseSchema,
)
from datetime import date
from unittest.mock import MagicMock, patch, AsyncMock
from lcfs.web.api.fuel_export.services import FuelExportServices
from lcfs.web.api.fuel_export.actions_service import FuelExportActionService
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.db.models.compliance.FuelExport import FuelExport
from lcfs.db.base import ActionTypeEnum, UserTypeEnum
from lcfs.db.models.user.Role import RoleEnum
from types import SimpleNamespace

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
        provision_of_the_act={
            "provision_of_the_act_id": 1, "name": "Test Provision"},
        version=0,
        user_type=UserTypeEnum.SUPPLIER,
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
        provision_of_the_act={
            "provision_of_the_act_id": 1, "name": "Test Provision"},
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
    mock_repo.get_fuel_exports_paginated.assert_called_once_with(
        pagination_mock, 1, exclude_draft_reports=True
    )


# FuelExportActionService Tests


@pytest.mark.anyio
async def test_action_create_fuel_export_success(fuel_export_action_service, mock_repo):
    input_data = FuelExportCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_type=mock_fuel_type.dict(),
        fuel_category_id=1,
        fuel_category=mock_fuel_category.dict(),
        provisionOfTheActId=1,
        provisionOfTheAct={"provision_of_the_act_id": 1,
                           "name": "Act Provision"},
        quantity=100,
        units="L",
        export_date=date.today(),
        compliance_period="2024",
    )

    mock_created_export = FuelExport(
        fuel_export_id=1,
        compliance_report_id=1,
        group_uuid="test-uuid",
        version=0,
        user_type=UserTypeEnum.SUPPLIER,
        action_type=ActionTypeEnum.CREATE,
        provision_of_the_act_id=1,
        provision_of_the_act={
            "provision_of_the_act_id": 1, "name": "Act Provision"},
        fuel_type_id=1,
        fuel_category_id=1,
        quantity=100,
        units="L",
        export_date=date.today(),
        fuel_type=mock_fuel_type.dict(),
        fuel_category=mock_fuel_category.dict(),
    )
    mock_repo.create_fuel_export.return_value = mock_created_export

    result = await fuel_export_action_service.create_fuel_export(
        input_data, UserTypeEnum.SUPPLIER
    )
    assert isinstance(result, FuelExportSchema)
    mock_repo.create_fuel_export.assert_called_once()


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
        fuel_category=mock_fuel_category.dict(),
        quantity=100,
        provisionOfTheActId=1,
        provisionOfTheAct={"provision_of_the_act_id": 1,
                           "name": "Act Provision"},
        units="L",
        export_date=date.today(),
        compliance_period="2024",
    )

    mock_existing_export = FuelExport(
        fuel_export_id=1,
        compliance_report_id=1,
        group_uuid="test-uuid",
        version=0,
        user_type=UserTypeEnum.SUPPLIER,
        action_type=ActionTypeEnum.CREATE,
        fuel_type_id=1,
        fuel_category_id=1,
        provision_of_the_act_id=1,
        provision_of_the_act={
            "provision_of_the_act_id": 1, "name": "Act Provision"},
        quantity=100,
        units="L",
        export_date=date.today(),
        fuel_type=mock_fuel_type.dict(),
        fuel_category=mock_fuel_category.dict(),
    )
    mock_repo.get_fuel_export_version_by_user.return_value = mock_existing_export
    mock_repo.update_fuel_export.return_value = mock_existing_export

    result = await fuel_export_action_service.update_fuel_export(
        input_data, UserTypeEnum.SUPPLIER
    )
    assert isinstance(result, FuelExportSchema)
    mock_repo.get_fuel_export_version_by_user.assert_called_once()
    mock_repo.update_fuel_export.assert_called_once()


@pytest.mark.anyio
async def test_action_delete_fuel_export_success(fuel_export_action_service, mock_repo):
    input_data = FuelExportCreateUpdateSchema(
        fuel_export_id=1,
        compliance_report_id=1,
        group_uuid="test-uuid",
        version=0,
        fuel_type_id=1,
        fuel_type=mock_fuel_type.dict(),
        fuel_category_id=1,
        provisionOfTheActId=1,
        provisionOfTheAct={"provisionOfTheActId": 1, "name": "Act Provision"},
        fuel_category=mock_fuel_category.dict(),
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
        user_type=UserTypeEnum.SUPPLIER,
        action_type=ActionTypeEnum.CREATE,
        fuel_type_id=1,
        fuel_category_id=1,
        provision_of_the_act_id=1,
        quantity=100,
        units="L",
        export_date=date.today(),
        fuel_type=mock_fuel_type.dict(),
        fuel_category=mock_fuel_category.dict(),
    )

    mock_repo.get_latest_fuel_export_by_group_uuid.return_value = mock_latest_export
    mock_repo.create_fuel_export.return_value = None

    result = await fuel_export_action_service.delete_fuel_export(
        input_data, UserTypeEnum.SUPPLIER
    )

    assert isinstance(result, DeleteFuelExportResponseSchema)
    assert result.success is True
    assert result.message == "Fuel export record marked as deleted."
    mock_repo.get_latest_fuel_export_by_group_uuid.assert_called_once()
    mock_repo.create_fuel_export.assert_called_once()
