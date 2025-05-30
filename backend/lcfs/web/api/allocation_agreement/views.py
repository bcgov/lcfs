from typing import List, Optional

import structlog
from fastapi import (
    APIRouter,
    Body,
    HTTPException,
    status,
    Request,
    Response,
    Depends,
    Query,
    UploadFile,
    File,
    Form,
)
from starlette.responses import StreamingResponse, JSONResponse

from lcfs.db import dependencies
from lcfs.web.core.decorators import view_handler
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.allocation_agreement.schema import (
    AllocationAgreementCreateSchema,
    AllocationAgreementOptionsSchema,
    AllocationAgreementListSchema,
    AllocationAgreementRequestSchema,
    DeleteAllocationAgreementResponseSchema,
    PaginatedAllocationAgreementRequestSchema,
    AllocationAgreementAllSchema,
    OrganizationDetailsSchema,
)
from lcfs.web.api.allocation_agreement.services import AllocationAgreementServices
from lcfs.web.api.allocation_agreement.validation import AllocationAgreementValidation
from lcfs.web.api.base import ComplianceReportRequestSchema, PaginationRequestSchema
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.allocation_agreement.importer import AllocationAgreementImporter
from lcfs.web.api.allocation_agreement.export import AllocationAgreementExporter
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository

router = APIRouter()
logger = structlog.get_logger(__name__)
get_async_db = dependencies.get_async_db_session


