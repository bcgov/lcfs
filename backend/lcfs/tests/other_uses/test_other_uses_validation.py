import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError

from lcfs.web.api.other_uses.schema import OtherUsesCreateSchema, OtherUsesSchema
from lcfs.web.api.other_uses.validation import OtherUsesValidation

@pytest.fixture
def other_uses_validation():
    request = MagicMock(spec=Request)
    validation = OtherUsesValidation(request=request)
    return validation

@pytest.mark.anyio
async def test_validate_compliance_report_id_success(other_uses_validation):
    validation = other_uses_validation
    compliance_report_id = 1
    other_uses_data = [
        OtherUsesCreateSchema(
            compliance_report_id=compliance_report_id,
            quantity_supplied=1000,
            fuel_type="Gasoline",
            fuel_category="Petroleum-based",
            expected_use="Transportation",
            units="L",
            rationale="Test rationale",
            provision_of_the_act="Provision A",
            is_canada_produced=True,
            is_q1_supplied=False,
        )
    ]

    await validation.validate_compliance_report_id(compliance_report_id, other_uses_data)

@pytest.mark.anyio
async def test_validate_compliance_report_id_failure(other_uses_validation):
    validation = other_uses_validation
    compliance_report_id = 1
    other_uses_data = [
        OtherUsesCreateSchema(
            compliance_report_id=2,  # Different from the passed compliance_report_id
            quantity_supplied=1000,
            fuel_type="Gasoline",
            fuel_category="Petroleum-based",
            expected_use="Transportation",
            units="L",
            rationale="Test rationale",
            provision_of_the_act="Provision A",
            is_canada_produced=True,
            is_q1_supplied=False,
        )
    ]

    with pytest.raises(HTTPException) as exc_info:
        await validation.validate_compliance_report_id(compliance_report_id, other_uses_data)

    assert exc_info.value.status_code == 400
    assert "Mismatch compliance_report_id" in str(exc_info.value.detail)


def test_other_expected_use_requires_rationale():
    with pytest.raises(RequestValidationError) as exc:
        OtherUsesCreateSchema(
            compliance_report_id=1,
            quantity_supplied=1000,
            fuel_type="Gasoline",
            fuel_category="Petroleum-based",
            expected_use="Other",
            rationale="   ",
            units="L",
            provision_of_the_act="Provision A",
            is_canada_produced=True,
            is_q1_supplied=False,
        )

    errors = exc.value.errors()
    assert len(errors) == 1
    assert errors[0]["loc"] == ("rationale",)
    assert "required when Expected use is Other" in errors[0]["msg"]


def test_non_other_expected_use_allows_blank_rationale():
    schema = OtherUsesCreateSchema(
        compliance_report_id=1,
        quantity_supplied=1000,
        fuel_type="Gasoline",
        fuel_category="Petroleum-based",
        expected_use="Transportation",
        rationale="   ",
        units="L",
        provision_of_the_act="Provision A",
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    assert schema.expected_use == "Transportation"


def test_response_schema_allows_legacy_other_without_rationale():
    schema = OtherUsesSchema(
        compliance_report_id=1,
        quantity_supplied=1000,
        fuel_type="Gasoline",
        fuel_category="Petroleum-based",
        expected_use="Other",
        rationale=None,
        units="L",
        provision_of_the_act="Provision A",
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    assert schema.expected_use == "Other"
    assert schema.rationale is None
