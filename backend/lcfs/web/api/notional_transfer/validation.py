from typing import List
from fastapi import HTTPException, Request, Depends
from starlette import status

from lcfs.web.api.notional_transfer.schema import NotionalTransferCreateSchema
from lcfs.web.api.notional_transfer.repo import NotionalTransferRepository
from lcfs.web.exception.exceptions import ValidationErrorException


class NotionalTransferValidation:
    def __init__(
        self,
        request: Request = None,
        repo: NotionalTransferRepository = Depends(NotionalTransferRepository),
    ):
        self.request = request
        self.repo = repo

    async def validate_compliance_report_id(
        self,
        compliance_report_id: int,
        notional_transfers: List[NotionalTransferCreateSchema],
    ):
        for notional_transfer in notional_transfers:
            if notional_transfer.compliance_report_id != compliance_report_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Mismatch compliance_report_id in notional transfer: {notional_transfer}",
                )

    async def validate_no_duplicates(
        self, notional_transfer_data: NotionalTransferCreateSchema
    ):
        """Validates that the notional transfer doesn't duplicate an existing entry."""
        existing_transfers = await self.repo.get_notional_transfers(
            compliance_report_id=notional_transfer_data.compliance_report_id,
            changelog=False,
        )

        for existing in existing_transfers:
            # Skip self-updates
            if (
                notional_transfer_data.group_uuid
                and existing.group_uuid == notional_transfer_data.group_uuid
            ):
                continue

            if self._is_duplicate(notional_transfer_data, existing):
                raise ValidationErrorException(
                    {
                        "message": "Validation failed",
                        "errors": [
                            {
                                "fields": [
                                    "legalName",
                                    "fuelCategory",
                                    "receivedOrTransferred",
                                ],
                                "message": "Duplicate notional transfer detected. Please check trading partner, fuel category, and transfer type.",
                            }
                        ],
                    }
                )

    def _is_duplicate(
        self, new_transfer: NotionalTransferCreateSchema, existing_transfer
    ) -> bool:
        """Check if transfers are duplicates based on key business fields."""
        return (
            new_transfer.legal_name.strip().lower()
            == existing_transfer.legal_name.strip().lower()
            and new_transfer.fuel_category == existing_transfer.fuel_category
            and new_transfer.received_or_transferred
            == existing_transfer.received_or_transferred
            and self._quantities_match(new_transfer, existing_transfer)
            and new_transfer.is_canada_produced == existing_transfer.is_canada_produced
            and new_transfer.is_q1_supplied == existing_transfer.is_q1_supplied
        )

    def _quantities_match(self, new_transfer, existing_transfer) -> bool:
        """Compare quantity values between transfers."""

        def get_quantities(transfer):
            return (
                getattr(transfer, "quantity", 0) or 0,
                getattr(transfer, "q1_quantity", 0) or 0,
                getattr(transfer, "q2_quantity", 0) or 0,
                getattr(transfer, "q3_quantity", 0) or 0,
                getattr(transfer, "q4_quantity", 0) or 0,
            )

        return get_quantities(new_transfer) == get_quantities(existing_transfer)
