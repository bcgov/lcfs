"""
Notional Transfers endpoints
"""

from logging import getLogger
from typing import List

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
from lcfs.web.core.decorators import roles_required, view_handler
from lcfs.web.api.notional_transfer.services import NotionalTransferServices
from lcfs.web.api.notional_transfer.schema import (
    NotionalTransferCreateSchema,
    NotionalTransferSchema,
    NotionalTransfersSchema,
    NotionalTransferTableOptionsSchema,
    NotionalTransferListCreateSchema,
    ComplianceReportRequestSchema
)
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.notional_transfer.validation import NotionalTransferValidation

router = APIRouter()
logger = getLogger("notional_transfer_view")
get_async_db = dependencies.get_async_db_session


@router.get(
    "/table-options", response_model=NotionalTransferTableOptionsSchema, status_code=status.HTTP_200_OK
)
@view_handler
@cache(expire=60 * 60 * 24)  # cache for 24 hours
async def get_table_options(
    request: Request,
    service: NotionalTransferServices = Depends(),
):
    """Endpoint to retrieve table options related to notional transfers"""
    return await service.get_table_options()


@router.post("/list", response_model=NotionalTransfersSchema, status_code=status.HTTP_200_OK)
@view_handler
async def get_notional_transfers(
    request: Request,
    request_data: ComplianceReportRequestSchema = Body(...),
    response: Response = None,
    service: NotionalTransferServices = Depends(),
):
    """Endpoint to get list of notional transfers for a compliance report"""
    return await service.get_notional_transfers(request_data.compliance_report_id)


@router.get("/{notional_transfer_id}", status_code=status.HTTP_200_OK)
@view_handler
async def get_notional_transfer(
    request: Request,
    notional_transfer_id: int,
    service: NotionalTransferServices = Depends(),
) -> NotionalTransferSchema:
    return await service.get_notional_transfer(notional_transfer_id)


@router.post(
    "/save-notional-transfers",
    response_model=str,
    status_code=status.HTTP_201_CREATED,
)
@roles_required("Supplier")
@view_handler
async def save_notional_transfers(
    request: Request,
    request_data: NotionalTransferListCreateSchema = Body(...),
    service: NotionalTransferServices = Depends(),
    validate: NotionalTransferValidation = Depends(),
) -> str:
    """Endpoint to save notional transfers"""
    compliance_report_id = request_data.compliance_report_id
    notional_transfers = request_data.notional_transfers
    await validate.validate_organization_access(compliance_report_id)
    await validate.validate_compliance_report_id(compliance_report_id, notional_transfers)
    return await service.save_notional_transfers(notional_transfers)


@router.put("/{notional_transfer_id}", status_code=status.HTTP_200_OK)
@roles_required("Supplier")
@view_handler
async def update_notional_transfer(
    request: Request,
    notional_transfer_id: int,
    compliance_report_id: int,
    notional_transfer_data: NotionalTransferCreateSchema,
    service: NotionalTransferServices = Depends(),
    validate: NotionalTransferValidation = Depends(),
):
    await validate.validate_organization_access(compliance_report_id)
    return await service.update_notional_transfer(notional_transfer_id, notional_transfer_data)


@router.delete("/{notional_transfer_id}", status_code=status.HTTP_200_OK)
@roles_required("Supplier")
@view_handler
async def delete_notional_transfer(
    request: Request,
    notional_transfer_id: int,
    compliance_report_id: int,
    service: NotionalTransferServices = Depends(),
    validate: NotionalTransferValidation = Depends(),
):
    await validate.validate_organization_access(compliance_report_id)
    return await service.delete_notional_transfer(notional_transfer_id)
