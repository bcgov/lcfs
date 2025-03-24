"""
allocation agreements endpoints
"""

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
)

from lcfs.db import dependencies
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
from lcfs.web.core.decorators import view_handler

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
