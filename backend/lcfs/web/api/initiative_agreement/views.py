from typing import List

from fastapi import (
    APIRouter,
    Body,
    Depends,
    HTTPException,
    Request,
    status,
)

from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.dependency import get_s3_client
from lcfs.services.s3.schema import DocumentRenameSchema, FileResponseSchema
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.initiative_agreement.schema import (
    EOCInformationRequestCreateSchema,
    EOCInformationRequestResponseSchema,
    EOCSaveSchema,
    EOCSchema,
    AllDesignatedActionsListSchema,
    AgreementCreateSchema,
    AgreementUpdateSchema,
    AnalystAssignmentSchema,
    DesignatedActionCreateSchema,
    DesignatedActionDocumentTargetSchema,
    DesignatedActionHistorySchema,
    DesignatedActionProfileSchema,
    DesignatedActionSchema,
    DesignatedActionsListSchema,
    DesignatedActionUpdateSchema,
    DesignatedActionWorkflowSchema,
    EvidenceRequirementCreateSchema,
    EvidenceRequirementSchema,
    EvidenceRequirementUpdateSchema,
    IAAnalystSchema,
    InitiativeAgreementCreateSchema,
    InitiativeAgreementLifecycleStatusSchema,
    InitiativeAgreementNoteCreateSchema,
    InitiativeAgreementNoteSchema,
    InitiativeAgreementNoteUpdateSchema,
    InitiativeAgreementProfileSchema,
    InitiativeAgreementSchema,
    InitiativeAgreementsListSchema,
    InitiativeAgreementUpdateSchema,
    RecommendedCreditsSchema,
)
from lcfs.web.api.initiative_agreement.eoc_information_request import (
    EocInformationRequestService,
)
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.web.api.initiative_agreement.validation import InitiativeAgreementValidation
from lcfs.web.core.decorators import view_handler

