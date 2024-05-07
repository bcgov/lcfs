# initiative_agreement/services.py
from fastapi import Depends
from lcfs.db.models.InitiativeAgreement import InitiativeAgreement
from lcfs.web.api.initiative_agreement.schema import InitiativeAgreementCreateSchema, InitiativeAgreementSchema
from lcfs.web.api.initiative_agreement.repo import InitiativeAgreementRepository
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.core.decorators import service_handler

class InitiativeAgreementServices:
    def __init__(self, repo: InitiativeAgreementRepository = Depends(InitiativeAgreementRepository)):
        self.repo = repo

    @service_handler
    async def get_initiative_agreement(self, initiative_agreement_id: int) -> InitiativeAgreementSchema:
        """Fetch an initiative agreement by its ID."""
        initiative_agreement = await self.repo.get_initiative_agreement_by_id(initiative_agreement_id)
        return InitiativeAgreementSchema.from_orm(initiative_agreement)

    @service_handler
    async def update_initiative_agreement(self, initiative_agreement_data: InitiativeAgreementCreateSchema) -> InitiativeAgreementSchema:
        """Update an existing initiative agreement."""
        # Fetch the existing initiative agreement
        initiative_agreement = await self.repo.get_initiative_agreement_by_id(initiative_agreement_data.initiative_agreement_id)
        if not initiative_agreement:
            raise DataNotFoundException(f"Initiative Agreement with id {initiative_agreement_data.initiative_agreement_id} not found")
        
        # Fetch the new status
        new_status = await self.repo.get_initiative_agreement_status_by_name(initiative_agreement_data.current_status)
        
        # Check if the status has changed
        status_has_changed = initiative_agreement.current_status != new_status

        # Update other fields
        for field, value in initiative_agreement_data.dict(exclude_unset=True).items():
            setattr(initiative_agreement, field, value)

        # Update status
        if status_has_changed:
            initiative_agreement.current_status = new_status
            # TODO create history records on future status changes

        # Save the updated initiative agreement
        updated_initiative_agreement = await self.repo.update_initiative_agreement(initiative_agreement)
        
        return InitiativeAgreementSchema.from_orm(updated_initiative_agreement)

    @service_handler
    async def create_initiative_agreement(
        self, initiative_agreement_data: InitiativeAgreementCreateSchema
    ) -> InitiativeAgreementSchema:
        """
        Handles creating an initiative agreement, including creating a comment (if provided).
        """
        current_status = await self.repo.get_initiative_agreement_status_by_name(
            initiative_agreement_data.current_status
        )

        initiative_agreement = InitiativeAgreement(
            **initiative_agreement_data.model_dump(exclude={"current_status"})
        )

        initiative_agreement.current_status = current_status

        initiative_agreement = await self.repo.create_initiative_agreement(initiative_agreement)

        return initiative_agreement
