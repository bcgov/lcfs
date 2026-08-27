import structlog
from fastapi import APIRouter, Body, Depends, Query, Request, status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService
from lcfs.web.api.document_folder.schema import (
    DeletedDocumentsSchema,
    DocumentFolderTreeSchema,
    FolderCreateSchema,
    FolderItemsMoveSchema,
    FolderSchema,
    FolderUpdateSchema,
)
from lcfs.web.api.document_folder.services import DocumentFolderServices
from lcfs.web.api.initiative_agreement.validation import InitiativeAgreementValidation
from lcfs.web.core.decorators import view_handler

logger = structlog.get_logger(__name__)
router = APIRouter()

# The tree renders on the IDIR designated action page; the proponent view
# arrives with the BCeID story, like the rest of the module.
FOLDER_ROLES = [RoleEnum.IA_ANALYST, RoleEnum.IA_MANAGER, RoleEnum.DIRECTOR]


async def _validate_parent_access(
    parent_type: str,
    parent_id: int,
    service: DocumentFolderServices,
    document_service: DocumentService,
    ia_validate: InitiativeAgreementValidation,
) -> None:
    """Allow-list first, then the same access resolution the shared
    document routes use: a designated action's audience is its agreement's."""
    service.ensure_parent_type_enabled(parent_type)
    agreement_id = await document_service.get_designated_action_agreement_id(parent_id)
    await ia_validate.validate_organization_access(agreement_id)


@router.get(
    "/{parent_type}/{parent_id}",
    response_model=DocumentFolderTreeSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(FOLDER_ROLES)
async def get_document_folder_tree(
    request: Request,
    parent_type: str,
    parent_id: int,
    service: DocumentFolderServices = Depends(),
    document_service: DocumentService = Depends(),
    ia_validate: InitiativeAgreementValidation = Depends(),
) -> DocumentFolderTreeSchema:
    """The whole tree in one call: nested folders with documents inlined,
    plus the parent's unplaced documents at the root."""
    await _validate_parent_access(
        parent_type, parent_id, service, document_service, ia_validate
    )
    return await service.get_tree(parent_type, parent_id)


@router.get(
    "/{parent_type}/{parent_id}/deleted",
    response_model=DeletedDocumentsSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(FOLDER_ROLES)
async def get_deleted_documents(
    request: Request,
    parent_type: str,
    parent_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    service: DocumentFolderServices = Depends(),
    document_service: DocumentService = Depends(),
    ia_validate: InitiativeAgreementValidation = Depends(),
) -> DeletedDocumentsSchema:
    """Documents removed from this parent's tree. Nothing ever leaves."""
    await _validate_parent_access(
        parent_type, parent_id, service, document_service, ia_validate
    )
    return await service.get_deleted_documents(
        parent_type, parent_id, limit=limit, offset=offset
    )


@router.delete(
    "/{parent_type}/{parent_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@view_handler(FOLDER_ROLES)
async def soft_delete_document(
    request: Request,
    parent_type: str,
    parent_id: int,
    document_id: int,
    service: DocumentFolderServices = Depends(),
    document_service: DocumentService = Depends(),
    ia_validate: InitiativeAgreementValidation = Depends(),
) -> None:
    """Move a document to the bin.

    Deliberately not the shared delete route: that one destroys the S3
    object and the row, which is exactly what must not happen here.
    """
    await _validate_parent_access(
        parent_type, parent_id, service, document_service, ia_validate
    )
    await service.soft_delete_document(
        parent_type, parent_id, document_id, request.user
    )


@router.put(
    "/{parent_type}/{parent_id}/documents/{document_id}/restore",
    status_code=status.HTTP_204_NO_CONTENT,
)
@view_handler(FOLDER_ROLES)
async def restore_document(
    request: Request,
    parent_type: str,
    parent_id: int,
    document_id: int,
    service: DocumentFolderServices = Depends(),
    document_service: DocumentService = Depends(),
    ia_validate: InitiativeAgreementValidation = Depends(),
) -> None:
    """Return a document to the tree, or to the top level if the folder
    it came from has since been removed."""
    await _validate_parent_access(
        parent_type, parent_id, service, document_service, ia_validate
    )
    await service.restore_document(parent_type, parent_id, document_id)


@router.post(
    "/{parent_type}/{parent_id}",
    response_model=FolderSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler(FOLDER_ROLES)
async def create_document_folder(
    request: Request,
    parent_type: str,
    parent_id: int,
    data: FolderCreateSchema = Body(...),
    service: DocumentFolderServices = Depends(),
    document_service: DocumentService = Depends(),
    ia_validate: InitiativeAgreementValidation = Depends(),
) -> FolderSchema:
    await _validate_parent_access(
        parent_type, parent_id, service, document_service, ia_validate
    )
    return await service.create_folder(parent_type, parent_id, data)


@router.put(
    "/{parent_type}/{parent_id}/items",
    status_code=status.HTTP_204_NO_CONTENT,
)
@view_handler(FOLDER_ROLES)
async def move_document_folder_items(
    request: Request,
    parent_type: str,
    parent_id: int,
    data: FolderItemsMoveSchema = Body(...),
    service: DocumentFolderServices = Depends(),
    document_service: DocumentService = Depends(),
    ia_validate: InitiativeAgreementValidation = Depends(),
) -> None:
    """Bulk placement — one call per drag; a null folder moves to root."""
    await _validate_parent_access(
        parent_type, parent_id, service, document_service, ia_validate
    )
    await service.move_items(parent_type, parent_id, data)


@router.put(
    "/{parent_type}/{parent_id}/{folder_id}",
    response_model=FolderSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(FOLDER_ROLES)
async def update_document_folder(
    request: Request,
    parent_type: str,
    parent_id: int,
    folder_id: int,
    data: FolderUpdateSchema = Body(...),
    service: DocumentFolderServices = Depends(),
    document_service: DocumentService = Depends(),
    ia_validate: InitiativeAgreementValidation = Depends(),
) -> FolderSchema:
    """Rename and move, one route."""
    await _validate_parent_access(
        parent_type, parent_id, service, document_service, ia_validate
    )
    return await service.update_folder(parent_type, parent_id, folder_id, data)


@router.delete(
    "/{parent_type}/{parent_id}/{folder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@view_handler(FOLDER_ROLES)
async def delete_document_folder(
    request: Request,
    parent_type: str,
    parent_id: int,
    folder_id: int,
    strategy: str = Query(
        "reparent",
        description="reparent moves contents up one level, leaving nothing "
        "in the bin; cascade sends the subtree and everything filed in it "
        "to the bin together, restorable as a unit.",
    ),
    service: DocumentFolderServices = Depends(),
    document_service: DocumentService = Depends(),
    ia_validate: InitiativeAgreementValidation = Depends(),
) -> None:
    await _validate_parent_access(
        parent_type, parent_id, service, document_service, ia_validate
    )
    await service.delete_folder(
        parent_type, parent_id, folder_id, strategy, request.user
    )


@router.put(
    "/{parent_type}/{parent_id}/{folder_id}/restore",
    status_code=status.HTTP_204_NO_CONTENT,
)
@view_handler(FOLDER_ROLES)
async def restore_document_folder(
    request: Request,
    parent_type: str,
    parent_id: int,
    folder_id: int,
    service: DocumentFolderServices = Depends(),
    document_service: DocumentService = Depends(),
    ia_validate: InitiativeAgreementValidation = Depends(),
) -> None:
    """Bring a folder back where it was, with what was inside it."""
    await _validate_parent_access(
        parent_type, parent_id, service, document_service, ia_validate
    )
    await service.restore_folder(parent_type, parent_id, folder_id)
