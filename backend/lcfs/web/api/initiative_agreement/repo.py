from fastapi import Depends
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.models.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.InitiativeAgreementStatus import InitiativeAgreementStatus
from lcfs.web.api.initiative_agreement.schema import InitiativeAgreementCreateSchema

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler

class InitiativeAgreementRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_initiative_agreement_by_id(self, initiative_agreement_id: int) -> Optional[InitiativeAgreement]:
        query = select(InitiativeAgreement).options(
            selectinload(InitiativeAgreement.to_organization),
            selectinload(InitiativeAgreement.current_status),
        ).where(InitiativeAgreement.initiative_agreement_id == initiative_agreement_id)
        result = await self.db.execute(query)
        return result.scalars().first()
    
    @repo_handler
    async def create_initiative_agreement(self, initiative_agreement: InitiativeAgreement) -> InitiativeAgreement:
        self.db.add(initiative_agreement)
        await self.db.flush()
        return initiative_agreement

    @repo_handler
    async def update_initiative_agreement(self, initiative_agreement: InitiativeAgreement) -> InitiativeAgreement:
        initiative_agreement = self.db.merge(initiative_agreement)
        await self.db.flush()
        return initiative_agreement

    @repo_handler
    async def get_initiative_agreement_status_by_name(self, status_name: str) -> InitiativeAgreementStatus:
        query = await self.db.execute(
            select(InitiativeAgreementStatus).where(InitiativeAgreementStatus.status == status_name)
        )
        status = query.scalars().first()
        
        if not status:
            raise DataNotFoundException(f"Initiative Agreement status '{status_name}' not found")
        
        return status
