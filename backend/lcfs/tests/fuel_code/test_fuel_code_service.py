from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from lcfs.db.models import FuelCode
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.db.models.fuel.FuelType import QuantityUnitsEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.schema import (
    FuelCodeBaseSchema,
    FuelCodeCreateUpdateSchema,
    FuelCodeSchema,
    PaginationResponseSchema,
    FuelCodeStatusEnumSchema,
)
from lcfs.web.api.fuel_code.services import FuelCodeServices
from lcfs.web.exception.exceptions import ServiceException


@pytest.mark.anyio
async def test_get_fuel_codes_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    mock_fuel_codes = [
        FuelCodeBaseSchema(
            fuel_code_id=1,
            company="XYZ Corp",
            fuel_code_prefix_id=1,
            fuel_suffix="001.0",
            carbon_intensity=10.5,
            fuel_code_status_id=1,
            status="Draft",
            application_date=datetime(2023, 10, 1),
            last_updated=datetime(2023, 10, 1),
            fuel_type="Diesel",
            fuel_type_id=1,
            prefix="BCLCF",
            edrms="EDRMS-123",
            feedstock="Corn oil",
            feedstock_location="Canada",
        )
    ]
    repo_mock.get_fuel_codes_paginated.return_value = (mock_fuel_codes, 1)

    pagination = PaginationRequestSchema(page=1, size=10)

    # Act
    result = await service.search_fuel_codes(pagination)

    # Assert
    assert isinstance(result.pagination, PaginationResponseSchema)
    assert len(result.fuel_codes) == 1
    assert result.fuel_codes[0].company == "XYZ Corp"
    repo_mock.get_fuel_codes_paginated.assert_called_once_with(pagination)


def create_mock_fuel_code_model():
    """Helper function to create a properly structured mock fuel code model"""

    # Create a simple object that behaves like a FuelCode model but has all the right attributes
    class MockFuelCode:
        def __init__(self):
            self.fuel_code_id = 1
            self.fuel_status_id = 1
            self.fuel_code = "BCLCF001"
            self.company = "XYZ Corp"
            self.carbon_intensity = 20.5
            self.fuel_suffix = "001.0"
            self.prefix_id = 1001
            self.fuel_type_id = 1
            self.application_date = date(2023, 10, 1)
            self.approval_date = date(2023, 10, 2)
            self.effective_date = date(2023, 10, 3)
            self.expiration_date = date(2024, 10, 1)
            self.edrms = "EDRMS-123"
            self.feedstock = "Corn oil"
            self.feedstock_location = "Canada"
            self.fuel_production_facility_city = "Victoria"
            self.fuel_production_facility_country = "Canada"
            self.fuel_production_facility_province_state = "BC"
            self.last_updated = datetime(2023, 10, 1)
            self.feedstock_fuel_transport_modes = []
            self.finished_fuel_transport_modes = []
            self.contact_name = None
            self.contact_email = None
            self.feedstock_misc = None
            self.facility_nameplate_capacity = None
            self.facility_nameplate_capacity_unit = None
            self.former_company = None
            self.notes = None
            self.group_uuid = None
            self.version = 0
            self.action_type = None
            self.history_records = []

            # Create nested objects as simple classes too
            self.fuel_code_status = self.MockFuelCodeStatus()
            self.fuel_code_prefix = self.MockFuelCodePrefix()
            self.fuel_type = self.MockFuelType()

        class MockFuelCodeStatus:
            def __init__(self):
                self.fuel_code_status_id = 1
                self.status = FuelCodeStatusEnum.Draft

        class MockFuelCodePrefix:
            def __init__(self):
                self.fuel_code_prefix_id = 1001
                self.prefix = "BCLCF"
                self.next_fuel_code = "BCLCF002"

        class MockFuelType:
            def __init__(self):
                self.fuel_type_id = 1
                self.fuel_type = "Diesel"
                self.fossil_derived = True
                self.provision_1_id = None
                self.provision_2_id = None
                self.default_carbon_intensity = None
                self.provision_1 = None
                self.provision_2 = None
                self.units = QuantityUnitsEnum.Litres

    return MockFuelCode()


