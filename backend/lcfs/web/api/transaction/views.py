import math
import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, distinct
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response
from lcfs.db import dependencies
from lcfs.db.models.Transaction import Transaction
from lcfs.db.models.IssuanceHistory import IssuanceHistory
from lcfs.db.models.TransferHistory import TransferHistory
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.transaction.schema import Transactions
from lcfs.web.core.decorators import roles_required
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder

router = APIRouter()
get_async_db = dependencies.get_async_db_session


@router.get("/", status_code=status.HTTP_200_OK, response_model=Transactions)
async def get_all_transactions(
    db: AsyncSession = Depends(get_async_db),
    pagination: PaginationRequestSchema = Body(..., embed=False),
    response: Response = None,
):
    try:
        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
        limit = pagination.size

        query = select(Transaction).options(
            joinedload(Transaction.issuance_history_record).options(
                joinedload(IssuanceHistory.organization),
                joinedload(IssuanceHistory.issuance_status),
            ),
            joinedload(Transaction.transfer_history_record).options(
                joinedload(TransferHistory.to_organization),
                joinedload(TransferHistory.from_organization),
                joinedload(TransferHistory.transfer_status),
            ),
            joinedload(Transaction.transaction_type),
        )
        count_query = await db.execute(
            select(func.count(distinct(Transaction.transaction_id)))
        )

        total_count = count_query.unique().scalar_one_or_none()

        transaction_results = await db.execute(query.offset(offset).limit(limit))
        results = transaction_results.scalars().unique().all()

        transactions = [
            Transaction.model_validate(transaction) for transaction in results
        ]

        if len(transactions) == 0:
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
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        raise HTTPException(
            status_code=500,
            detail=f"Technical Error: Failed to get transactions: {str(e)}",
        )


@router.get("/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK)
@roles_required("Government")
async def export_organizations(db: AsyncSession = Depends(get_async_db)):
    export_format = "xls"
    media_type = "application/vnd.ms-excel"

    try:
        # Fetch all organizations from the database
        result = await db.execute(
            select(Transaction)
            .options(joinedload(Transaction.transaction_type))
            .order_by(Transaction.transaction_id)
        )
        transactions = result.scalars().all()

        # Prepare data for the spreadsheet
        data = [
            [
                transaction.transaction_id,
                123,
                transaction.transaction_type.status.value,
            ]
            for transaction in transactions
        ]

        # Create a spreadsheet
        builder = SpreadsheetBuilder(file_format=export_format)

        builder.add_sheet(
            sheet_name="Transactions",
            columns=[
                "ID",
                "Compliance Units",
                "Status",
            ],
            rows=data,
            styles={"bold_headers": True},
        )

        file_content = builder.build_spreadsheet()

        # Get the current date in YYYY-MM-DD format
        current_date = datetime.now().strftime("%Y-%m-%d")

        filename = f"BC-LCFS-transactions-{current_date}.{export_format}"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            io.BytesIO(file_content), media_type=media_type, headers=headers
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error",
        ) from e
