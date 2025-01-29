import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException, Request

from lcfs.web.api.notional_transfer.schema import NotionalTransferCreateSchema
from lcfs.web.api.notional_transfer.validation import NotionalTransferValidation


@pytest.fixture
def notional_transfer_validation():
    request = MagicMock(spec=Request)
    validation = NotionalTransferValidation(request=request)
    return validation


@pytest.mark.anyio
async def test_validate_compliance_report_id_success(notional_transfer_validation):
    validation = notional_transfer_validation
    compliance_report_id = 1
    notional_transfer_data = [
        NotionalTransferCreateSchema(
            compliance_report_id=compliance_report_id,
            fuel_category="Gasoline",
            legal_name="Test Legal Name",
            address_for_service="Test Address",
            quantity=1000,
            received_or_transferred="Received",
        )
    ]

    await validation.validate_compliance_report_id(
        compliance_report_id, notional_transfer_data
    )


@pytest.mark.anyio
async def test_validate_compliance_report_id_failure(notional_transfer_validation):
    validation = notional_transfer_validation
    compliance_report_id = 1
    notional_transfer_data = [
        NotionalTransferCreateSchema(
            compliance_report_id=2,  # Different from the passed compliance_report_id
            fuel_category="Gasoline",
            legal_name="Test Legal Name",
            address_for_service="Test Address",
            quantity=1000,
            received_or_transferred="Received",
        )
    ]

    with pytest.raises(HTTPException) as exc_info:
        await validation.validate_compliance_report_id(
            compliance_report_id, notional_transfer_data
        )

    assert exc_info.value.status_code == 400
    assert "Mismatch compliance_report_id" in str(exc_info.value.detail)
