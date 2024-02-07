import io
import random
import math
from datetime import datetime
from logging import getLogger
from typing import List

from fastapi import Depends, Request
from fastapi.responses import StreamingResponse

from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

from lcfs.db.models.Transfer import Transfer
from lcfs.web.api.transfer.repo import TransferRepository  # Adjust import path as needed
from lcfs.web.api.transfer.schema import TransferCreate  # Adjust import path as needed

logger = getLogger("transfer_service")

class TransferServices:
    def __init__(
        self,
        request: Request = None,
        repo: TransferRepository = Depends(TransferRepository)  # Ensure dependency is correctly injected
    ) -> None:
        self.repo = repo
        self.request = request

    @service_handler
    async def create_transfer(self, transfer_data: TransferCreate):
        '''Handles creating a transfer, including any necessary preprocessing.'''

        # Transform the TransferCreate data to the Transfer model data here
        transfer_model_data = {
            "from_organization_id": transfer_data.from_organization_id,
            "to_organization_id": transfer_data.to_organization_id,
            "agreement_date": transfer_data.agreement_date,  # Assuming this is already a datetime object
            "quantity": transfer_data.quantity,
            "price_per_unit": transfer_data.price_per_unit,
            "signing_authority_declaration": transfer_data.signing_authority_declaration,
            "comments": transfer_data.comments,
        }

        # Create a Transfer model instance
        new_transfer = Transfer(**transfer_model_data)

        self.repo.create_transfer(new_transfer)