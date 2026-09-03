from fastapi import Depends, HTTPException, Request
from starlette import status

from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatusEnum,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.initiative_agreement.schema import (
    InitiativeAgreementSchema,
    InitiativeAgreementCreateSchema,
)
from lcfs.web.api.initiative_agreement.repo import InitiativeAgreementRepository
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.web.api.role.schema import user_has_roles


class InitiativeAgreementValidation:
    def __init__(
        self,
        request: Request = None,
        service: InitiativeAgreementServices = Depends(InitiativeAgreementServices),
        repo: InitiativeAgreementRepository = Depends(InitiativeAgreementRepository),
    ) -> None:
        self.request = request
        self.service = service
        self.repo = repo

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
        # Fetch via the repository (not the legacy response schema): agreement
        # management records may have no award-era compliance_units, which the
        # legacy schema rejects.
        initiative_agreement = await self.repo.get_initiative_agreement_by_id(
            initiative_agreement_id
        )
        if not initiative_agreement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Initiative agreement not found.",
            )

        # to_organization is nullable on this table, and dereferencing it
        # unguarded turned a data gap into a 500 on every route that validates
        # an agreement, including the document endpoints.
        if initiative_agreement.to_organization is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Initiative agreement not found.",
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
                detail="User does not have access to this initiative agreement.",
            )
