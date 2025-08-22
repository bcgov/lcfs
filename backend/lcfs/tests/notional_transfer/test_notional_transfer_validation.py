import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi import HTTPException

from lcfs.web.api.notional_transfer.schema import (
    NotionalTransferCreateSchema,
    NotionalTransferSchema,
)
from lcfs.web.api.notional_transfer.validation import NotionalTransferValidation
from lcfs.web.exception.exceptions import ValidationErrorException


@pytest.fixture
def validation():
    mock_repo = MagicMock()
    return NotionalTransferValidation(request=MagicMock(), repo=mock_repo), mock_repo


@pytest.mark.anyio
async def test_validate_compliance_report_id_mismatch():
    """Test compliance report ID validation fails on mismatch."""
    validation = NotionalTransferValidation(request=MagicMock(), repo=MagicMock())

    with pytest.raises(HTTPException):
        await validation.validate_compliance_report_id(
            1,
            [
                NotionalTransferCreateSchema(
                    compliance_report_id=2,  # Different ID
                    fuel_category="Gasoline",
                    legal_name="Test Company",
                    address_for_service="123 Test St",
                    quantity=1000,
                    received_or_transferred="Received",
                    is_canada_produced=True,
                    is_q1_supplied=False,
                )
            ],
        )


@pytest.mark.anyio
async def test_no_duplicates_validation_passes(validation):
    """Test validation passes when no duplicates exist."""
    val, mock_repo = validation
    mock_repo.get_notional_transfers = AsyncMock(return_value=[])

    new_transfer = NotionalTransferCreateSchema(
        compliance_report_id=1,
        fuel_category="Gasoline",
        legal_name="Test Company",
        address_for_service="123 Test St",
        quantity=1000,
        received_or_transferred="Received",
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    await val.validate_no_duplicates(new_transfer)  # Should not raise


@pytest.mark.anyio
async def test_duplicate_detection_fails(validation):
    """Test validation fails when duplicate exists."""
    val, mock_repo = validation

    existing_transfer = NotionalTransferSchema(
        compliance_report_id=1,
        fuel_category="Gasoline",
        legal_name="Test Company",
        address_for_service="123 Test St",
        quantity=1000,
        received_or_transferred="Received",
        group_uuid="different-uuid",
        is_canada_produced=True,
        is_q1_supplied=False,
    )
    mock_repo.get_notional_transfers = AsyncMock(return_value=[existing_transfer])

    new_transfer = NotionalTransferCreateSchema(
        compliance_report_id=1,
        fuel_category="Gasoline",
        legal_name="Test Company",
        address_for_service="123 Test St",
        quantity=1000,
        received_or_transferred="Received",
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    with pytest.raises(ValidationErrorException) as exc_info:
        await val.validate_no_duplicates(new_transfer)

    assert (
        "Duplicate notional transfer detected"
        in exc_info.value.errors["errors"][0]["message"]
    )


@pytest.mark.anyio
async def test_case_insensitive_duplicate_detection(validation):
    """Test case insensitive legal name matching."""
    val, mock_repo = validation

    existing_transfer = NotionalTransferSchema(
        compliance_report_id=1,
        fuel_category="Gasoline",
        legal_name="test company",  # lowercase
        address_for_service="123 Test St",
        quantity=1000,
        received_or_transferred="Received",
        group_uuid="different-uuid",
        is_canada_produced=True,
        is_q1_supplied=False,
    )
    mock_repo.get_notional_transfers = AsyncMock(return_value=[existing_transfer])

    new_transfer = NotionalTransferCreateSchema(
        compliance_report_id=1,
        fuel_category="Gasoline",
        legal_name="TEST COMPANY",  # uppercase
        address_for_service="123 Test St",
        quantity=1000,
        received_or_transferred="Received",
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    with pytest.raises(ValidationErrorException):
        await val.validate_no_duplicates(new_transfer)


@pytest.mark.anyio
async def test_different_fields_allowed(validation):
    """Test that different key fields are allowed."""
    val, mock_repo = validation

    existing_transfer = NotionalTransferSchema(
        compliance_report_id=1,
        fuel_category="Gasoline",
        legal_name="Test Company",
        address_for_service="123 Test St",
        quantity=1000,
        received_or_transferred="Received",
        group_uuid="different-uuid",
        is_canada_produced=True,
        is_q1_supplied=False,
    )
    mock_repo.get_notional_transfers = AsyncMock(return_value=[existing_transfer])

    # Different fuel category should pass
    new_transfer = NotionalTransferCreateSchema(
        compliance_report_id=1,
        fuel_category="Diesel",  # Different
        legal_name="Test Company",
        address_for_service="123 Test St",
        quantity=1000,
        received_or_transferred="Received",
        is_canada_produced=True,
        is_q1_supplied=False,
    )
    await val.validate_no_duplicates(new_transfer)  # Should not raise


@pytest.mark.anyio
async def test_same_group_uuid_update_allowed(validation):
    """Test that updating the same record is allowed."""
    val, mock_repo = validation

    same_group_uuid = "same-group-uuid"
    existing_transfer = NotionalTransferSchema(
        compliance_report_id=1,
        fuel_category="Gasoline",
        legal_name="Test Company",
        address_for_service="123 Test St",
        quantity=1000,
        received_or_transferred="Received",
        group_uuid=same_group_uuid,
        is_canada_produced=True,
        is_q1_supplied=False,
    )
    mock_repo.get_notional_transfers = AsyncMock(return_value=[existing_transfer])

    update_transfer = NotionalTransferCreateSchema(
        compliance_report_id=1,
        fuel_category="Gasoline",
        legal_name="Test Company",
        address_for_service="123 Test St",
        quantity=1000,
        received_or_transferred="Received",
        group_uuid=same_group_uuid,
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    await val.validate_no_duplicates(update_transfer)  # Should not raise
