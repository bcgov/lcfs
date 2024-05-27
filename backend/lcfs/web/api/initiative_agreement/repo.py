from fastapi import Depends
from datetime import datetime
from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import InitiativeAgreementStatus
from lcfs.db.models.initiative_agreement.InitiativeAgreementHistory import InitiativeAgreementHistory
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
            selectinload(InitiativeAgreement.history).selectinload(
                InitiativeAgreementHistory.user_profile),
            selectinload(InitiativeAgreement.history).selectinload(
                InitiativeAgreementHistory.initiative_agreement_status)
        ).where(InitiativeAgreement.initiative_agreement_id == initiative_agreement_id)
        result = await self.db.execute(query)
        return result.scalars().first()
    
    @repo_handler
    async def create_initiative_agreement(self, initiative_agreement: InitiativeAgreement) -> InitiativeAgreement:
        self.db.add(initiative_agreement)
        await self.db.flush()
        await self.db.refresh(initiative_agreement, [
            "to_organization",
            "current_status",
            "history",
        ])  # Ensures that all specified relations are up-to-date
        return initiative_agreement

    @repo_handler
    async def update_initiative_agreement(self, initiative_agreement: InitiativeAgreement) -> InitiativeAgreement:
        merged_initiative_agreement = await self.db.merge(initiative_agreement)
        await self.db.flush()
        return merged_initiative_agreement

    @repo_handler
    async def get_initiative_agreement_status_by_name(self, status_name: str) -> InitiativeAgreementStatus:
        query = await self.db.execute(
            select(InitiativeAgreementStatus).where(InitiativeAgreementStatus.status == status_name)
        )
        status = query.scalars().first()
        
        if not status:
            raise DataNotFoundException(f"Initiative Agreement status '{status_name}' not found")
        
        return status

    @repo_handler
    async def add_initiative_agreement_history(
        self, 
        initiative_agreement_id: int, 
        initiative_agreement_status_id: int, 
        user_profile_id: int
    ) -> InitiativeAgreementHistory:
        """
        Adds a new record to the initiative agreement history in the database.

        Args:
            initiative_agreement_id (int): The ID of the initiative agreement to which this history record relates.
            initiative_agreement_status_id (int): The status ID that describes the current state of the initiative agreement.
            user_profile_id (int): The ID of the user who made the change.

        Returns:
            InitiativeAgreementHistory: The newly created initiative agreement history record.
        """
        new_history_record = InitiativeAgreementHistory(
            initiative_agreement_id=initiative_agreement_id,
            initiative_agreement_status_id=initiative_agreement_status_id,
            user_profile_id=user_profile_id
        )
        self.db.add(new_history_record)
        await self.db.flush()
        return new_history_record

    @repo_handler
    async def update_initiative_agreement_history(
        self, 
        initiative_agreement_id: int, 
        initiative_agreement_status_id: int, 
        user_profile_id: int
    ) -> InitiativeAgreementHistory:
        """
        Updates an initiative agreement history record in the database.

        Args:
            initiative_agreement_id (int): The ID of the initiative agreement to which this history record relates.
            initiative_agreement_status_id (int): The status ID that describes the current state of the initiative agreement.
            user_profile_id (int): The ID of the user who made the change.

        Returns:
            InitiativeAgreementHistory: The updated initiative agreement history record.
        """
        existing_history = await self.db.scalar(
            select(InitiativeAgreementHistory).where(
                and_(
                    InitiativeAgreementHistory.initiative_agreement_id == initiative_agreement_id,
                    InitiativeAgreementHistory.initiative_agreement_status_id == initiative_agreement_status_id,
                )
            )
        )
        existing_history.create_date = datetime.now()
        existing_history.update_date = datetime.now()
        existing_history.user_profile_id = user_profile_id
        self.db.add(existing_history)
        await self.db.flush()
        return existing_history

    @repo_handler
    async def refresh_initiative_agreement(self, initiative_agreement: InitiativeAgreement) -> InitiativeAgreement:
        """
        Commits and refreshes an initiative agreement object in db session

        """
        await self.db.refresh(initiative_agreement)
        return initiative_agreement