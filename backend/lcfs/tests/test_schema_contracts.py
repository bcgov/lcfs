"""Validation contracts affected by the Pydantic configuration cleanup."""

import pytest
from pydantic import BaseModel, ValidationError
from pydantic.warnings import PydanticDeprecatedSince20

from lcfs.settings import Settings
from lcfs.web.api.charging_equipment.schema import BulkActionRequestSchema
from lcfs.web.api.fuel_code.schema import (
    AdditionalCarbonIntensitySchema,
    EnergyDensitySchema,
    EnergyEffectivenessRatioSchema,
)


@pytest.fixture(
    params=[
        (
            EnergyDensitySchema,
            "density",
            {"energyDensityId": 1, "fuelTypeId": 1, "uomId": 1},
        ),
        (
            EnergyEffectivenessRatioSchema,
            "ratio",
            {"eerId": 1, "fuelCategoryId": 1, "fuelTypeId": 1},
        ),
        (
            AdditionalCarbonIntensitySchema,
            "intensity",
            {
                "additionalUciId": 1,
                "compliancePeriodId": 1,
                "compliancePeriod": {"compliancePeriodId": 1, "description": "2026"},
            },
        ),
    ],
    ids=["energy-density", "effectiveness-ratio", "carbon-intensity"],
)
def numeric_schema(request):
    return request.param


def test_numeric_reference_data_coerces_and_rounds(numeric_schema):
    schema, field, payload = numeric_schema
    model = schema.model_validate({**payload, field: "1.236"})

    assert getattr(model, field) == 1.24
    assert model.model_dump(by_alias=True)[field] == 1.24


@pytest.mark.parametrize(
    "value,error_type", [(None, "float_type"), ("bad", "float_parsing")]
)
def test_numeric_reference_data_rejects_invalid_values(
    numeric_schema, value, error_type
):
    schema, field, payload = numeric_schema
    with pytest.raises(ValidationError) as exc:
        schema.model_validate({**payload, field: value})

    assert [(error["loc"], error["type"]) for error in exc.value.errors()] == [
        ((field,), error_type)
    ]


def test_numeric_reference_data_requires_value(numeric_schema):
    schema, field, payload = numeric_schema
    with pytest.raises(ValidationError) as exc:
        schema.model_validate(payload)

    assert [(error["loc"], error["type"]) for error in exc.value.errors()] == [
        ((field,), "missing")
    ]


@pytest.mark.parametrize("key", ["chargingEquipmentIds", "charging_equipment_ids"])
def test_bulk_actions_accept_ids_with_either_alias(key):
    request = BulkActionRequestSchema.model_validate({key: [1, 2]})
    assert request.model_dump(by_alias=True) == {"chargingEquipmentIds": [1, 2]}


@pytest.mark.parametrize("key", ["chargingEquipmentIds", "charging_equipment_ids"])
def test_bulk_actions_reject_empty_ids(key):
    with pytest.raises(ValidationError) as exc:
        BulkActionRequestSchema.model_validate({key: []})

    assert exc.value.errors()[0]["type"] == "too_short"


def test_settings_preserve_dotenv_prefix_and_environment_precedence(
    tmp_path, monkeypatch
):
    dotenv = tmp_path / ".env"
    dotenv.write_text("LCFS_DB_PORT=55321\n", encoding="utf-8")
    monkeypatch.delenv("LCFS_DB_PORT", raising=False)
    assert Settings(_env_file=dotenv).db_port == 55321

    monkeypatch.setenv("LCFS_DB_PORT", "55322")
    assert Settings(_env_file=dotenv).db_port == 55322


def test_legacy_schema_config_cannot_be_hidden_by_warning_filters():
    with pytest.raises(PydanticDeprecatedSince20, match="class-based.*config"):

        class LegacySchema(BaseModel):
            value: int

            class Config:
                from_attributes = True
