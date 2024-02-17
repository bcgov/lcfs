import math
from logging import getLogger
from fastapi import APIRouter, Depends, status, Request, Body
from lcfs.web.core.decorators import view_handler
from lcfs.web.api.transaction.services import TransactionsService
from lcfs.web.api.transaction.schema import TransactionListSchema
from lcfs.web.api.base import PaginationRequestSchema

logger = getLogger("transaction")

router = APIRouter()


@router.get("/", response_model=TransactionListSchema, status_code=status.HTTP_200_OK)
@view_handler
async def get_transactions(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: TransactionsService = Depends(),
):
    """
    Fetches a combined list of Issuances and Transfers, sorted by create_date, with pagination.
    """
    return await service.get_combined_transactions_paginated(pagination)



# @router.get("/transactions", status_code=status.HTTP_200_OK)
# @view_handler
# async def get_transactions(
#     page: int = 1,
#     size: int = 10,
#     issuance_service: IssuanceServices = Depends(),
#     transfer_service: TransferServices = Depends(),
# ):
#     """
#     Fetches a combined list of Issuances and Transfers, sorted by create_date.
#     Applies pagination to the combined list.
#     """
#     # Fetch lists - In a real scenario, you'd adjust this to fetch based on pagination params
#     issuances = await issuance_service.get_all_issuances()
#     transfers = await transfer_service.get_all_transfers()

#     # Combine and sort - Assuming both schemas have a 'create_date' or similar field
#     combined = sorted(issuances + transfers, key=lambda x: x.create_date, reverse=True)

#     # Apply pagination
#     start = (page - 1) * size
#     end = start + size
#     paginated_combined = combined[start:end]

#     total_count = len(combined)
#     total_pages = ceil(total_count / size)

#     # Construct and return the paginated response
#     return {
#         "transactions": paginated_combined,
#         "pagination": {
#             "total": total_count,
#             "page": page,
#             "size": size,
#             "total_pages": total_pages,
#         }
#     }

# @router.get("/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK)
# @roles_required("Government")
# async def export_organizations(db: AsyncSession = Depends(get_async_db), repo: TransactionRepo = Depends(),):
#     """
#     Endpoint to export information of transactions

#     This endpoint can support exporting data in different file formats (xls, xlsx, csv)
#     as specified by the 'export_format' and 'media_type' variables.
#     - 'export_format' specifies the file format: options are 'xls', 'xlsx', and 'csv'.
#     - 'media_type' sets the appropriate MIME type based on 'export_format':
#         'application/vnd.ms-excel' for 'xls',
#         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' for 'xlsx',
#         'text/csv' for 'csv'.

#     The SpreadsheetBuilder class is used for building the spreadsheet.
#     It allows adding multiple sheets with custom styling options and exports them as a byte stream.
#     Also, an example of how to use the SpreadsheetBuilder is provided in its class documentation.

#     Note: Only the first sheet data is used for the CSV format,
#         as CSV files do not support multiple sheets.
#     """

#     try:
#         return await repo.export_transactions()

#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="Internal Server Error",
#         ) from e
