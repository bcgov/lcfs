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
from lcfs.db.models.Comment import Comment
from lcfs.db.models.Organization import Organization
from lcfs.web.api.organization.repo import OrganizationRepository
from lcfs.web.api.transfer.repo import TransferRepository  # Adjust import path as needed
from lcfs.web.api.transfer.schema import TransferCreate  # Adjust import path as needed

logger = getLogger("transfer_service")

class TransferServices:
    def __init__(
        self,
        request: Request = None,
        repo: TransferRepository = Depends(TransferRepository),
        org_repo: OrganizationRepository = Depends(OrganizationRepository)
    ) -> None:
        self.repo = repo
        self.request = request
        self.org_repo = org_repo

    @service_handler
    async def create_transfer(self, transfer_data: TransferCreate):
        '''Handles creating a transfer, including any necessary preprocessing.'''

        # Fetch organization instances
        from_org = await self.org_repo.get_organization_lite(transfer_data.from_organization_id)
        to_org = await self.org_repo.get_organization_lite(transfer_data.to_organization_id)

        if not from_org or not to_org:
            raise DataNotFoundException("One or more organizations not found")
        
        comments = Comment(comment=transfer_data.comments)

        status = await self.repo.get_transfer_status(transfer_status_id=1)
        category = await self.repo.get_transfer_category(transfer_category_id=1)

        transfer_model = Transfer(
            from_organization=from_org,
            to_organization=to_org,
            agreement_date=transfer_data.agreement_date,
            quantity=transfer_data.quantity,
            price_per_unit=transfer_data.price_per_unit,
            signing_authority_declaration=transfer_data.signing_authority_declaration,
            comments=comments,
            transfer_status=status,
            transfer_category=category
        )

        return await self.repo.create_transfer(transfer_model, comments)