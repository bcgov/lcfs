from typing import List
import structlog
from fastapi import APIRouter, Depends, status, Request, Body, Query
from fastapi.responses import StreamingResponse
from fastapi_cache.decorator import cache
from lcfs.web.core.decorators import view_handler
from lcfs.web.api.transaction.services import TransactionsService
from lcfs.web.api.transaction.schema import (
    TransactionListSchema,
    TransactionStatusSchema,
)
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.db.models.user.Role import RoleEnum

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.post(
    "/{organization_id}",
    response_model=TransactionListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def get_transactions_paginated_by_org(
    request: Request,
    organization_id: int = None,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: TransactionsService = Depends(),
):
    """
    Fetches a combined list of Issuances and Transfers for a specific organization, sorted by create_date, with pagination.
    """
    return await service.get_transactions_paginated(pagination, organization_id)


@router.get(
    "/{organization_id}/export",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def export_transactions_by_org(
    request: Request,
    organization_id: int = None,
    format: str = Query(default="xlsx", description="File export format"),
    service: TransactionsService = Depends(),
):
    """
    Endpoint to export information of all transactions for a specific organization
    """
    return await service.export_transactions(format, organization_id)


@router.post("/", response_model=TransactionListSchema, status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.GOVERNMENT])
async def get_transactions_paginated(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: TransactionsService = Depends(),
):
    """
    Fetches a combined list of Issuances and Transfers, sorted by create_date, with pagination.
    """
    return await service.get_transactions_paginated(pagination)


@router.get("/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.GOVERNMENT])
async def export_transactions(
    request: Request,
    format: str = Query(default="xlsx", description="File export format"),
    service: TransactionsService = Depends(),
):
    """
    Endpoint to export information of all transactions
    """
    return await service.export_transactions(format)


@router.get(
    "/statuses/",
    response_model=List[TransactionStatusSchema],
    status_code=status.HTTP_200_OK,
)
@cache(expire=60 * 60 * 24)  # cache for 24 hours
@view_handler(["*"])
async def get_transaction_statuses(
    request: Request, service: TransactionsService = Depends()
) -> List[TransactionStatusSchema]:
    """Fetch all transaction statuses"""
    return await service.get_transaction_statuses()