@router.get(
    "/table-options",
    response_model=AllocationAgreementOptionsSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_table_options(
    request: Request,
    compliancePeriod: str,
    service: AllocationAgreementServices = Depends(),
):
    """Endpoint to retrieve table options related to allocation agreements"""
    return await service.get_table_options(compliancePeriod)


@router.post(
    "/list-all",
    response_model=AllocationAgreementAllSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_allocation_agreements(
    request: Request,
    request_data: AllocationAgreementRequestSchema = Body(...),
    response: Response = None,
    service: AllocationAgreementServices = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
):
    """Endpoint to get list of allocation agreements for a compliance report"""
    try:
        compliance_report_id = request_data.compliance_report_id

        compliance_report = await report_validate.validate_organization_access(
            compliance_report_id
        )
        if not compliance_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compliance report not found",
            )

        await report_validate.validate_compliance_report_access(compliance_report)
        return await service.get_allocation_agreements(
            request_data.compliance_report_id, request_data.changelog
        )
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions to preserve status code and message
        raise http_ex
    except Exception as e:
        # Log and handle unexpected errors
        logger.exception("Error occurred", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your request",
        )


@router.post(
    "/list",
    response_model=AllocationAgreementListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_allocation_agreements_paginated(
    request: Request,
    request_data: PaginatedAllocationAgreementRequestSchema = Body(...),
    service: AllocationAgreementServices = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
) -> AllocationAgreementListSchema:
    pagination = PaginationRequestSchema(
        page=request_data.page,
        size=request_data.size,
        sort_orders=request_data.sort_orders,
        filters=request_data.filters,
    )
    compliance_report_id = request_data.compliance_report_id
    await report_validate.validate_organization_access(compliance_report_id)
    return await service.get_allocation_agreements_paginated(
        pagination, compliance_report_id
    )


@router.post(
    "/save",
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.ANALYST]
)
async def save_allocation_agreements_row(
    request: Request,
    request_data: AllocationAgreementCreateSchema = Body(...),
    service: AllocationAgreementServices = Depends(),
    validate: AllocationAgreementValidation = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
):
    """Endpoint to save a single allocation agreements row"""
    compliance_report_id = request_data.compliance_report_id
    allocation_agreement_id: Optional[int] = request_data.allocation_agreement_id

    compliance_report = await report_validate.validate_organization_access(
        compliance_report_id
    )
    await report_validate.validate_compliance_report_access(compliance_report)
    await report_validate.validate_compliance_report_editable(compliance_report)

    await validate.validate_compliance_report_id(compliance_report_id, [request_data])
    if request_data.deleted:
        # Delete existing allocation agreement
        await service.delete_allocation_agreement(request_data)
        return DeleteAllocationAgreementResponseSchema(
            message="Allocation agreement deleted successfully"
        )
    elif allocation_agreement_id:
        # Update existing Allocation agreement
        await validate.validate_compliance_report_id(
            compliance_report_id, [request_data]
        )
        return await service.update_allocation_agreement(request_data)
    else:
        # Create new Allocation agreement
        await validate.validate_compliance_report_id(
            compliance_report_id, [request_data]
        )
        return await service.create_allocation_agreement(request_data)


@router.get("/search", response_model=List[OrganizationDetailsSchema], status_code=200)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def search_table_options_strings(
    request: Request,
    transaction_partner: Optional[str] = Query(
        None,
        alias="transactionPartner",
        description="Trading partner (company) for filtering options",
    ),
    service: OrganizationsService = Depends(),
):
    """Endpoint to search allocation agreement options based on a query string"""
    if transaction_partner:
        return await service.search_organization_details(transaction_partner)
    else:
        return []


@router.get(
    "/export/{report_id}",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def export_allocation_agreements(
    request: Request,
    report_id: int,
    exporter: AllocationAgreementExporter = Depends(),
    validate: ComplianceReportValidation = Depends(),
):
    """
    Export Allocation Agreement data (including row content) in an Excel file
    for a given Compliance Report.
    """
    try:
        compliance_report_id = int(report_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid compliance report id. Must be an integer."
        )

    await validate.validate_organization_access(compliance_report_id)
    organization = request.user.organization

    return await exporter.export(
        compliance_report_id, request.user, organization, include_data=True
    )


@router.post(
    "/import/{report_id}",
    response_class=JSONResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def import_allocation_agreements(
    request: Request,
    report_id: int,
    file: UploadFile = File(...),
    overwrite: bool = Form(...),
    importer: AllocationAgreementImporter = Depends(),
    compliance_report_services: ComplianceReportServices = Depends(),
    aa_repo: AllocationAgreementRepository = Depends(),
    validate: ComplianceReportValidation = Depends(),
):
    """
    Endpoint to import Allocation Agreement data from an uploaded Excel file.
    The Excel must have a sheet named 'Allocation Agreements' with the same columns as in the exporter.

    Columns:
        1. Responsibility
        2. Legal name of transaction partner
        3. Address for service
        4. Email
        5. Phone
        6. Fuel type
        7. Fuel type other
        8. Fuel category
        9. Determining Carbon Intensity
        10. Fuel code
        11. Quantity
    """
    try:
        compliance_report_id = int(report_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid compliance report id. Must be an integer."
        )

    await validate.validate_organization_access(compliance_report_id)

    # Check if overwrite is allowed
    compliance_report = await compliance_report_services.get_compliance_report_by_id(
        report_id=compliance_report_id,
        user=request.user,
    )
    await validate.validate_compliance_report_editable(compliance_report)

    is_original = compliance_report.version == 0

    if overwrite:
        existing_aa = await aa_repo.get_allocation_agreements(compliance_report_id)
        if not is_original and len(existing_aa) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Overwrite not allowed: this is a non-initial report with existing data",
            )

    # Import data
    job_id = await importer.import_data(
        compliance_report_id, request.user, file, overwrite
    )
    return {"jobId": job_id}


@router.get(
    "/template/{report_id}",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_allocation_agreement_template(
    request: Request,
    report_id: int,
    exporter: AllocationAgreementExporter = Depends(),
    validate: ComplianceReportValidation = Depends(),
):
    """
    Endpoint to export a template for Allocation Agreement
    """
    try:
        compliance_report_id = int(report_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid compliance report id. Must be an integer."
        )

    await validate.validate_organization_access(compliance_report_id)
    organization = request.user.organization

    return await exporter.export(
        compliance_report_id, request.user, organization, include_data=False
    )


@router.get(
    "/status/{job_id}", response_class=JSONResponse, status_code=status.HTTP_200_OK
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_allocation_agreement_import_status(
    request: Request,
    job_id: str,
    importer: AllocationAgreementImporter = Depends(),
):
    """
    Endpoint to get the current progress of a running Allocation Agreement job
    """
    status = await importer.get_status(job_id)
    return status
