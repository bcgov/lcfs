"""File routes for answering an EOC information request (#5545).

Kept out of views.py: the S3 DocumentService imports the initiative agreement
package, so importing it from that package's views is a cycle. The API router
registers this module after both are loaded.
"""

from fastapi import APIRouter, Depends, File, Request, UploadFile, status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService
from lcfs.services.s3.schema import FileResponseSchema
from lcfs.web.api.initiative_agreement.eoc_information_request import (
    EocInformationRequestService,
)
from lcfs.web.core.decorators import view_handler

router = APIRouter()

EOC_EDITOR_ROLES = [RoleEnum.IA_PROPONENT, RoleEnum.IA_SIGNER]


@router.post(
    "/designated-actions/{designated_action_id}/eoc/information-requests/{request_id}/documents",
    response_model=FileResponseSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler(EOC_EDITOR_ROLES)
async def upload_eoc_information_document(
    request: Request,
    designated_action_id: int,
    request_id: int,
    file: UploadFile = File(...),
    service: EocInformationRequestService = Depends(),
    document_service: DocumentService = Depends(),
):
    """Add a file to an open request; it also joins the DA's document tree."""
    document = await service.upload_document(
        designated_action_id, request_id, file, document_service
    )
    return FileResponseSchema.model_validate(document).for_viewer(request.user)


@router.delete(
    "/designated-actions/{designated_action_id}/eoc/information-requests/{request_id}/documents/{document_id}",
)
@view_handler(EOC_EDITOR_ROLES)
async def delete_eoc_information_document(
    request: Request,
    designated_action_id: int,
    request_id: int,
    document_id: int,
    service: EocInformationRequestService = Depends(),
    document_service: DocumentService = Depends(),
):
    """Remove a file the caller added to an open request."""
    await service.delete_document(
        designated_action_id, request_id, document_id, document_service
    )
    return {"message": "File removed"}
