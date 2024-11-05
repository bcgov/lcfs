import structlog
from typing import List

from fastapi import APIRouter, Depends, Request, UploadFile
from fastapi.params import File
from starlette import status
from starlette.responses import StreamingResponse

from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService
from lcfs.services.s3.schema import FileResponseSchema
from lcfs.web.core.decorators import view_handler

router = APIRouter()
logger = structlog.get_logger(__name__)


@router.get(
    "/{parent_type}/{parent_id}",
    response_model=List[FileResponseSchema],
    status_code=status.HTTP_200_OK,
)
async def get_all_documents(
    request: Request,
    parent_id: int,
    parent_type: str,
    document_service: DocumentService = Depends(),
) -> List[FileResponseSchema]:
    documents = await document_service.get_by_id_and_type(parent_id, parent_type)

    file_responses = [
        (FileResponseSchema.model_validate(document)) for document in documents
    ]

    return file_responses


@router.post(
    "/{parent_type}/{parent_id}",
    response_model=FileResponseSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.SUPPLIER])
async def upload_file(
    request: Request,
    parent_id: int,
    parent_type: str,
    file: UploadFile = File(...),
    document_service: DocumentService = Depends(),
) -> FileResponseSchema:
    document = await document_service.upload_file(file, parent_id, parent_type)
    return FileResponseSchema.model_validate(document)


@router.get(
    "/{parent_type}/{parent_id}/{document_id}",
    status_code=status.HTTP_200_OK,
)
async def stream_document(
    request: Request,
    parent_id: int,
    parent_type: str,
    document_id: int,
    document_service: DocumentService = Depends(),
):
    # TODO: Use parent ID and parent type to check permissions / security
    file, document = await document_service.get_object(document_id)

    headers = {
        "Content-Disposition": f'inline; filename="{document.file_name}"',
        "content-length": str(file["ContentLength"]),
    }

    return StreamingResponse(
        content=file["Body"], media_type=file["ContentType"], headers=headers
    )


@router.delete(
    "/{parent_type}/{parent_id}/{document_id}",
)
async def delete_file(
    request: Request,
    parent_type: str,
    parent_id: int,
    document_id: int,
    document_service: DocumentService = Depends(),
):
    # TODO: Use parent ID and parent type to check permissions / security
    await document_service.delete_file(document_id)
    return {"message": "File and metadata deleted successfully"}
