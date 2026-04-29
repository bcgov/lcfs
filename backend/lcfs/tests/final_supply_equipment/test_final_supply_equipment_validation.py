from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException, Request

from lcfs.web.api.final_supply_equipment.schema import (
    FinalSupplyEquipmentCreateSchema,
    PortsEnum,
)
from lcfs.web.api.final_supply_equipment.validation import (
    FinalSupplyEquipmentValidation,
)

COMPLIANCE_REPORT_ID = 123


@pytest.fixture
def fse_validation():
    request = MagicMock(spec=Request)
    return FinalSupplyEquipmentValidation(
        request=request,
        fse_repo=MagicMock(),
        report_repo=MagicMock(),
    )


def _build_entry(**overrides) -> FinalSupplyEquipmentCreateSchema:
    defaults = dict(
        compliance_report_id=COMPLIANCE_REPORT_ID,
        organization_name="Test Org",
        supply_from_date=date(2024, 1, 1),
        supply_to_date=date(2024, 12, 31),
        kwh_usage=100.0,
        serial_nbr="SER123",
        manufacturer="Manufacturer Inc",
        model="ModelX",
        level_of_equipment="Level 2",
        ports=PortsEnum.SINGLE,
        intended_use_types=["Public"],
        intended_user_types=["General"],
        street_address="123 Test St",
        city="Test City",
        postal_code="A1A 1A1",
        latitude=49.2827,
        longitude=-123.1207,
        notes="Some notes",
    )
    defaults.update(overrides)
    return FinalSupplyEquipmentCreateSchema(**defaults)


def _extract_errors(exc: HTTPException):
    detail = exc.detail
    assert isinstance(detail, dict), f"Expected structured detail, got {detail!r}"
    assert "errors" in detail
    return detail["errors"]


def _field_messages(errors, field_name):
    return [err["message"] for err in errors if err["field"] == field_name]


@pytest.mark.anyio
async def test_valid_entry_passes(fse_validation):
    await fse_validation.validate_fse_record(
        COMPLIANCE_REPORT_ID, [_build_entry()]
    )


@pytest.mark.anyio
async def test_compliance_report_id_mismatch_raises_400(fse_validation):
    entry = _build_entry(compliance_report_id=COMPLIANCE_REPORT_ID + 1)

    with pytest.raises(HTTPException) as exc_info:
        await fse_validation.validate_fse_record(COMPLIANCE_REPORT_ID, [entry])

    assert exc_info.value.status_code == 400
    assert "Mismatch compliance_report_id" in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_deleted_entries_skip_field_validation(fse_validation):
    entry = _build_entry()
    entry.organization_name = ""
    entry.deleted = True

    await fse_validation.validate_fse_record(COMPLIANCE_REPORT_ID, [entry])


@pytest.mark.anyio
@pytest.mark.parametrize(
    "field_name",
    [
        "organization_name",
        "serial_nbr",
        "manufacturer",
        "level_of_equipment",
        "street_address",
        "city",
    ],
)
@pytest.mark.parametrize("blank_value", ["", "   "])
async def test_required_text_field_rejects_blank(fse_validation, field_name, blank_value):
    entry = _build_entry(**{field_name: blank_value})

    with pytest.raises(HTTPException) as exc_info:
        await fse_validation.validate_fse_record(COMPLIANCE_REPORT_ID, [entry])

    assert exc_info.value.status_code == 400
    errors = _extract_errors(exc_info.value)
    messages = _field_messages(errors, field_name)
    assert messages, f"Expected an error for field {field_name}, got {errors}"
    assert any(f"{field_name} is required" in msg for msg in messages)


@pytest.mark.anyio
async def test_blank_postal_code_reports_required_not_format(fse_validation):
    entry = _build_entry()
    # Bypass Pydantic's pattern constraint by assigning after construction.
    entry.postal_code = "   "

    with pytest.raises(HTTPException) as exc_info:
        await fse_validation.validate_fse_record(COMPLIANCE_REPORT_ID, [entry])

    errors = _extract_errors(exc_info.value)
    messages = _field_messages(errors, "postal_code")
    assert messages == ["postal_code is required"]


@pytest.mark.anyio
async def test_invalid_postal_code_format_is_rejected(fse_validation):
    entry = _build_entry()
    entry.postal_code = "12345"

    with pytest.raises(HTTPException) as exc_info:
        await fse_validation.validate_fse_record(COMPLIANCE_REPORT_ID, [entry])

    errors = _extract_errors(exc_info.value)
    messages = _field_messages(errors, "postal_code")
    assert any("A1A 1A1" in msg for msg in messages)