@pytest.mark.anyio
async def test_create_fuel_code_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    input_data = FuelCodeCreateUpdateSchema(
        fuel_code_id=None,
        fuel_type_id=1,
        prefix_id=1001,
        fuel_suffix="001",
        carbon_intensity=20.5,
        company="XYZ Corp",
        application_date=date(2023, 10, 1),
        approval_date=date(2023, 10, 2),
        effective_date=date(2023, 10, 3),
        expiration_date=date(2024, 10, 1),
        edrms="EDRMS-123",
        feedstock="Corn oil",
        feedstock_location="Canada",
        fuel_production_facility_city="Victoria",
        fuel_production_facility_country="Canada",
        fuel_production_facility_province_state="BC",
    )

    # Mock repository methods called during creation
    repo_mock.validate_fuel_code.return_value = "001.0"

    mock_prefix = MagicMock()
    mock_prefix.fuel_code_prefix_id = 1001
    repo_mock.get_fuel_code_prefix.return_value = mock_prefix

    mock_fuel_type = MagicMock()
    mock_fuel_type.fuel_type_id = 1
    repo_mock.get_fuel_type_by_id.return_value = mock_fuel_type

    repo_mock.get_transport_modes.return_value = []

    mock_status = MagicMock()
    mock_status.fuel_code_status_id = 1
    mock_status.status = FuelCodeStatusEnum.Draft
    repo_mock.get_fuel_status_by_status.return_value = mock_status

    # Create a proper FuelCode mock
    mock_fuel_code = create_mock_fuel_code_model()
    repo_mock.create_fuel_code.return_value = mock_fuel_code
    repo_mock.create_fuel_code_history.return_value = None

    # Act
    result = await service.create_fuel_code(input_data)

    # Assert
    assert result.fuel_code_id == 1
    assert result.company == "XYZ Corp"
    repo_mock.validate_fuel_code.assert_called_once_with("001", 1001)
    repo_mock.create_fuel_code.assert_called_once()
    repo_mock.create_fuel_code_history.assert_called_once()


@pytest.mark.anyio
async def test_update_fuel_code_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    fuel_code_id = 1
    mock_fuel_code_data = FuelCodeCreateUpdateSchema(
        fuel_code_id=1,
        fuel_type_id=1,
        prefix_id=1001,
        fuel_suffix="001",
        carbon_intensity=20.5,
        company="XYZ Corp",
        application_date=date(2023, 10, 1),
        approval_date=date(2023, 10, 2),
        effective_date=date(2023, 10, 3),
        expiration_date=date(2024, 10, 1),
        edrms="EDRMS-123",
        feedstock="Corn oil",
        feedstock_location="Canada",
        fuel_production_facility_city="Victoria",
        fuel_production_facility_country="Canada",
        fuel_production_facility_province_state="BC",
        feedstock_fuel_transport_mode=[],
        finished_fuel_transport_mode=[],
    )

    # Mock existing fuel code
    mock_fuel_code = create_mock_fuel_code_model()
    # Add mock methods for the transport modes
    mock_fuel_code.feedstock_fuel_transport_modes = MagicMock()
    mock_fuel_code.feedstock_fuel_transport_modes.clear = MagicMock()
    mock_fuel_code.finished_fuel_transport_modes = MagicMock()
    mock_fuel_code.finished_fuel_transport_modes.clear = MagicMock()
    mock_fuel_code.group_uuid = str(uuid4())
    mock_fuel_code.version = 0
    mock_fuel_code.history_records = [MagicMock(fuel_status_id=1)]  # Draft status

    repo_mock.get_fuel_code.return_value = mock_fuel_code
    repo_mock.update_fuel_code.return_value = mock_fuel_code
    repo_mock.get_fuel_code_history.return_value = None
    repo_mock.create_fuel_code_history.return_value = None

    # Act
    result = await service.update_fuel_code(mock_fuel_code_data)

    # Assert
    assert result.fuel_code_id == 1
    repo_mock.get_fuel_code.assert_called_once_with(fuel_code_id)
    repo_mock.update_fuel_code.assert_called_once()


