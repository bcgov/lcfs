import pytest

from lcfs.web.api.allocation_agreement.importer import (
    FIELD_KEYS,
    _check_duplicate,
    _row_to_dict,
    _validate_row,
)


@pytest.fixture
def valid_sets():
    return {
        "fuel_types": {"Diesel"},
        "fuel_categories": {"Renewable diesel"},
        "provisions": {"Provision A"},
    }


def test_validate_row_missing_required_fields(valid_sets):
    row = (None,) * 11

    result = _validate_row(
        row,
        row_idx=2,
        valid_fuel_types=valid_sets["fuel_types"],
        valid_fuel_categories=valid_sets["fuel_categories"],
        valid_provisions=valid_sets["provisions"],
    )

    assert result is not None
    assert set(result["fields"]) == {
        "allocation_transaction_type",
        "transaction_partner",
        "postal_address",
        "transaction_partner_email",
        "transaction_partner_phone",
        "fuel_type",
        "fuel_category",
        "provision_of_the_act",
        "quantity",
    }
    assert "Missing required fields" in result["message"]


def test_validate_row_invalid_email(valid_sets):
    row = (
        "Allocated from",
        "Partner",
        "123 Street",
        "invalid-email",
        "250-555-1234",
        "Diesel",
        None,
        "Renewable diesel",
        "Provision A",
        "FC-001",
        10,
    )

    result = _validate_row(
        row,
        row_idx=3,
        valid_fuel_types=valid_sets["fuel_types"],
        valid_fuel_categories=valid_sets["fuel_categories"],
        valid_provisions=valid_sets["provisions"],
    )

    assert result == {
        "message": "Row 3: Invalid email address",
        "fields": ["transaction_partner_email"],
    }


def test_validate_row_invalid_lookup(valid_sets):
    row = (
        "Allocated from",
        "Partner",
        "123 Street",
        "partner@example.com",
        "250-555-1234",
        "Invalid Fuel",
        None,
        "Renewable diesel",
        "Provision A",
        "FC-001",
        10,
    )

    result = _validate_row(
        row,
        row_idx=4,
        valid_fuel_types=valid_sets["fuel_types"],
        valid_fuel_categories=valid_sets["fuel_categories"],
        valid_provisions=valid_sets["provisions"],
    )

    assert result == {
        "message": "Row 4: Invalid fuel type: Invalid Fuel",
        "fields": ["fuel_type"],
    }


def test_validate_row_passes(valid_sets):
    row = (
        "Allocated from",
        "Partner",
        "123 Street",
        "partner@example.com",
        "250-555-1234",
        "Diesel",
        None,
        "Renewable diesel",
        "Provision A",
        "FC-001",
        100,
    )

    result = _validate_row(
        row,
        row_idx=5,
        valid_fuel_types=valid_sets["fuel_types"],
        valid_fuel_categories=valid_sets["fuel_categories"],
        valid_provisions=valid_sets["provisions"],
    )

    assert result is None


def test_row_to_dict_maps_fields():
    row = (
        "Allocated to",
        "Partner",
        "123 Street",
        "partner@example.com",
        "250-555-1234",
        "Diesel",
        "Other Fuel",
        "Renewable diesel",
        "Provision A",
        "FC-001",
        25,
    )

    result = _row_to_dict(row)

    assert result["allocation_transaction_type"] == "Allocated to"
    assert result["transaction_partner"] == "Partner"
    assert result["fuel_type_other"] == "Other Fuel"
    assert result["quantity"] == 25


def test_check_duplicate_flags_rows():
    row = (
        "Allocated to",
        "Partner",
        "123 Street",
        "partner@example.com",
        "250-555-1234",
        "Diesel",
        "Other Fuel",
        "Renewable diesel",
        "Provision A",
        "FC-001",
        25,
    )

    row_dict = _row_to_dict(row)
    seen_rows = {}

    first_result = _check_duplicate(row_dict, 2, seen_rows)
    assert first_result is None
    assert seen_rows

    duplicate_result = _check_duplicate(row_dict, 3, seen_rows)
    assert duplicate_result == {
        "message": "Row 3: Duplicate of row 2",
        "fields": FIELD_KEYS,
    }
