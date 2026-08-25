from typing import List

from fastapi import APIRouter, Body, Depends, Request, status
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.web.api.initiative_agreement.schema import (
    AnalystAssignmentSchema,
    DesignatedActionSchema,
    DesignatedActionsListSchema,
    IAAnalystSchema,
    InitiativeAgreementCreateSchema,
    InitiativeAgreementLifecycleStatusSchema,
    InitiativeAgreementProfileSchema,
    InitiativeAgreementSchema,
    InitiativeAgreementsListSchema,
    InitiativeAgreementUpdateSchema,
)
from lcfs.web.api.initiative_agreement.validation import InitiativeAgreementValidation
from lcfs.web.core.decorators import view_handler
from lcfs.db.models.user.Role import RoleEnum

# Agreement-management endpoints are scoped to the Initiative Agreement roles.
# RoleEnum.GOVERNMENT would admit every IDIR user of any role; IA_PROPONENT is
# not redundant beside it, because BCeID proponents need their own agreements.
IA_MODULE_ROLES = [
    RoleEnum.IA_ANALYST,
    RoleEnum.IA_MANAGER,
    RoleEnum.DIRECTOR,
    RoleEnum.IA_PROPONENT,
]

# The designated-action grid and analyst tools are the IDIR story (#4896);
# the proponent's view arrives with the BCeID story.
IA_IDIR_ROLES = [RoleEnum.IA_ANALYST, RoleEnum.IA_MANAGER, RoleEnum.DIRECTOR]

router = APIRouter()


@router.post(
    "/list",
    response_model=InitiativeAgreementsListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_MODULE_ROLES)
async def get_initiative_agreements(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: InitiativeAgreementServices = Depends(),
):
    """Paginated list of initiative agreements for the agreement-management grid."""
    return await service.get_initiative_agreements_paginated(pagination)


@router.get(
    "/analysts",
    response_model=List[IAAnalystSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_IDIR_ROLES)
async def get_initiative_agreement_analysts(
    request: Request,
    service: InitiativeAgreementServices = Depends(),
):
    """Active IA analysts, for the assignment dropdown and its filter."""
    return await service.get_available_analysts()


@router.post(
    "/{initiative_agreement_id}/designated-actions/list",
    response_model=DesignatedActionsListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_IDIR_ROLES)
async def get_designated_actions(
    request: Request,
    initiative_agreement_id: int,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: InitiativeAgreementServices = Depends(),
):
    """Paginated designated actions for one agreement's grid."""
    return await service.get_designated_actions_paginated(
        initiative_agreement_id, pagination
    )


@router.put(
    "/designated-actions/{designated_action_id}/assign",
    response_model=DesignatedActionSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.IA_MANAGER, RoleEnum.DIRECTOR])
async def assign_designated_action_analyst(
    request: Request,
    designated_action_id: int,
    data: AnalystAssignmentSchema = Body(...),
    service: InitiativeAgreementServices = Depends(),
):
    """Assign, reassign or unassign an analyst (IA managers and directors)."""
    return await service.assign_designated_action_analyst(
        designated_action_id, data, request.user
    )


@router.get(
    "/statuses",
    response_model=List[InitiativeAgreementLifecycleStatusSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_MODULE_ROLES)
async def get_initiative_agreement_statuses(
    request: Request,
    service: InitiativeAgreementServices = Depends(),
):
    """Lifecycle statuses for the agreement grid's status filter."""
    return await service.get_lifecycle_statuses()


@router.get(
    "/{initiative_agreement_id}/profile",
    response_model=InitiativeAgreementProfileSchema,
)
@view_handler(IA_MODULE_ROLES)
async def get_initiative_agreement_profile(
    request: Request,
    initiative_agreement_id: int,
    service: InitiativeAgreementServices = Depends(),
    validate: InitiativeAgreementValidation = Depends(),
):
    """Agreement profile with designated actions for the detail page."""
    await validate.validate_organization_access(initiative_agreement_id)
    return await service.get_initiative_agreement_profile(initiative_agreement_id)


@router.get("/{initiative_agreement_id}", response_model=InitiativeAgreementSchema)
@view_handler(["*"])
async def get_initiative_agreement(
    request: Request,
    initiative_agreement_id: int,
    service: InitiativeAgreementServices = Depends(),
    validate: InitiativeAgreementValidation = Depends(),
):
    """Endpoint to fetch an initiative agreement by its ID."""
    await validate.validate_organization_access(initiative_agreement_id)
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