@pytest.mark.anyio
async def test_update_fuel_code_notes_required():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    fuel_code_id = 1
    mock_fuel_code_data = FuelCodeCreateUpdateSchema(
        fuel_code_id=1,
        fuel_type_id=1,
        prefix_id=1001,
        fuel_suffix="001",
        carbon_intensity=20.5,
        company="XYZ Corp",
        application_date=date(2023, 10, 1),
        approval_date=date(2023, 10, 2),
        effective_date=date(2023, 10, 3),
        expiration_date=date(2024, 10, 1),
        edrms="EDRMS-123",
        feedstock="Corn oil",
        feedstock_location="Canada",
        fuel_production_facility_city="Victoria",
        fuel_production_facility_country="Canada",
        fuel_production_facility_province_state="BC",
        notes=None,  # No notes provided
    )

    # Mock existing fuel code with history that requires notes
    mock_fuel_code = MagicMock(spec=FuelCode)
    mock_fuel_code.fuel_code_id = 1
    mock_fuel_code.history_records = [MagicMock(fuel_status_id=2)]  # Not draft status

    repo_mock.get_fuel_code.return_value = mock_fuel_code

    # Act & Assert
    with pytest.raises(ValueError, match="Notes is required"):
        await service.update_fuel_code(mock_fuel_code_data)

    repo_mock.get_fuel_code.assert_called_once_with(fuel_code_id)


@pytest.mark.anyio
async def test_delete_fuel_code_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    fuel_code_id = 1
    repo_mock.delete_fuel_code.return_value = True

    # Act
    result = await service.delete_fuel_code(fuel_code_id)

    # Assert
    assert result is True
    repo_mock.delete_fuel_code.assert_called_once_with(fuel_code_id)


@pytest.mark.anyio
async def test_get_fuel_code_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    fuel_code_id = 1

    # Mock fuel code with all required attributes
    mock_fuel_code = create_mock_fuel_code_model()
    mock_fuel_code.history_records = [MagicMock(fuel_status_id=1)]

    repo_mock.get_fuel_code.return_value = mock_fuel_code
    repo_mock.is_fuel_code_used.return_value = False

    # Act
    result = await service.get_fuel_code(fuel_code_id)

    # Assert
    assert result.fuel_code_id == 1
    assert result.company == "XYZ Corp"
    assert result.can_edit_ci is True
    assert result.is_notes_required is False
    repo_mock.get_fuel_code.assert_called_once_with(fuel_code_id)
    repo_mock.is_fuel_code_used.assert_called_once_with(fuel_code_id)


@pytest.mark.anyio
async def test_update_fuel_code_status_success():
    # Arrange
    repo_mock = AsyncMock()
    notif_service_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock, notification_service=notif_service_mock)

    fuel_code_id = 1
    new_status = FuelCodeStatusEnum.Approved
    
    # Mock user
    mock_user = MagicMock()
    mock_user.user_profile_id = 1

    # Mock existing fuel code
    mock_fuel_code = create_mock_fuel_code_model()
    mock_fuel_code.group_uuid = None
    mock_fuel_code.version = 0

    # Mock new status
    mock_new_status = MagicMock()
    mock_new_status.fuel_code_status_id = 2
    mock_new_status.status = FuelCodeStatusEnum.Approved

    repo_mock.get_fuel_code.return_value = mock_fuel_code
    repo_mock.get_fuel_code_status.return_value = mock_new_status
    repo_mock.update_fuel_code.return_value = mock_fuel_code
    repo_mock.create_fuel_code_history.return_value = None

    # Act
    result = await service.update_fuel_code_status(fuel_code_id, new_status, mock_user)

    # Assert
    assert result == mock_fuel_code
    repo_mock.get_fuel_code.assert_called_once_with(fuel_code_id)
    repo_mock.get_fuel_code_status.assert_called_once_with(new_status)
    repo_mock.update_fuel_code.assert_called_once_with(mock_fuel_code)
    repo_mock.create_fuel_code_history.assert_called_once()


