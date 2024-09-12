"""
Other Uses endpoints
"""

from logging import getLogger
from typing import List, Optional, Union

from fastapi import (
    APIRouter,
    Body,
    status,
    Request,
    Response,
    Depends,
)
from fastapi_cache.decorator import cache

from lcfs.db import dependencies
from lcfs.web.core.decorators import view_handler
from lcfs.web.api.other_uses.services import OtherUsesServices
from lcfs.web.api.other_uses.schema import (
    OtherUsesCreateSchema,
    OtherUsesSchema,
    OtherUsesListSchema,
    OtherUsesTableOptionsSchema,
    ComplianceReportRequestSchema,
    DeleteOtherUsesResponseSchema,
    PaginatedOtherUsesRequestSchema,
    OtherUsesListSchema,
    OtherUsesAllSchema,
)
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.other_uses.validation import OtherUsesValidation
from lcfs.db.models.user.Role import RoleEnum

router = APIRouter()
logger = getLogger("other_uses_view")
get_async_db = dependencies.get_async_db_session


@router.get(
    "/table-options",
    response_model=OtherUsesTableOptionsSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
# @cache(expire=60 * 60 * 24)  # cache for 24 hours
async def get_table_options(
    request: Request,
    service: OtherUsesServices = Depends(),
):
    """Endpoint to retrieve table options related to other uses"""
    return await service.get_table_options()


@router.post(
    "/list-all", response_model=OtherUsesAllSchema, status_code=status.HTTP_200_OK
)
@view_handler(["*"])
async def get_other_uses(
    request: Request,
    request_data: ComplianceReportRequestSchema = Body(...),
    response: Response = None,
    service: OtherUsesServices = Depends(),
):
    """Endpoint to get list of other uses for a compliance report"""
    return await service.get_other_uses(request_data.compliance_report_id)


@router.post(
    "/list",
    response_model=OtherUsesListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_other_uses_paginated(
    request: Request,
    request_data: PaginatedOtherUsesRequestSchema = Body(...),
    service: OtherUsesServices = Depends(),
) -> OtherUsesListSchema:
    pagination = PaginationRequestSchema(
        page=request_data.page,
        size=request_data.size,
        sort_orders=request_data.sort_orders,
        filters=request_data.filters,
    )
    compliance_report_id = request_data.compliance_report_id
    return await service.get_other_uses_paginated(pagination, compliance_report_id)


@router.post(
    "/save",
    response_model=Union[OtherUsesSchema, DeleteOtherUsesResponseSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER])
async def save_other_uses_row(
    request: Request,
    request_data: OtherUsesCreateSchema = Body(...),
    service: OtherUsesServices = Depends(),
    validate: OtherUsesValidation = Depends(),
):
    """Endpoint to save a single other uses row"""
    compliance_report_id = request_data.compliance_report_id
    other_uses_id: Optional[int] = request_data.other_uses_id

    await validate.validate_organization_access(compliance_report_id)

    if request_data.deleted:
        # Delete existing other use
        await validate.validate_compliance_report_id(
            compliance_report_id, [request_data]
        )
        await service.delete_other_use(other_uses_id)
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
