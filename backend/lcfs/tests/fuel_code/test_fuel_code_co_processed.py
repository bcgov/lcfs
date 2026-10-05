"""
co_processed is a controlled-value column. These tests pin the approved
list so a value stored by the data cleanup cannot fall outside what the API
will serialise (a stored value missing from the enum makes FuelCodeSchema
fail validation, i.e. the fuel code detail endpoint 500s).
"""

from datetime import date, datetime

import pytest
from pydantic import ValidationError

from lcfs.web.api.fuel_code.schema import (
    CoProcessedEnumSchema,
    FuelCodeCreateUpdateSchema,
    FuelCodeSchema,
)

APPROVED_VALUES = ["No", "Yes - DHT", "Yes - FCC", "Yes - Other"]


def _create_payload(**overrides):
    payload = dict(
        fuel_type_id=1,
        prefix_id=1,
        fuel_suffix="100.0",
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
        fuel_production_facility_province_state="BC",
        fuel_production_facility_country="Canada",
    )
    payload.update(overrides)
    return payload


def _stored_row(**overrides):
    """Minimal shape of a fuel_code row as read back from the database."""
    row = dict(
        prefix_id=1,
        fuel_suffix="100.0",
        company="XYZ Corp",
        carbon_intensity=20.5,
        edrms="EDRMS-123",
        last_updated=datetime(2023, 10, 1),
        application_date=date(2023, 10, 1),
        fuel_type_id=1,
        feedstock="Corn oil",
        feedstock_location="Canada",
    )
    row.update(overrides)
    return row


def test_enum_matches_approved_dropdown_values():
    assert [v.value for v in CoProcessedEnumSchema] == APPROVED_VALUES


@pytest.mark.parametrize("value", APPROVED_VALUES)
def test_create_update_accepts_every_approved_value(value):
    schema = FuelCodeCreateUpdateSchema(**_create_payload(co_processed=value))
    assert schema.co_processed == value


@pytest.mark.parametrize("value", APPROVED_VALUES)
def test_response_schema_serialises_every_stored_value(value):
    schema = FuelCodeSchema(**_stored_row(co_processed=value))
    assert schema.model_dump()["co_processed"] == value


@pytest.mark.parametrize("value", ["Yes", "Yes-DHT", "yes - fcc", "Other", ""])
def test_rejects_values_outside_the_controlled_list(value):
    with pytest.raises(ValidationError):
        FuelCodeCreateUpdateSchema(**_create_payload(co_processed=value))


def test_missing_or_null_defaults_to_no():
    assert FuelCodeCreateUpdateSchema(**_create_payload()).co_processed == "No"
    assert (
        FuelCodeCreateUpdateSchema(**_create_payload(co_processed=None)).co_processed
        == "No"
    )
    assert FuelCodeSchema(**_stored_row(co_processed=None)).co_processed == "No"