@pytest.mark.anyio
async def test_update_fuel_code_status_not_found():
    # Arrange
    repo_mock = AsyncMock()
    notif_service_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock, notification_service=notif_service_mock)

    fuel_code_id = 9999
    new_status = FuelCodeStatusEnum.Approved
    
    # Mock user
    mock_user = MagicMock()
    mock_user.user_profile_id = 1
    
    repo_mock.get_fuel_code.return_value = None

    # Act & Assert
    with pytest.raises(ValueError, match="Fuel code not found"):
        await service.update_fuel_code_status(fuel_code_id, new_status, mock_user)

    repo_mock.get_fuel_code.assert_called_once_with(fuel_code_id)


@pytest.mark.anyio
async def test_search_fuel_code_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    fuel_code = "AB001"
    prefix = "LCFS"
    distinct_search = False

    repo_mock.get_fuel_code_by_code_prefix.return_value = ["AB001", "AB002"]

    # Act
    result = await service.search_fuel_code(fuel_code, prefix, distinct_search)

    # Assert
    assert result.fuel_codes == ["AB001", "AB002"]
    repo_mock.get_fuel_code_by_code_prefix.assert_called_once_with(fuel_code, prefix)


@pytest.mark.anyio
async def test_search_fuel_code_distinct_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    fuel_code = "AB001"
    prefix = "LCFS"
    distinct_search = True

    repo_mock.get_distinct_fuel_codes_by_code.return_value = ["AB001"]

    # Act
    result = await service.search_fuel_code(fuel_code, prefix, distinct_search)

    # Assert
    assert result.fuel_codes == ["AB001"]
    repo_mock.get_distinct_fuel_codes_by_code.assert_called_once_with(fuel_code, prefix)


@pytest.mark.anyio
async def test_search_company_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    company = "ABC Corp"
    repo_mock.get_distinct_company_names.return_value = ["ABC Corp", "ABC Energy"]

    # Act
    result = await service.search_company(company)

    # Assert
    assert result == ["ABC Corp", "ABC Energy"]
    repo_mock.get_distinct_company_names.assert_called_once_with(company)


@pytest.mark.anyio
async def test_get_fuel_code_statuses_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    # Create proper mock status objects
    mock_status_1 = MagicMock()
    mock_status_1.fuel_code_status_id = 1
    mock_status_1.status = FuelCodeStatusEnum.Draft

    mock_status_2 = MagicMock()
    mock_status_2.fuel_code_status_id = 2
    mock_status_2.status = FuelCodeStatusEnum.Approved

    mock_statuses = [mock_status_1, mock_status_2]
    repo_mock.get_fuel_code_statuses.return_value = mock_statuses

    # Act
    result = await service.get_fuel_code_statuses()

    # Assert
    assert len(result) == 2
    assert result[0].fuel_code_status_id == 1
    assert (
        result[0].status == FuelCodeStatusEnumSchema.Draft
    )  # Compare with schema enum (service converts model enum to schema enum)
    repo_mock.get_fuel_code_statuses.assert_called_once()


@pytest.mark.anyio
async def test_get_transport_modes_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    # Create simple objects instead of MagicMock to avoid validation issues
    class MockTransportMode:
        def __init__(self, mode_id, mode_name):
            self.transport_mode_id = mode_id
            self.transport_mode = mode_name

    mock_transport_modes = [MockTransportMode(1, "Truck"), MockTransportMode(2, "Ship")]

    repo_mock.get_transport_modes.return_value = mock_transport_modes

    # Act
    result = await service.get_transport_modes()

    # Assert
    assert len(result) == 2
    assert result[0].transport_mode_id == 1
    assert result[0].transport_mode == "Truck"
    assert result[1].transport_mode_id == 2
    assert result[1].transport_mode == "Ship"
    repo_mock.get_transport_modes.assert_called_once()
