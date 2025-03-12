import pytest
from unittest.mock import MagicMock, AsyncMock

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance.NotionalTransfer import (
    NotionalTransfer,
    ReceivedOrTransferredEnum,
)
from lcfs.tests.notional_transfer.conftest import create_mock_schema, create_mock_entity
from lcfs.web.api.notional_transfer.repo import NotionalTransferRepository
from lcfs.web.api.notional_transfer.schema import (
    NotionalTransferSchema,
    NotionalTransferTableOptionsSchema,
)
from lcfs.web.api.notional_transfer.services import NotionalTransferServices
from lcfs.web.exception.exceptions import ServiceException


@pytest.fixture
def notional_transfer_service():
    mock_repo = MagicMock(spec=NotionalTransferRepository)
    mock_fuel_repo = MagicMock()
    service = NotionalTransferServices(repo=mock_repo, fuel_repo=mock_fuel_repo)
    return service, mock_repo, mock_fuel_repo


@pytest.mark.anyio
async def test_get_table_options(notional_transfer_service):
    service, mock_repo, _ = notional_transfer_service
    # Update the mocked return value to have the correct key
    mock_repo.get_table_options = AsyncMock(
        return_value={
            "fuel_categories": [],
            "received_or_transferred": [],
        }
    )

    response = await service.get_table_options()

    assert isinstance(response, NotionalTransferTableOptionsSchema)
    assert response.fuel_categories == []
    assert response.received_or_transferred == []


@pytest.mark.anyio
async def test_create_notional_transfer(notional_transfer_service):
    service, mock_repo, mock_fuel_repo = notional_transfer_service
    notional_transfer_data = create_mock_schema({})
    mock_fuel_repo.get_fuel_category_by = AsyncMock(
        return_value=MagicMock(fuel_category_id=1)
    )

    mock_created_transfer = create_mock_entity({})
    mock_repo.create_notional_transfer = AsyncMock(return_value=mock_created_transfer)

    response = await service.create_notional_transfer(notional_transfer_data)

    assert isinstance(response, NotionalTransferSchema)
    assert response.fuel_category == "Gasoline"
    assert response.legal_name == "Test Legal Name"

    mock_repo.create_notional_transfer.assert_awaited_once()


@pytest.mark.anyio
async def test_update_notional_transfer(notional_transfer_service):
    service, mock_repo, mock_fuel_repo = notional_transfer_service

    # Create test data with NotionalTransferCreateSchema
    notional_transfer_data = create_mock_schema(
        {"quantity": 2000, "legal_name": "Updated Legal Name"}
    )

    # Create a proper NotionalTransfer instance for the existing transfer
    mock_existing_transfer = NotionalTransfer(
        notional_transfer_id=1,
        compliance_report_id=1,
        quantity=1000,
        legal_name="Existing Legal Name",
        address_for_service="Existing Address",
        fuel_category=MagicMock(category="Gasoline"),
        received_or_transferred=ReceivedOrTransferredEnum.Received,
        group_uuid="test-group-uuid",
        version=1,
        action_type=ActionTypeEnum.UPDATE,
    )

    # Configure repository methods to return these mocked objects
    mock_repo.get_latest_notional_transfer_by_group_uuid = AsyncMock(
        return_value=mock_existing_transfer
    )
    mock_fuel_repo.get_fuel_category_by = AsyncMock(
        return_value=MagicMock(category="Gasoline")
    )

    # Create a proper NotionalTransfer instance for the updated transfer
    mock_updated_transfer = NotionalTransfer(
        notional_transfer_id=1,
        compliance_report_id=1,
        quantity=2000,
        legal_name="Updated Legal Name",
        address_for_service="Updated Address",
        fuel_category=MagicMock(category="Gasoline"),
        received_or_transferred=ReceivedOrTransferredEnum.Received,
        group_uuid="test-group-uuid",
        version=2,
        action_type=ActionTypeEnum.UPDATE,
    )
    # Set the return value for update_notional_transfer
    mock_repo.update_notional_transfer = AsyncMock(return_value=mock_updated_transfer)

    # Execute the update function and capture the response
    response = await service.update_notional_transfer(notional_transfer_data)

    # Assert that the response is a NotionalTransferSchema instance
    assert response.notional_transfer_id == 1
    assert response.quantity == 2000
    assert response.legal_name == "Updated Legal Name"
    assert response.action_type == ActionTypeEnum.UPDATE.value


@pytest.mark.anyio
async def test_update_notional_transfer_not_found(notional_transfer_service):
    service, mock_repo, _ = notional_transfer_service
    notional_transfer_data = create_mock_schema({})

    mock_repo.get_notional_transfer_version_by_user = AsyncMock(return_value=None)

    with pytest.raises(ServiceException):
        await service.update_notional_transfer(notional_transfer_data)


@pytest.mark.anyio
async def test_delete_notional_transfer(notional_transfer_service):
    service, mock_repo, _ = notional_transfer_service
    notional_transfer_data = create_mock_schema({})

    # Mock the existing notional transfer with a "CREATE" action type
    mock_existing_transfer = MagicMock()
    mock_existing_transfer.group_uuid = "test-group-uuid"
    mock_existing_transfer.version = 1
    mock_existing_transfer.action_type = ActionTypeEnum.CREATE

    # Set up the mock __table__.columns.keys() to return field names as a list
    mock_existing_transfer.__table__ = MagicMock()
    mock_existing_transfer.__table__.columns.keys.return_value = [
        "notional_transfer_id",
        "compliance_report_id",
        "quantity",
        "fuel_category",
        "legal_name",
        "address_for_service",
        "received_or_transferred",
        "deleted",
        "group_uuid",
        "user_type",
        "version",
        "action_type",
    ]

    # Mock repository methods
    mock_repo.get_latest_notional_transfer_by_group_uuid = AsyncMock(
        return_value=mock_existing_transfer
    )
    mock_repo.create_notional_transfer = AsyncMock(return_value=mock_existing_transfer)

    # Call the delete service
    response = await service.delete_notional_transfer(notional_transfer_data)

    # Assertions
    assert response.message == "Marked as deleted."
    mock_repo.create_notional_transfer.assert_awaited_once()
