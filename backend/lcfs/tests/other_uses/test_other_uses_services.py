import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi import HTTPException

from lcfs.web.api.other_uses.repo import OtherUsesRepository
from lcfs.web.api.other_uses.schema import (
    OtherUsesCreateSchema,
    OtherUsesTableOptionsSchema,
    OtherUsesSchema,
    OtherUsesListSchema,
    OtherUsesAllSchema,
)
from lcfs.web.api.other_uses.services import OtherUsesServices
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.exception.exceptions import ServiceException

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
        }
    )

    response = await service.get_table_options()

    assert isinstance(response, OtherUsesTableOptionsSchema)
    mock_repo.get_table_options.assert_awaited_once()

@pytest.mark.anyio
async def test_create_other_use(other_uses_service):
    service, mock_repo, mock_fuel_repo = other_uses_service
    other_use_data = OtherUsesCreateSchema(
        compliance_report_id=1,
        quantity_supplied=1000,
        fuel_type="Gasoline",
        fuel_category="Petroleum-based",
        expected_use="Transportation",
        units="L",
        rationale="Test rationale",
    )
    mock_fuel_repo.get_fuel_category_by_name = AsyncMock(return_value=MagicMock(fuel_category_id=1))
    mock_fuel_repo.get_fuel_type_by_name = AsyncMock(return_value=MagicMock(fuel_type_id=1))
    mock_fuel_repo.get_expected_use_type_by_name = AsyncMock(return_value=MagicMock(expected_use_type_id=1))

    mock_created_use = MagicMock()
    mock_created_use.other_uses_id = 1
    mock_created_use.compliance_report_id = 1
    mock_created_use.quantity_supplied = 1000
    mock_created_use.fuel_type.fuel_type = "Gasoline"
    mock_created_use.fuel_category.category = "Petroleum-based"
    mock_created_use.expected_use.name = "Transportation"
    mock_created_use.units = "L"
    mock_created_use.rationale = "Test rationale"

    mock_repo.create_other_use = AsyncMock(return_value=mock_created_use)

    try:
        response = await service.create_other_use(other_use_data)
    except ServiceException:
        pytest.fail("ServiceException was raised unexpectedly")
    
    assert isinstance(response, OtherUsesSchema)
    assert response.fuel_type == "Gasoline"
    assert response.fuel_category == "Petroleum-based"
    assert response.expected_use == "Transportation"

    mock_repo.create_other_use.assert_awaited_once()

@pytest.mark.anyio
async def test_update_other_use(other_uses_service):
    service, mock_repo, mock_fuel_repo = other_uses_service
    other_use_data = OtherUsesCreateSchema(
        other_uses_id=1,
        compliance_report_id=1,
        quantity_supplied=2000,
        fuel_type="Diesel",
        fuel_category="Petroleum-based",
        expected_use="Transportation",
        units="L",
        rationale="Updated rationale",
    )

    mock_existing_use = MagicMock()
    mock_existing_use.other_uses_id = 1
    mock_existing_use.compliance_report_id = 1
    mock_existing_use.quantity_supplied = 1000
    mock_existing_use.fuel_type.fuel_type = "Gasoline"
    mock_existing_use.fuel_category.category = "Petroleum-based"
    mock_existing_use.expected_use.name = "Transportation"
    mock_existing_use.units = "L"
    mock_existing_use.rationale = "Test rationale"

    mock_repo.get_other_use = AsyncMock(return_value=mock_existing_use)

    mock_fuel_repo.get_fuel_type_by_name = AsyncMock(return_value=MagicMock(fuel_type_id=2))
    mock_fuel_repo.get_fuel_category_by_name = AsyncMock(return_value=MagicMock(fuel_category_id=1))
    mock_fuel_repo.get_expected_use_type_by_name = AsyncMock(return_value=MagicMock(expected_use_type_id=1))

    mock_updated_use = MagicMock()
    mock_updated_use.other_uses_id = 1
    mock_updated_use.compliance_report_id = 1
    mock_updated_use.quantity_supplied = 2000
    mock_updated_use.fuel_type.fuel_type = "Diesel"
    mock_updated_use.fuel_category.category = "Petroleum-based"
    mock_updated_use.expected_use.name = "Transportation"
    mock_updated_use.units = "L"
    mock_updated_use.rationale = "Updated rationale"

    mock_repo.update_other_use = AsyncMock(return_value=mock_updated_use)

    try:
        response = await service.update_other_use(other_use_data)
    except ServiceException:
        pytest.fail("ServiceException was raised unexpectedly")

    assert isinstance(response, OtherUsesSchema)
    assert response.fuel_type == "Diesel"
    assert response.fuel_category == "Petroleum-based"
    assert response.expected_use == "Transportation"

    mock_repo.update_other_use.assert_awaited_once()

@pytest.mark.anyio
async def test_update_other_use_not_found(other_uses_service):
    service, mock_repo, _ = other_uses_service
    other_use_data = OtherUsesCreateSchema(
        other_uses_id=1,
        compliance_report_id=1,
        quantity_supplied=2000,
        fuel_type="Diesel",
        fuel_category="Petroleum-based",
        expected_use="Transportation",
        units="L",
        rationale="Updated rationale",
    )
    mock_repo.get_other_use = AsyncMock(return_value=None)

    with pytest.raises(ServiceException):
        await service.update_other_use(other_use_data)