# Agreement-management endpoints are scoped to the Initiative Agreement roles.
# RoleEnum.GOVERNMENT would admit every IDIR user of any role; IA_PROPONENT is
# not redundant beside it, because BCeID proponents need their own agreements.
IA_MODULE_ROLES = [
    RoleEnum.IA_ANALYST,
    RoleEnum.IA_MANAGER,
    RoleEnum.DIRECTOR,
    RoleEnum.IA_PROPONENT,
    RoleEnum.IA_SIGNER,
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
    "/agreements",
    response_model=InitiativeAgreementProfileSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler(IA_REVIEW_ROLES)
async def create_agreement(
    request: Request,
    data: AgreementCreateSchema = Body(...),
    service: InitiativeAgreementServices = Depends(),
):
    """Start a new initiative agreement. One entered by government starts
    Underway (#5186)."""
    return await service.create_agreement(data, request.user)


@router.put(
    "/agreements/{initiative_agreement_id}",
    response_model=InitiativeAgreementProfileSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_REVIEW_ROLES)
async def update_agreement(
    request: Request,
    initiative_agreement_id: int,
    data: AgreementUpdateSchema = Body(...),
    service: InitiativeAgreementServices = Depends(),
):
    """Edit an existing agreement's details."""
    return await service.update_agreement(initiative_agreement_id, data, request.user)


@router.post(
    "/{initiative_agreement_id}/designated-actions",
    response_model=DesignatedActionSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler(IA_REVIEW_ROLES)
async def create_designated_action(
    request: Request,
    initiative_agreement_id: int,
    data: DesignatedActionCreateSchema = Body(...),
    service: InitiativeAgreementServices = Depends(),
):
    """Add a designated action while the agreement is a draft or underway."""
    return await service.create_designated_action(
        initiative_agreement_id, data, request.user
    )


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


@router.post(
    "/designated-actions/list",
    response_model=AllDesignatedActionsListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_IDIR_ROLES)
async def get_all_designated_actions(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: InitiativeAgreementServices = Depends(),
):
    """Every agreement's designated actions, for the module's Designated
    actions tab (#5078). IDIR only; proponents arrive with the BCeID
    stories."""
    return await service.get_all_designated_actions_paginated(pagination)


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
    "/designated-actions/{designated_action_id}",
    response_model=DesignatedActionSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_REVIEW_ROLES)
async def update_designated_action(
    request: Request,
    designated_action_id: int,
    data: DesignatedActionUpdateSchema = Body(...),
    service: InitiativeAgreementServices = Depends(),
):
    """Correct a designated action's details. Every change is recorded."""
    return await service.update_designated_action(
        designated_action_id, data, request.user
    )


@router.put(
    "/designated-actions/{designated_action_id}/assign",
    response_model=DesignatedActionSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_IDIR_ROLES)
async def assign_designated_action_analyst(
    request: Request,
    designated_action_id: int,
    data: AnalystAssignmentSchema = Body(...),
    service: InitiativeAgreementServices = Depends(),
):
    """Assign, reassign or unassign an analyst (any IDIR IA user, as with
    compliance reports: IA analysts, IA managers and directors)."""
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


@router.get(
    "/{initiative_agreement_id}/document-restore-targets",
    response_model=List[DesignatedActionDocumentTargetSchema],
)
@view_handler(IA_MODULE_ROLES)
async def get_designated_action_document_targets(
    request: Request,
    initiative_agreement_id: int,
    service: InitiativeAgreementServices = Depends(),
    validate: InitiativeAgreementValidation = Depends(),
):
    """Action identifiers needed to show an agreement's user-scoped bins."""
    await validate.validate_organization_access(initiative_agreement_id)
    targets = await service.get_designated_action_document_targets(
        initiative_agreement_id, request.user
    )
    return [
        {
            "designated_action_id": action_id,
            "action_number": action_number,
        }
        for action_id, action_number in targets
    ]


@router.get(
    "/{initiative_agreement_id}/notes",
    response_model=List[InitiativeAgreementNoteSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_IDIR_ROLES)
async def get_notes(
    request: Request,
    initiative_agreement_id: int,
    service: InitiativeAgreementServices = Depends(),
):
    """The agreement's notes, ordered by note number."""
    return await service.get_notes(initiative_agreement_id, request.user)


@router.get(
    "/{initiative_agreement_id}/notes/next-number",
    response_model=float,
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_REVIEW_ROLES)
async def get_next_note_number(
    request: Request,
    initiative_agreement_id: int,
    service: InitiativeAgreementServices = Depends(),
):
    """The note number the add-note form starts from."""
    return float(
        await service.get_next_note_number(initiative_agreement_id, request.user)
    )


@router.post(
    "/{initiative_agreement_id}/notes",
    response_model=InitiativeAgreementNoteSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler(IA_REVIEW_ROLES)
async def create_note(
    request: Request,
    initiative_agreement_id: int,
    data: InitiativeAgreementNoteCreateSchema = Body(...),
    service: InitiativeAgreementServices = Depends(),
):
    """Add a note to the agreement."""
    return await service.create_note(initiative_agreement_id, data, request.user)


@router.put(
    "/{initiative_agreement_id}/notes/{note_id}",
    response_model=InitiativeAgreementNoteSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(IA_REVIEW_ROLES)
async def update_note(
    request: Request,
    initiative_agreement_id: int,
    note_id: int,
    data: InitiativeAgreementNoteUpdateSchema = Body(...),
    service: InitiativeAgreementServices = Depends(),
):
    """Change a note's number or content."""
    return await service.update_note(
        initiative_agreement_id, note_id, data, request.user
    )


@router.delete(
    "/{initiative_agreement_id}/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@view_handler(IA_REVIEW_ROLES)
async def delete_note(
    request: Request,
    initiative_agreement_id: int,
    note_id: int,
    service: InitiativeAgreementServices = Depends(),
):
    """Permanently remove a note."""
    await service.delete_note(initiative_agreement_id, note_id, request.user)


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
    # A draft is hidden from government (#5186), here as on every other route.
    await validate.validate_organization_access(
        initiative_agreement_data.initiative_agreement_id
    )
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


@router.get("/designated-actions/{designated_action_id}/eoc", response_model=EOCSchema)
@view_handler(IA_MODULE_ROLES)
async def get_eoc(
    request: Request,
    designated_action_id: int,
    service: InitiativeAgreementServices = Depends(),
):
    return await service.get_eoc(designated_action_id)


@router.put("/designated-actions/{designated_action_id}/eoc", response_model=EOCSchema)
@view_handler([RoleEnum.IA_PROPONENT, RoleEnum.IA_SIGNER])
async def save_eoc(
    request: Request,
    designated_action_id: int,
    data: EOCSaveSchema,
    service: InitiativeAgreementServices = Depends(),
):
    return await service.save_eoc(designated_action_id, data)


@router.post(
    "/designated-actions/{designated_action_id}/eoc/submit", response_model=EOCSchema
)
@view_handler([RoleEnum.IA_SIGNER])
async def submit_eoc(
    request: Request,
    designated_action_id: int,
    data: EOCSaveSchema,
    service: InitiativeAgreementServices = Depends(),
):
    return await service.save_eoc(designated_action_id, data, submit=True)


@router.get(
    "/designated-actions/{designated_action_id}/eoc/submissions/{submission_id}/documents/{document_id}"
)
@view_handler(IA_MODULE_ROLES)
async def download_eoc_submission_document(
    request: Request,
    designated_action_id: int,
    submission_id: int,
    document_id: int,
    service: InitiativeAgreementServices = Depends(),
    s3_client=Depends(get_s3_client),
):
    # Resolve storage lazily to avoid the S3/initiative agreement import cycle.
    from lcfs.services.s3.client import DocumentService
    from lcfs.web.api.document.views import (
        BLOCKED_SCAN_STATUSES,
        _content_disposition,
    )
    from starlette.responses import StreamingResponse

    snapshot = await service.get_eoc_submission_document(
        designated_action_id, submission_id, document_id
    )
    storage = DocumentService(db=service.repo.db, s3_client=s3_client)
    file, document = await storage.get_object(document_id)
    if document.scan_status in BLOCKED_SCAN_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=BLOCKED_SCAN_STATUSES[document.scan_status],
        )
    return StreamingResponse(
        content=file["Body"],
        media_type=snapshot.mime_type,
        headers={
            "Content-Disposition": _content_disposition(snapshot.file_name),
            "content-length": str(file["ContentLength"]),
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox",
        },
    )


# --- Requests for additional information on one EOC (#5545) -------------
# Every route below is authorized again in EocInformationRequestService:
# the decorator's roles are only the first gate. The file upload and remove
# routes need the S3 service, which imports this package, so they live in
# eoc_information_request_documents.py.


@router.post(
    "/designated-actions/{designated_action_id}/eoc/requirements/{evidence_requirement_id}/information-requests",
    response_model=EOCSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler(IA_REVIEW_ROLES)
async def request_eoc_information(
    request: Request,
    designated_action_id: int,
    evidence_requirement_id: int,
    data: EOCInformationRequestCreateSchema,
    service: EocInformationRequestService = Depends(),
):
    """Ask the proponent for more on one EOC; opens only that EOC to them."""
    return await service.request_information(
        designated_action_id, evidence_requirement_id, data
    )


@router.put(
    "/designated-actions/{designated_action_id}/eoc/information-requests/{request_id}",
    response_model=EOCSchema,
)
@view_handler([RoleEnum.IA_PROPONENT, RoleEnum.IA_SIGNER])
async def save_eoc_information_response(
    request: Request,
    designated_action_id: int,
    request_id: int,
    data: EOCInformationRequestResponseSchema,
    service: EocInformationRequestService = Depends(),
):
    return await service.save_response(designated_action_id, request_id, data)


@router.post(
    "/designated-actions/{designated_action_id}/eoc/information-requests/{request_id}/submit",
    response_model=EOCSchema,
)
@view_handler([RoleEnum.IA_SIGNER])
async def submit_eoc_information_response(
    request: Request,
    designated_action_id: int,
    request_id: int,
    data: EOCInformationRequestResponseSchema,
    service: EocInformationRequestService = Depends(),
):
    return await service.submit_response(designated_action_id, request_id, data)


@router.put(
    "/designated-actions/{designated_action_id}/eoc/information-requests/{request_id}/documents/{document_id}",
    response_model=FileResponseSchema,
)
@view_handler([RoleEnum.IA_PROPONENT, RoleEnum.IA_SIGNER])
async def rename_eoc_information_document(
    request: Request,
    designated_action_id: int,
    request_id: int,
    document_id: int,
    data: DocumentRenameSchema,
    service: EocInformationRequestService = Depends(),
):
    document = await service.rename_document(
        designated_action_id, request_id, document_id, data.display_name
    )
    return FileResponseSchema.model_validate(document).for_viewer(request.user)
