from http.client import HTTPException
from lcfs.web.api.admin_adjustment.validation import AdminAdjustmentValidation
import structlog
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request, UploadFile
from fastapi.params import File
from starlette import status
from starlette.responses import StreamingResponse

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService
from lcfs.services.s3.schema import FileResponseSchema
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.initiative_agreement.validation import InitiativeAgreementValidation
from lcfs.web.api.charging_site.validation import ChargingSiteValidation
from lcfs.web.core.decorators import view_handler


# Lazy-resolved CI validation: see note inside ``ci_application_validator``.
async def ci_application_validator(
    request: Request,
    db=Depends(get_async_db_session),
):
    """
    Resolve a CIApplicationValidation instance on-demand.

    Eagerly importing CIApplicationValidation at module load reaches
    the ci_application repo, which transitively re-enters this module
    via ``Document -> compliance_report -> s3.client``. Doing the
    import inside the request scope breaks that cycle and keeps
    FastAPI's DI behaviour intact.
    """
    from lcfs.web.api.ci_application.repo import CIApplicationRepository
    from lcfs.web.api.ci_application.validation import CIApplicationValidation

    return CIApplicationValidation(
        request=request, repo=CIApplicationRepository(db=db)
    )


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
@view_handler([RoleEnum.SUPPLIER, RoleEnum.ANALYST])
async def upload_file(
    request: Request,
    parent_id: int,
    parent_type: str,
    file: UploadFile = File(...),
    document_category: Optional[str] = Query(
        None,
        description=(
            "Optional Step 3 categorisation for ci_application uploads: "
            "'technical_report', 'ghgenius_model', or 'supporting'."
        ),
    ),
    document_service: DocumentService = Depends(),
    cr_validate: ComplianceReportValidation = Depends(),
    ia_validate: InitiativeAgreementValidation = Depends(),
    aa_validate: AdminAdjustmentValidation = Depends(),
    cs_validate: ChargingSiteValidation = Depends(),
    ci_validate=Depends(ci_application_validator),
) -> FileResponseSchema:
    if parent_type == "compliance_report":
        await cr_validate.validate_organization_access(parent_id)

    if parent_type == "initiativeAgreement":
        await ia_validate.validate_organization_access(parent_id)

    if parent_type == "adminAdjustment":
        await aa_validate.validate_organization_access(parent_id)

    if parent_type == "charging_site":
        await cs_validate.validate_organization_access(parent_id)

    if parent_type == "ci_application":
        await ci_validate.validate_access(parent_id)

    document = await document_service.upload_file(
        file,
        parent_id,
        parent_type,
        request.user,
        document_category=document_category,
    )
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
    cr_validate: ComplianceReportValidation = Depends(),
    ia_validate: InitiativeAgreementValidation = Depends(),
    aa_validate: AdminAdjustmentValidation = Depends(),
    cs_validate: ChargingSiteValidation = Depends(),
    ci_validate=Depends(ci_application_validator),
):
    if parent_type == "compliance_report":
        await cr_validate.validate_organization_access(parent_id)

    if parent_type == "initiativeAgreement":
        await ia_validate.validate_organization_access(parent_id)

    if parent_type == "adminAdjustment":
        await aa_validate.validate_organization_access(parent_id)

    if parent_type == "charging_site":
        await cs_validate.validate_organization_access(parent_id)

    if parent_type == "ci_application":
        await ci_validate.validate_access(parent_id)

    file, document = await document_service.get_object(document_id)

    headers = {
        "Content-Disposition": f'attachment; filename="{document.file_name}"',
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
    cr_validate: ComplianceReportValidation = Depends(),
    ia_validate: InitiativeAgreementValidation = Depends(),
    aa_validate: AdminAdjustmentValidation = Depends(),
    cs_validate: ChargingSiteValidation = Depends(),
    ci_validate=Depends(ci_application_validator),
):
    if parent_type == "compliance_report":
        await cr_validate.validate_organization_access(parent_id)
    elif parent_type == "initiativeAgreement":
        await ia_validate.validate_organization_access(parent_id)
    elif parent_type == "administrativeAdjustment":
        await aa_validate.validate_organization_access(parent_id)
    elif parent_type == "charging_site":
        await cs_validate.validate_organization_access(parent_id)
    elif parent_type == "ci_application":
        await ci_validate.validate_access(parent_id)
    else:
        raise HTTPException(403, "Unable to verify authorization for document download")

    await document_service.delete_file(document_id, parent_id, parent_type)
    return {"message": "File and metadata deleted successfully"}
