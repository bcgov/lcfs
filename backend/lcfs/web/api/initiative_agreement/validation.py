from fastapi import Depends, HTTPException, Request
from lcfs.web.api.initiative_agreement.schema import InitiativeAgreementSchema, InitiativeAgreementCreateSchema
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.db.models.InitiativeAgreementStatus import InitiativeAgreementStatusEnum

class InitiativeAgreementValidation:
    def __init__(self, request: Request = None, service: InitiativeAgreementServices = Depends(InitiativeAgreementServices)) -> None:
        self.request = request
        self.service = service

    async def validate_initiative_agreement_create(self, request, initiative_agreement: InitiativeAgreementCreateSchema):
        pass

    async def validate_initiative_agreement_update(self, request, updated_data: InitiativeAgreementSchema):
        # Retrieve the current initiative agreement from the database
        initiative_agreement = await self.service.get_initiative_agreement(updated_data.initiative_agreement_id)

        # Check if the current status is "Approved"
        if initiative_agreement.current_status.status == InitiativeAgreementStatusEnum.Approved:
            raise HTTPException(
                status_code=403,
                detail="Editing an approved initiative agreement is not allowed."
            )
        