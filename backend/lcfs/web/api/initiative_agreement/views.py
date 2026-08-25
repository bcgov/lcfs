from typing import List

from fastapi import APIRouter, Body, Depends, Request, status
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.web.api.initiative_agreement.schema import (
    DesignatedActionHistorySchema,
    DesignatedActionWorkflowSchema,
    RecommendedCreditsSchema,
    EvidenceRequirementCreateSchema,
    EvidenceRequirementSchema,
    EvidenceRequirementUpdateSchema,
    DesignatedActionProfileSchema,
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

# Recording an assessment is the analyst's job and a manager may cover for
# them; directors see the review but do not author it (#4899).
IA_REVIEW_ROLES = [RoleEnum.IA_ANALYST, RoleEnum.IA_MANAGER]

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
    "/designated-actions/{designated_action_id}/workflow",
    response_model=DesignatedActionSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_IDIR_ROLES)
async def perform_designated_action_workflow(
    request: Request,
    designated_action_id: int,
    data: DesignatedActionWorkflowSchema = Body(...),
    service: InitiativeAgreementServices = Depends(),
):
    """Advance a designated action through its review workflow.

    Gated to the Initiative Agreement roles at the door; which specific
    action each role may take is enforced against the transition table.
    """
    return await service.perform_workflow_action(
        designated_action_id, data, request.user
    )


@router.put(
    "/designated-actions/{designated_action_id}/recommended-credits",
    response_model=DesignatedActionSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_REVIEW_ROLES)
async def set_designated_action_recommended_credits(
    request: Request,
    designated_action_id: int,
    data: RecommendedCreditsSchema = Body(...),
    service: InitiativeAgreementServices = Depends(),
):
    """Save the recommended amount before recommending."""
    return await service.set_recommended_credits(
        designated_action_id, data.recommended_credits, request.user
    )


@router.get(
    "/designated-actions/{designated_action_id}/history",
    response_model=List[DesignatedActionHistorySchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_IDIR_ROLES)
async def get_designated_action_history(
    request: Request,
    designated_action_id: int,
    service: InitiativeAgreementServices = Depends(),
):
    """The audit trail behind a designated action."""
    return await service.get_designated_action_history(designated_action_id)


@router.get(
    "/designated-actions/{designated_action_id}/evidence-requirements",
    response_model=List[EvidenceRequirementSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_IDIR_ROLES)
async def get_evidence_requirements(
    request: Request,
    designated_action_id: int,
    service: InitiativeAgreementServices = Depends(),
):
    """The evidence of completion list for a designated action."""
    return await service.get_evidence_requirements(designated_action_id)


@router.post(
    "/designated-actions/{designated_action_id}/evidence-requirements",
    response_model=EvidenceRequirementSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler(IA_REVIEW_ROLES)
async def create_evidence_requirement(
    request: Request,
    designated_action_id: int,
    data: EvidenceRequirementCreateSchema = Body(...),
    service: InitiativeAgreementServices = Depends(),
):
    """Add an evidence requirement to a designated action."""
    return await service.create_evidence_requirement(
        designated_action_id, data, request.user
    )


@router.put(
    "/evidence-requirements/{evidence_requirement_id}",
    response_model=EvidenceRequirementSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_REVIEW_ROLES)
async def update_evidence_requirement(
    request: Request,
    evidence_requirement_id: int,
    data: EvidenceRequirementUpdateSchema = Body(...),
    service: InitiativeAgreementServices = Depends(),
):
    """Edit a requirement's wording or record the analyst's assessment."""
    return await service.update_evidence_requirement(
        evidence_requirement_id, data, request.user
    )


@router.delete(
    "/evidence-requirements/{evidence_requirement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@view_handler(IA_REVIEW_ROLES)
async def deactivate_evidence_requirement(
    request: Request,
    evidence_requirement_id: int,
    service: InitiativeAgreementServices = Depends(),
):
    """Remove a requirement from the list without erasing it."""
    await service.deactivate_evidence_requirement(evidence_requirement_id, request.user)


@router.get(
    "/designated-actions/{designated_action_id}/profile",
    response_model=DesignatedActionProfileSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_IDIR_ROLES)
async def get_designated_action_profile(
    request: Request,
    designated_action_id: int,
    service: InitiativeAgreementServices = Depends(),
):
    """The designated action detail page's record."""
    return await service.get_designated_action_profile(designated_action_id)


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
