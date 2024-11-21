from unittest.mock import MagicMock

from lcfs.db.base import UserTypeEnum, ActionTypeEnum
from lcfs.db.models import OtherUses
from lcfs.web.api.other_uses.schema import OtherUsesCreateSchema


def create_mock_entity(overrides: dict):
    mock_entity = MagicMock(spec=OtherUses)
    mock_entity.other_uses_id = 1
    mock_entity.compliance_report_id = 1
    mock_entity.ci_of_fuel = 20.0
    mock_entity.units = "L"
    mock_entity.rationale = "Test rationale"
    mock_entity.group_uuid = "test-group-uuid"
    mock_entity.version = 1
    mock_entity.quantity_supplied = 1000
    mock_entity.action_type = ActionTypeEnum.CREATE
    mock_entity.user_type = UserTypeEnum.SUPPLIER

    # Mock relationships
    mock_entity.fuel_type = MagicMock()
    mock_entity.fuel_type.fuel_type = "Gasoline"

    mock_entity.fuel_category = MagicMock()
    mock_entity.fuel_category.category = "Petroleum-based"

    mock_entity.expected_use = MagicMock()
    mock_entity.expected_use.name = "Transportation"

    mock_entity.provision_of_the_act = MagicMock()
    mock_entity.provision_of_the_act.name = "Provision A"

    mock_entity.fuel_code = MagicMock()
    mock_entity.fuel_code.fuel_code = "Code123"

    # Apply overrides
    if overrides:
        for key, value in overrides.items():
            setattr(mock_entity, key, value)

    return mock_entity


def create_mock_schema(overrides: dict):
    mock_schema = OtherUsesCreateSchema(
        other_uses_id=1,
        compliance_report_id=1,
        quantity_supplied=1000,
        fuel_type="Gasoline",
        fuel_category="Petroleum-based",
        expected_use="Transportation",
        provision_of_the_act="Provision A",
        fuel_code="Code123",
        units="L",
        ci_of_fuel=20.0,
        rationale="Test rationale",
        deleted=False,
        group_uuid="test-group-uuid",
        version=1,
        user_type="Supplier",
        action_type="Create",
    )

    # Apply overrides
    if overrides:
        for key, value in overrides.items():
            setattr(mock_schema, key, value)

    return mock_schema
