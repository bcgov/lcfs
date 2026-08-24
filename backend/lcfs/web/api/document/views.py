from fastapi import HTTPException
from lcfs.web.api.admin_adjustment.validation import AdminAdjustmentValidation
import structlog
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query, Request, UploadFile
from fastapi.params import File
from starlette import status
from starlette.responses import StreamingResponse

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService
from lcfs.services.s3.schema import DocumentRenameSchema, FileResponseSchema
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.initiative_agreement.validation import InitiativeAgreementValidation
from lcfs.web.api.charging_site.validation import ChargingSiteValidation
from lcfs.web.core.decorators import view_handler


def _content_disposition(filename: str) -> str:
    ascii_fallback = filename.encode("ascii", "ignore").decode("ascii") or "download"
    encoded = quote(filename, safe="")
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{encoded}"


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

    return CIApplicationValidation(request=request, repo=CIApplicationRepository(db=db))


router = APIRouter()
logger = structlog.get_logger(__name__)


async def validate_parent_access(
    parent_type: str,
    parent_id: int,
    request: Request,
    document_service: DocumentService,
    cr_validate: ComplianceReportValidation,
    ia_validate: InitiativeAgreementValidation,
    aa_validate: AdminAdjustmentValidation,
    cs_validate: ChargingSiteValidation,
    ci_validate,
) -> None:
    """
    Assert the caller may reach *parent_id* of *parent_type*.

    Every document route funnels through this, so a parent type that is not
    handled fails closed rather than silently skipping validation.
    """
    if parent_type == "compliance_report":
        await cr_validate.validate_organization_access(parent_id)
    elif parent_type == "initiativeAgreement":
        await ia_validate.validate_organization_access(parent_id)
    elif parent_type in ("adminAdjustment", "administrativeAdjustment"):
        # The service layer and the delete route spell this
        # "administrativeAdjustment"; the frontend sends the same. Accept both
        # so the guard cannot be bypassed by choosing the other spelling.
        await aa_validate.validate_organization_access(parent_id)
    elif parent_type == "charging_site":
        await cs_validate.validate_organization_access(parent_id)
    elif parent_type == "ci_application":
        await ci_validate.validate_access(parent_id)
    elif parent_type == "internal_comment":
        await document_service.verify_internal_comment_access(
            parent_id, request.user, write=False
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unsupported document parent type.",
        )


@router.get(
    "/{parent_type}/{parent_id}",
    response_model=List[FileResponseSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_all_documents(
    request: Request,
    parent_id: int,
    parent_type: str,
    document_service: DocumentService = Depends(),
    cr_validate: ComplianceReportValidation = Depends(),
    ia_validate: InitiativeAgreementValidation = Depends(),
    aa_validate: AdminAdjustmentValidation = Depends(),
    cs_validate: ChargingSiteValidation = Depends(),
    ci_validate=Depends(ci_application_validator),
) -> List[FileResponseSchema]:
    # Previously only internal_comment was validated, so any authenticated
    # user could enumerate file names, sizes and uploader usernames for any
    # compliance report, agreement or charging site by iterating parent_id.
    await validate_parent_access(
        parent_type,
        parent_id,
        request,
        document_service,
        cr_validate,
        ia_validate,
        aa_validate,
        cs_validate,
        ci_validate,
    )

    documents = await document_service.get_by_id_and_type(parent_id, parent_type)

    file_responses = [
        FileResponseSchema.model_validate(document) for document in documents
    ]

    # The IA detail page shows which organization supplied each file, so
    # resolve uploader usernames to their organization's code in one query.
    usernames = {f.create_user for f in file_responses if f.create_user}
    codes = await document_service.get_uploading_organization_codes(usernames)
    return [
        f.model_copy(update={"uploading_organization_code": codes.get(f.create_user)})
        for f in file_responses
    ]


@router.post(
    "/{parent_type}/{parent_id}",
    response_model=FileResponseSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler(
    [
        RoleEnum.SUPPLIER,
        RoleEnum.ANALYST,
        RoleEnum.GOVERNMENT,
        RoleEnum.CI_APPLICANT,
    ]
)
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
@view_handler(["*"])
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
    await validate_parent_access(
        parent_type,
        parent_id,
        request,
        document_service,
        cr_validate,
        ia_validate,
        aa_validate,
        cs_validate,
        ci_validate,
    )

    # Scoped to the parent: validating access to parent_id is meaningless if
    # the caller can then name any document id in the system.
    file, document = await document_service.get_object_for_parent(
        document_id, parent_id, parent_type
    )

    download_name = document.display_name or document.file_name
    headers = {
        "Content-Disposition": _content_disposition(download_name),
        "content-length": str(file["ContentLength"]),
    }

    return StreamingResponse(
        content=file["Body"], media_type=file["ContentType"], headers=headers
    )


@router.put(
    "/{parent_type}/{parent_id}/{document_id}",
    response_model=FileResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [
        RoleEnum.SUPPLIER,
        RoleEnum.ANALYST,
        RoleEnum.GOVERNMENT,
        RoleEnum.CI_APPLICANT,
    ]
)
async def rename_file(
    request: Request,
    parent_type: str,
    parent_id: int,
    document_id: int,
    data: DocumentRenameSchema,
    document_service: DocumentService = Depends(),
    cr_validate: ComplianceReportValidation = Depends(),
    ia_validate: InitiativeAgreementValidation = Depends(),
    aa_validate: AdminAdjustmentValidation = Depends(),
    cs_validate: ChargingSiteValidation = Depends(),
    ci_validate=Depends(ci_application_validator),
) -> FileResponseSchema:
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
    elif parent_type == "internal_comment":
        await document_service.verify_internal_comment_access(
            parent_id, request.user, write=True
        )
    else:
        raise HTTPException(403, "Unable to verify authorization for document rename")

    document = await document_service.rename_file(
        document_id, parent_id, parent_type, data.display_name
    )
    return FileResponseSchema.model_validate(document)


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
    elif parent_type == "internal_comment":
        await document_service.verify_internal_comment_access(
            parent_id, request.user, write=True
        )
    else:
        raise HTTPException(403, "Unable to verify authorization for document download")

    await document_service.delete_file(document_id, parent_id, parent_type)
    return {"message": "File and metadata deleted successfully"}
