# initiative_agreement/routes.py
from fastapi import APIRouter, Depends, Request, status
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.web.api.initiative_agreement.schema import InitiativeAgreementCreateSchema, InitiativeAgreementSchema
from lcfs.web.api.initiative_agreement.validation import InitiativeAgreementValidation
from lcfs.web.core.decorators import roles_required, view_handler

router = APIRouter()

@router.get("/{initiative_agreement_id}", response_model=InitiativeAgreementSchema)
@view_handler
async def get_initiative_agreement(
    initiative_agreement_id: int,
    service: InitiativeAgreementServices = Depends()
):
    """Endpoint to fetch an initiative agreement by its ID."""
    return await service.get_initiative_agreement(initiative_agreement_id)

@router.put("/{initiative_agreement_id}", response_model=InitiativeAgreementSchema, status_code=status.HTTP_200_OK)
@view_handler
@roles_required("Government")
async def update_initiative_agreement(
    request: Request,
    initiative_agreement_id: int,
    initiative_agreement_data: InitiativeAgreementCreateSchema,
    service: InitiativeAgreementServices = Depends(),
    validate: InitiativeAgreementValidation = Depends()
):
    """Endpoint to update an existing initiative agreement."""
    await validate.validate_initiative_agreement(request, initiative_agreement_data)
    initiative_agreement_data.initiative_agreement_id = initiative_agreement_id
    return await service.update_initiative_agreement(initiative_agreement_data)

@router.post("/", response_model=InitiativeAgreementSchema, status_code=status.HTTP_201_CREATED)
@roles_required("Government")
@view_handler
async def create_initiative_agreement(
    request: Request,
    initiative_agreement_create: InitiativeAgreementCreateSchema = ...,
    initiative_agreement_service: InitiativeAgreementServices = Depends(),
    validate: InitiativeAgreementValidation = Depends(),
):
    """Endpoint to create a new initiative agreement."""
    await validate.validate_initiative_agreement(request, initiative_agreement_create)
    return await initiative_agreement_service.create_initiative_agreement(initiative_agreement_create)
