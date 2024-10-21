from fastapi import Depends, HTTPException, Request
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.initiative_agreement.schema import (
    InitiativeAgreementSchema,
    InitiativeAgreementCreateSchema,
)
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatusEnum,
)
from lcfs.web.api.role.schema import user_has_roles
from starlette import status


class InitiativeAgreementValidation:
    def __init__(
        self,
        request: Request = None,
        service: InitiativeAgreementServices = Depends(InitiativeAgreementServices),
    ) -> None:
        self.request = request
        self.service = service

    async def validate_initiative_agreement_create(
        self, request, initiative_agreement: InitiativeAgreementCreateSchema
    ):
        pass

    async def validate_initiative_agreement_update(
        self, request, updated_data: InitiativeAgreementSchema
    ):
        # Retrieve the current initiative agreement from the database
        initiative_agreement = await self.service.get_initiative_agreement(
            updated_data.initiative_agreement_id
        )

        # Check if the current status is "Approved"
        if (
            initiative_agreement.current_status.status
            == InitiativeAgreementStatusEnum.Approved
        ):
            raise HTTPException(
                status_code=403,
                detail="Editing an approved initiative agreement is not allowed.",
            )

    async def validate_organization_access(self, initiative_agreement_id: int):
        initiative_agreement = await self.service.get_initiative_agreement(initiative_agreement_id)
        if not initiative_agreement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found.",
            )

        organization_id = initiative_agreement.to_organization.organization_id
        user_organization_id = (
            self.request.user.organization.organization_id
            if self.request.user.organization
            else None
        )

        if (
            not user_has_roles(self.request.user, [RoleEnum.GOVERNMENT])
            and organization_id != user_organization_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have access to this transaction.",
            )
