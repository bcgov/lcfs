from fastapi import APIRouter, Depends, Request, status
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.web.api.initiative_agreement.schema import (
    InitiativeAgreementCreateSchema,
    InitiativeAgreementSchema,
    InitiativeAgreementUpdateSchema,
)
from lcfs.web.api.initiative_agreement.validation import InitiativeAgreementValidation
from lcfs.web.core.decorators import view_handler
from lcfs.db.models.user.Role import RoleEnum

router = APIRouter()


@router.get("/{initiative_agreement_id}", response_model=InitiativeAgreementSchema)
@view_handler(["*"])
async def get_initiative_agreement(
    request: Request,
    initiative_agreement_id: int,
    service: InitiativeAgreementServices = Depends(),
):
    """Endpoint to fetch an initiative agreement by its ID."""
    return await service.get_initiative_agreement(initiative_agreement_id)


@router.put(
    "/", response_model=InitiativeAgreementSchema, status_code=status.HTTP_200_OK
)
@view_handler([RoleEnum.GOVERNMENT])
async def update_initiative_agreement(
    request: Request,
    initiative_agreement_data: InitiativeAgreementUpdateSchema = ...,
    service: InitiativeAgreementServices = Depends(),
    validate: InitiativeAgreementValidation = Depends(),
):
    """Endpoint to update an existing initiative agreement."""
    await validate.validate_initiative_agreement_update(
        request, initiative_agreement_data
    )
    return await service.update_initiative_agreement(initiative_agreement_data)


@router.post(
    "/", response_model=InitiativeAgreementSchema, status_code=status.HTTP_201_CREATED
)
@view_handler([RoleEnum.GOVERNMENT])
async def create_initiative_agreement(
    request: Request,
    initiative_agreement_create: InitiativeAgreementCreateSchema = ...,
    service: InitiativeAgreementServices = Depends(),
    validate: InitiativeAgreementValidation = Depends(),
):
    """Endpoint to create a new initiative agreement."""
    await validate.validate_initiative_agreement_create(
        request, initiative_agreement_create
    )
    return await service.create_initiative_agreement(initiative_agreement_create)