@pytest.mark.anyio
async def test_supply_to_date_before_from_date_is_rejected(fse_validation):
    entry = _build_entry(
        supply_from_date=date(2024, 6, 1),
        supply_to_date=date(2024, 1, 1),
    )

    with pytest.raises(HTTPException) as exc_info:
        await fse_validation.validate_fse_record(COMPLIANCE_REPORT_ID, [entry])

    errors = _extract_errors(exc_info.value)
    messages = _field_messages(errors, "supply_to_date")
    assert any("on or after supply_from_date" in msg for msg in messages)


@pytest.mark.anyio
async def test_intended_use_types_cannot_be_empty(fse_validation):
    # Pydantic prevents construction with an empty list, so surface the same
    # guarantee at the service-layer validator by setting it post-construction.
    entry = _build_entry()
    entry.intended_use_types = []

    with pytest.raises(HTTPException) as exc_info:
        await fse_validation.validate_fse_record(COMPLIANCE_REPORT_ID, [entry])

    errors = _extract_errors(exc_info.value)
    assert _field_messages(errors, "intended_use_types")


@pytest.mark.anyio
async def test_intended_user_types_cannot_be_empty(fse_validation):
    entry = _build_entry()
    entry.intended_user_types = []

    with pytest.raises(HTTPException) as exc_info:
        await fse_validation.validate_fse_record(COMPLIANCE_REPORT_ID, [entry])

    errors = _extract_errors(exc_info.value)
    assert _field_messages(errors, "intended_user_types")


@pytest.mark.anyio
@pytest.mark.parametrize(
    "field_name, bad_value, good_value",
    [
        ("latitude", -91.0, 0.0),
        ("latitude", 91.0, 0.0),
        ("longitude", -181.0, 0.0),
        ("longitude", 181.0, 0.0),
    ],
)
async def test_coordinates_must_be_within_bounds(
    fse_validation, field_name, bad_value, good_value
):
    entry = _build_entry(**{field_name: bad_value})

    with pytest.raises(HTTPException) as exc_info:
        await fse_validation.validate_fse_record(COMPLIANCE_REPORT_ID, [entry])

    errors = _extract_errors(exc_info.value)
    messages = _field_messages(errors, field_name)
    assert any("between" in msg for msg in messages)


@pytest.mark.anyio
async def test_missing_latitude_and_longitude_are_reported(fse_validation):
    entry = _build_entry()
    entry.latitude = None
    entry.longitude = None

    with pytest.raises(HTTPException) as exc_info:
        await fse_validation.validate_fse_record(COMPLIANCE_REPORT_ID, [entry])

    errors = _extract_errors(exc_info.value)
    assert _field_messages(errors, "latitude") == ["latitude is required"]
    assert _field_messages(errors, "longitude") == ["longitude is required"]


@pytest.mark.anyio
async def test_negative_kwh_usage_is_rejected(fse_validation):
    entry = _build_entry(kwh_usage=-5)

    with pytest.raises(HTTPException) as exc_info:
        await fse_validation.validate_fse_record(COMPLIANCE_REPORT_ID, [entry])

    errors = _extract_errors(exc_info.value)
    messages = _field_messages(errors, "kwh_usage")
    assert messages == ["kwh_usage must be zero or greater"]


@pytest.mark.anyio
async def test_null_kwh_usage_is_allowed(fse_validation):
    await fse_validation.validate_fse_record(
        COMPLIANCE_REPORT_ID, [_build_entry(kwh_usage=None)]
    )


@pytest.mark.anyio
async def test_multiple_errors_are_aggregated_with_indexes(fse_validation):
    good = _build_entry()
    bad_first = _build_entry(organization_name="", kwh_usage=-1)
    bad_second = _build_entry()
    bad_second.latitude = 500.0
    bad_second.city = ""

    with pytest.raises(HTTPException) as exc_info:
        await fse_validation.validate_fse_record(
            COMPLIANCE_REPORT_ID, [bad_first, good, bad_second]
        )

    errors = _extract_errors(exc_info.value)
    indexes = {err["index"] for err in errors}
    assert indexes == {0, 2}

    first_entry_errors = [e for e in errors if e["index"] == 0]
    assert {e["field"] for e in first_entry_errors} == {
        "organization_name",
        "kwh_usage",
    }

    third_entry_errors = [e for e in errors if e["index"] == 2]
    assert {e["field"] for e in third_entry_errors} == {"latitude", "city"}
