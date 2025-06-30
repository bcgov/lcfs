"""
Notional Transfers endpoints
"""

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
from fastapi_cache.decorator import cache
from typing import Optional, Union

from lcfs.db import dependencies
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.notional_transfer.schema import (
    NotionalTransferCreateSchema,
    NotionalTransferSchema,
    NotionalTransfersSchema,
    NotionalTransferTableOptionsSchema,
    DeleteNotionalTransferResponseSchema,
    PaginatedNotionalTransferRequestSchema,
    NotionalTransfersAllSchema,
    NotionalTransfersRequestSchema,
)
from lcfs.web.api.notional_transfer.services import NotionalTransferServices
from lcfs.web.api.notional_transfer.validation import NotionalTransferValidation
from lcfs.web.core.decorators import view_handler

router = APIRouter()
logger = structlog.get_logger(__name__)
get_async_db = dependencies.get_async_db_session


@router.get(
    "/table-options",
    response_model=NotionalTransferTableOptionsSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
@cache(expire=60 * 60 * 24)  # cache for 24 hours
async def get_table_options(
    request: Request,
    service: NotionalTransferServices = Depends(),
):
    """Endpoint to retrieve table options related to notional transfers"""
    return await service.get_table_options()


@router.post(
    "/list-all",
    response_model=NotionalTransfersAllSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_notional_transfers(
    request: Request,
    request_data: NotionalTransfersRequestSchema = Body(...),
    response: Response = None,
    service: NotionalTransferServices = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
):
    """Endpoint to get list of notional transfers for a compliance report"""

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
        await report_validate.validate_organization_access(compliance_report_id)
        return await service.get_notional_transfers(
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
    response_model=NotionalTransfersSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_notional_transfers_paginated(
    request: Request,
    request_data: PaginatedNotionalTransferRequestSchema = Body(...),
    service: NotionalTransferServices = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
) -> NotionalTransfersSchema:
    pagination = PaginationRequestSchema(
        page=request_data.page,
        size=request_data.size,
        sort_orders=request_data.sort_orders,
        filters=request_data.filters,
    )
    await report_validate.validate_organization_access(
        request_data.compliance_report_id
    )
    compliance_report_id = request_data.compliance_report_id
    return await service.get_notional_transfers_paginated(
        pagination,
        compliance_report_id,
    )


@router.get("/{notional_transfer_id}", status_code=status.HTTP_200_OK)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_notional_transfer(
    request: Request,
    notional_transfer_id: int,
    service: NotionalTransferServices = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
) -> NotionalTransferSchema:
    notional_transfer = await service.get_notional_transfer(notional_transfer_id)
    if not notional_transfer:
        raise HTTPException(status_code=404, detail="Notional transfer not found")
    await report_validate.validate_organization_access(
        notional_transfer.compliance_report_id
    )
    return notional_transfer


@router.post(
    "/save",
    response_model=Union[NotionalTransferSchema, DeleteNotionalTransferResponseSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.ANALYST]
)
async def save_notional_transfer_row(
    request: Request,
    request_data: NotionalTransferCreateSchema = Body(...),
    service: NotionalTransferServices = Depends(),
    validate: NotionalTransferValidation = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
):
    """Endpoint to save a single notional transfer row"""
    compliance_report_id = request_data.compliance_report_id
    notional_transfer_id: Optional[int] = request_data.notional_transfer_id

    compliance_report = await report_validate.validate_organization_access(
        compliance_report_id
    )
    await report_validate.validate_compliance_report_access(compliance_report)
    await validate.validate_compliance_report_id(compliance_report_id, [request_data])

    if request_data.deleted:
        return await service.delete_notional_transfer(request_data)
    else:
        # Validate for duplicates before creating or updating
        await validate.validate_no_duplicates(request_data)

        if notional_transfer_id:
            return await service.update_notional_transfer(request_data)
        else:
            return await service.create_notional_transfer(request_data)
