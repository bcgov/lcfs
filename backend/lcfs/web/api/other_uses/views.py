import structlog
from fastapi import (
    APIRouter,
    Body,
    status,
    Request,
    Response,
    Depends,
    HTTPException,
)
from typing import Optional

from lcfs.db import dependencies
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.other_uses.schema import (
    OtherUsesCreateSchema,
    OtherUsesTableOptionsSchema,
    DeleteOtherUsesResponseSchema,
    PaginatedOtherUsesRequestSchema,
    OtherUsesListSchema,
    OtherUsesAllSchema,
    OtherUsesRequestSchema,
)
from lcfs.web.api.other_uses.services import OtherUsesServices
from lcfs.web.api.other_uses.validation import OtherUsesValidation
from lcfs.web.core.decorators import view_handler

router = APIRouter()
logger = structlog.get_logger(__name__)
get_async_db = dependencies.get_async_db_session


@router.get(
    "/table-options",
    response_model=OtherUsesTableOptionsSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
# @cache(expire=60 * 60 * 24)  # cache for 24 hours
async def get_table_options(
    request: Request,
    compliancePeriod: str,
    service: OtherUsesServices = Depends(),
):
    """Endpoint to retrieve table options related to other uses"""
    return await service.get_table_options(compliancePeriod)


@router.post(
    "/list-all", response_model=OtherUsesAllSchema, status_code=status.HTTP_200_OK
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_other_uses(
    request: Request,
    request_data: OtherUsesRequestSchema = Body(...),
    response: Response = None,
    service: OtherUsesServices = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
):
    """Endpoint to get list of other uses for a compliance report"""
    try:
        compliance_report_id = request_data.compliance_report_id

        compliance_report = await service.get_compliance_report_by_id(
            compliance_report_id
        )
        if not compliance_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compliance report not found",
            )

        await report_validate.validate_compliance_report_access(compliance_report)
        await report_validate.validate_organization_access(
            request_data.compliance_report_id
        )
        return await service.get_other_uses(
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
    response_model=OtherUsesListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_other_uses_paginated(
    request: Request,
    request_data: PaginatedOtherUsesRequestSchema = Body(...),
    service: OtherUsesServices = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
) -> OtherUsesListSchema:
    pagination = PaginationRequestSchema(
        page=request_data.page,
        size=request_data.size,
        sort_orders=request_data.sort_orders,
        filters=request_data.filters,
    )
    compliance_report_id = request_data.compliance_report_id
    compliance_report = await report_validate.validate_organization_access(
        compliance_report_id
    )
    await report_validate.validate_compliance_report_access(compliance_report)
    return await service.get_other_uses_paginated(pagination, compliance_report_id)


@router.post(
    "/save",
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.ANALYST]
)
async def save_other_uses_row(
    request: Request,
    request_data: OtherUsesCreateSchema = Body(...),
    service: OtherUsesServices = Depends(),
    validate: OtherUsesValidation = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
):
    """Endpoint to save a single other uses row"""
    compliance_report_id = request_data.compliance_report_id
    other_uses_id: Optional[int] = request_data.other_uses_id

    compliance_report = await report_validate.validate_organization_access(
        compliance_report_id
    )
    await report_validate.validate_compliance_report_access(compliance_report)

    if request_data.deleted:
        # Delete existing other use
        await validate.validate_compliance_report_id(
            compliance_report_id, [request_data]
        )
        await service.delete_other_use(request_data)
        return DeleteOtherUsesResponseSchema(message="Other use deleted successfully")
    elif other_uses_id:
        # Update existing other use
        await validate.validate_compliance_report_id(
            compliance_report_id, [request_data]
        )
        return await service.update_other_use(request_data)
    else:
        # Create new other use
        await validate.validate_compliance_report_id(
            compliance_report_id, [request_data]
        )
        return await service.create_other_use(request_data)
