from logging import getLogger
from typing import List

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.web.exception.exceptions import DataNotFoundException

from lcfs.db.models.Transfer import Transfer
from lcfs.db.models.TransferStatus import TransferStatus
from lcfs.db.models.Category import Category
from lcfs.db.models.Comment import Comment
from .schema import TransferSchema, TransferOrganizationSchema, TransferStatusSchema, TransferCategorySchema

logger = getLogger("transfer_repo")


class TransferRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def create_transfer(self, transfer: Transfer, comments: Comment):
        '''
        Save a transfer in the database
        '''
        self.db.add(comments)
        await self.db.flush()

        self.db.add(transfer)
        await self.db.flush()

        # TODO Remove these explicit mappings once pydantic models are setup
        from_organization_info = TransferOrganizationSchema(
            organization_id=transfer.from_organization.organization_id,
            name=transfer.from_organization.name
        )
        to_organization_info = TransferOrganizationSchema(
            organization_id=transfer.to_organization.organization_id,
            name=transfer.to_organization.name
        )
        transfer_status_info = TransferStatusSchema(
            status=transfer.transfer_status.status
        )
        transfer_category_info = TransferCategorySchema(
            category=transfer.transfer_category.category
        )
        transfer_data = TransferSchema(
            transfer_id=transfer.transfer_id,
            from_organization=from_organization_info,
            to_organization=to_organization_info,
            agreement_date=transfer.agreement_date,
            quantity=transfer.quantity,
            price_per_unit=transfer.price_per_unit,
            signing_authority_declaration=transfer.signing_authority_declaration,
            # comments=transfer.comments.comment,
            transfer_status=transfer_status_info,
            transfer_category=transfer_category_info,
            create_date=transfer.create_date,
            update_date=transfer.update_date,
        )

        return transfer_data
    
    @repo_handler
    async def get_transfer_status(self, transfer_status_id: int) -> TransferStatus:
        '''
        Fetch a single transfer status by transfer status id from the database
        '''
        return await self.db.scalar(
            select(TransferStatus).where(TransferStatus.transfer_status_id == transfer_status_id)
        )
    
    @repo_handler
    async def get_transfer_category(self, transfer_category_id: int) -> TransferStatus:
        '''
        Fetch a single category by category id from the database
        '''
        return await self.db.scalar(
            select(Category).where(Category.category_id == transfer_category_id)
        )