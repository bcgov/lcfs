from datetime import datetime
from fastapi import Depends, Request, HTTPException
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import InitiativeAgreementStatusEnum
from lcfs.web.api.initiative_agreement.schema import InitiativeAgreementCreateSchema, InitiativeAgreementSchema
from lcfs.web.api.initiative_agreement.repo import InitiativeAgreementRepository
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.role.schema import user_has_roles
from lcfs.db.models.transaction.Transaction import TransactionActionEnum
from lcfs.web.api.organizations.services import OrganizationsService

class InitiativeAgreementServices:
    def __init__(
        self, 
        repo: InitiativeAgreementRepository = Depends(InitiativeAgreementRepository),
        org_service: OrganizationsService = Depends(OrganizationsService),
        request: Request = None,
    ) -> None:
        self.repo = repo
        self.org_service = org_service
        self.request = request

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

        for field, value in initiative_agreement_data.dict(exclude_unset=True).items():
            if field != 'current_status':  # Skip the current_status field
                setattr(initiative_agreement, field, value)

        # Handle the current_status field separately
        if status_has_changed:
            initiative_agreement.current_status = new_status
            # If approving transaction, issue compliance units by Director
            if new_status.status == InitiativeAgreementStatusEnum.Approved:
                await self.director_approve_initiative_agreement(initiative_agreement)

        # Save the updated initiative agreement
        updated_initiative_agreement = await self.repo.update_initiative_agreement(initiative_agreement)
        
        if status_has_changed:
            await self.repo.add_initiative_agreement_history(
                initiative_agreement.initiative_agreement_id,
                new_status.initiative_agreement_status_id,
                self.request.user.user_profile_id
            )
            
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

        # If we skip draft on create and recommend then add history record
        if current_status.status == InitiativeAgreementStatusEnum.Recommended:
              await self.repo.add_initiative_agreement_history(
                  initiative_agreement.initiative_agreement_id,
                  current_status.initiative_agreement_status_id,
                  self.request.user.user_profile_id
              )

        return initiative_agreement


    async def director_approve_initiative_agreement(self, initiative_agreement: InitiativeAgreement):
        """Create ledger transaction for approved initiative agreement"""

        user = self.request.user
        has_director_role = user_has_roles(user, ["GOVERNMENT", "DIRECTOR"])

        if not has_director_role:
            raise HTTPException(status_code=403, detail="Forbidden.")
        
        if initiative_agreement.transaction != None:
            raise HTTPException(status_code=403, detail="Transaction already exists.")

        # Create new transaction for receiving organization
        to_transaction = await self.org_service.adjust_balance(
            transaction_action=TransactionActionEnum.Adjustment,
            compliance_units=initiative_agreement.compliance_units,
            organization_id=initiative_agreement.to_organization_id,
        )
        initiative_agreement.transaction = to_transaction

        # Set effective date to today if the analyst left it blank
        if initiative_agreement.transaction_effective_date == None:
            initiative_agreement.transaction_effective_date = datetime.now().date().isoformat()

        await self.repo.refresh_initiative_agreement(initiative_agreement)
