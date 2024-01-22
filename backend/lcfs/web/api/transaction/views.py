import math
from logging import getLogger
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response
from lcfs.db import dependencies
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.transaction.schema import Transactions
from lcfs.web.core.decorators import roles_required
from lcfs.web.api.transaction.session import TransactionRepo

logger = getLogger("transaction")

router = APIRouter()
get_async_db = dependencies.get_async_db_session


@router.post("/", status_code=status.HTTP_200_OK, response_model=Transactions)
async def get_all_transactions(
    pagination: PaginationRequestSchema = Body(..., embed=False),
    response: Response = None,
    repo: TransactionRepo = Depends(),
):
    """
    Endpoint to get all transactions along with the 'from' and 'to' organization data.
    This will return paginated data.
    """
    try:

        transactions, total_count = await repo.get_transactions(pagination)

        if not transactions:
            logger.error("Error getting transactions")
            response.status_code = status.HTTP_404_NOT_FOUND
            return Transactions(
                pagination=PaginationResponseSchema(
                    total=0, page=0, size=0, total_pages=0
                ),
                transactions=transactions,
            )
        return Transactions(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            transactions=transactions,
        )

    except Exception as e:
        logger.error(f"Error getting transactions: {str(e)}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        raise HTTPException(
            status_code=500,
            detail=f"Technical Error: Failed to get transactions: {str(e)}",
        )


@router.get("/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK)
@roles_required("Government")
async def export_organizations(db: AsyncSession = Depends(get_async_db), repo: TransactionRepo = Depends(),):
    """
    Endpoint to export information of transactions

    This endpoint can support exporting data in different file formats (xls, xlsx, csv)
    as specified by the 'export_format' and 'media_type' variables.
    - 'export_format' specifies the file format: options are 'xls', 'xlsx', and 'csv'.
    - 'media_type' sets the appropriate MIME type based on 'export_format':
        'application/vnd.ms-excel' for 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' for 'xlsx',
        'text/csv' for 'csv'.

    The SpreadsheetBuilder class is used for building the spreadsheet.
    It allows adding multiple sheets with custom styling options and exports them as a byte stream.
    Also, an example of how to use the SpreadsheetBuilder is provided in its class documentation.

    Note: Only the first sheet data is used for the CSV format,
        as CSV files do not support multiple sheets.
    """

    try:
        return await repo.export_transactions()

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error",
        ) from e
