from logging import getLogger
from typing import List

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

from lcfs.db.models.Issuance import Issuance
from lcfs.db.models.Comment import Comment
from lcfs.web.api.issuance.repo import IssuanceRepository
from lcfs.web.api.issuance.schema import IssuanceSchema, IssuanceCreate

logger = getLogger("issuance_service")

class IssuanceServices:
    def __init__(
        self,
        request: Request = None,
        repo: IssuanceRepository = Depends(IssuanceRepository),
    ) -> None:
        self.repo = repo
        self.request = request

    @service_handler
    async def get_all_issuances(self) -> List[IssuanceSchema]:
        """Fetches all issuance records and converts them to Pydantic models."""
        issuances = await self.repo.get_all_issuances()
        return [IssuanceSchema.from_orm(issuance) for issuance in issuances]

    @service_handler
    async def get_issuances_paginated(self, page: int, size: int) -> List[IssuanceSchema]:
        issuances = await self.repo.get_issuances_paginated(page, size)
        return [IssuanceSchema.from_orm(issuance) for issuance in issuances]

    @service_handler
    async def get_issuance(self, issuance_id: int) -> IssuanceSchema:
        """Fetches a single issuance by its ID and converts it to a Pydantic model."""
        issuance = await self.repo.get_issuance_by_id(issuance_id)
        if not issuance:
            raise DataNotFoundException(f"Issuance with ID {issuance_id} not found")
        return IssuanceSchema.from_orm(issuance)

    @service_handler
    async def create_issuance(self, issuance_data: IssuanceCreate) -> IssuanceSchema:
        """
        Handles creating an issuance, including any necessary preprocessing.
        This method creates a new issuance record along with a comment (if provided).
        """
        new_comment = Comment(comment=issuance_data.comment) if issuance_data.comment else None

        issuance_model = Issuance(
            compliance_units=issuance_data.compliance_units,
            transaction_effective_date=issuance_data.transaction_effective_date,
            organization_id=issuance_data.organization_id,
            transaction_id=issuance_data.transaction_id,
            comments=new_comment  # Associate the comment with the issuance
        )

        # Persist the issuance model and its comment in the database
        created_issuance = await self.repo.create_issuance(issuance_model)

        return IssuanceSchema.from_orm(created_issuance)

    @service_handler
    async def update_issuance(self, issuance_id: int, issuance_data: IssuanceCreate) -> IssuanceSchema:
        """
        Updates an existing issuance record with new data.
        """
        issuance = await self.repo.get_issuance_by_id(issuance_id)
        if not issuance:
            raise DataNotFoundException(f"Issuance with ID {issuance_id} not found")

        # Update issuance fields here as needed
        # Example: issuance.compliance_units = issuance_data.compliance_units

        await self.repo.update_issuance(issuance)

        return IssuanceSchema.from_orm(issuance)
