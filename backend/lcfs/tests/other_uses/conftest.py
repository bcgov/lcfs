from unittest.mock import MagicMock

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models import OtherUses
from lcfs.web.api.other_uses.schema import OtherUsesCreateSchema


def create_mock_entity(overrides: dict):
    mock_entity = MagicMock(spec=OtherUses)
    mock_entity.other_uses_id = 1
    mock_entity.compliance_report_id = 1
    mock_entity.fuel_type.fuel_type = "Gasoline"
    mock_entity.fuel_category.category = "Petroleum-based"
    mock_entity.expected_use.name = "Transportation"
    mock_entity.units = "L"
    mock_entity.rationale = "Test rationale"
    mock_entity.group_uuid = "test-group-uuid"
    mock_entity.version = 1
    mock_entity.quantity_supplied = 1000
    mock_entity.action_type = ActionTypeEnum.CREATE

    # Apply overrides
    if overrides:
        for key, value in overrides.items():
            setattr(mock_entity, key, value)

    return mock_entity


def create_mock_schema(overrides: dict):
    mock_schema = OtherUsesCreateSchema(
        compliance_report_id=1,
        quantity_supplied=1000,
        fuel_type="Gasoline",
        fuel_category="Petroleum-based",
        expected_use="Transportation",
        units="L",
        rationale="Test rationale",
        provision_of_the_act="Provision A",
        fuel_code="FuelCode123",
        group_uuid="test-group-uuid",
        version=1,
        action_type="Create",
    )

    # Apply overrides
    if overrides:
        for key, value in overrides.items():
            setattr(mock_schema, key, value)

    return mock_schema
