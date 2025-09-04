from unittest.mock import MagicMock

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance import NotionalTransfer
from lcfs.web.api.notional_transfer.schema import NotionalTransferCreateSchema


def create_mock_entity(overrides: dict):
    mock_entity = MagicMock(spec=NotionalTransfer)
    mock_entity.notional_transfer_id = 1
    mock_entity.compliance_report_id = 1
    mock_entity.fuel_category.category = "Gasoline"
    mock_entity.legal_name = "Test Legal Name"
    mock_entity.address_for_service = "Test Address"
    mock_entity.quantity = 1000
    mock_entity.received_or_transferred = "Received"
    mock_entity.group_uuid = "test-group-uuid"
    mock_entity.version = 1
    mock_entity.action_type = ActionTypeEnum.CREATE
    mock_entity.is_canada_produced = True
    mock_entity.is_q1_supplied = False

    # Apply overrides
    if overrides:
        for key, value in overrides.items():
            setattr(mock_entity, key, value)

    return mock_entity


def create_mock_schema(overrides: dict):
    mock_schema = NotionalTransferCreateSchema(
        compliance_report_id=1,
        fuel_category="Gasoline",
        legal_name="Test Legal Name",
        address_for_service="Test Address",
        quantity=1000,
        received_or_transferred="Received",
        group_uuid="test-group-uuid",
        version=1,
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    # Apply overrides
    if overrides:
        for key, value in overrides.items():
            setattr(mock_schema, key, value)

    return mock_schema
