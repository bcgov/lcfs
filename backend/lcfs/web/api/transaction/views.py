import math
from typing import List
from logging import getLogger
from fastapi import APIRouter, Depends, status, Request, Body
from fastapi_cache.decorator import cache
from lcfs.web.core.decorators import roles_required, view_handler
from lcfs.web.api.transaction.services import TransactionsService
from lcfs.web.api.transaction.schema import TransactionListSchema, TransactionStatusSchema
from lcfs.web.api.base import PaginationRequestSchema

logger = getLogger("transaction")

router = APIRouter()


@router.post("/", response_model=TransactionListSchema, status_code=status.HTTP_200_OK)
@roles_required("Government")
@view_handler
async def get_transactions_paginated(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: TransactionsService = Depends(),
):
    """
    Fetches a combined list of Issuances and Transfers, sorted by create_date, with pagination.
    """
    return await service.get_transactions_paginated(pagination)


@router.get(
    "/statuses/",
    response_model=List[TransactionStatusSchema],
    status_code=status.HTTP_200_OK,
)
@cache(expire=60 * 60 * 24)  # cache for 24 hours
@view_handler
async def get_transaction_statuses(
    service: TransactionsService = Depends()
) -> List[TransactionStatusSchema]:
    '''Fetch all transaction statuses'''
    return await service.get_transaction_statuses()
