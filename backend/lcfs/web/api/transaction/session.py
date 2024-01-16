from logging import getLogger
from typing import List
from datetime import datetime
import io

from fastapi import Depends, Request
from sqlalchemy import func, select, distinct
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.api.organization.schema import (
    OrganizationBase,
)
from lcfs.web.api.base import (
    PaginationRequestSchema,
)

from lcfs.db.models.Transaction import Transaction

from lcfs.db.models.TransferHistory import TransferHistory
from lcfs.db.models.IssuanceHistory import IssuanceHistory

from fastapi.responses import StreamingResponse
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder

logger = getLogger("transaction_repo")


class TransactionRepo:
    def __init__(
        self,
        session: AsyncSession = Depends(get_async_db_session),
        request: Request = None,
    ) -> None:
        self.session = session
        self.request = request

    async def get_transactions(
        self, pagination: PaginationRequestSchema = {}
    ) -> List[OrganizationBase]:
        """
        Get all organizations based on the provided filters and pagination.
        This method returns a list of OrganizationBase objects.
        The OrganizationBase objects contain the basic organization details,
        including the organization type, organization status, and other relevant fields.
        The pagination object is used to control the number of results returned
        and the page number.
        The filters object is used to filter the results based on specific criteria.
        The OrganizationBase objects are returned in the order specified by the sortOrders object.
        The total_count field is used to return the total number of organizations that match the filters.
        The OrganizationBase objects are returned in the order specified by the sortOrders object.

        Args:
            pagination (PaginationRequestSchema, optional): The pagination object containing page and size information. Defaults to {}.

        Returns:
            List[OrganizationBase]: A list of OrganizationBase objects containing the basic organization details.
            The total_count field is used to return the total number of organizations that match the filters.
            The OrganizationBase objects are returned in the order specified by the sortOrders object.

        Raises:
            Exception: If any errors occur during the query execution.
            ValueError: If the provided pagination object is invalid.
        """
        try:
            offset = 0 if (pagination.page < 1) else (
                pagination.page - 1) * pagination.size
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
            count_query = await self.session.execute(
                select(func.count(distinct(Transaction.transaction_id)))
            )

            total_count = count_query.unique().scalar_one_or_none()

            transaction_results = await self.session.execute(query.offset(offset).limit(limit))

            results = transaction_results.scalars().unique().all()

            return [
                Transaction.model_validate(transaction) for transaction in results
            ], total_count

        except Exception as e:
            logger.error(f"Error occurred while fetching transactions: {e}")
            raise Exception(f"Error occurred while fetching transactions")

    async def export_transactions(
            self
    ):
        try:
            export_format = "xls"
            media_type = "application/vnd.ms-excel"

            # Fetch all organizations from the database
            result = await self.session.execute(
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
            headers = {
                "Content-Disposition": f'attachment; filename="{filename}"'}

            return StreamingResponse(
                io.BytesIO(file_content), media_type=media_type, headers=headers
            )
        except Exception as e:
            logger.error(f"Error occurred while exporting transactions: {e}")
            raise Exception(f"Error occurred while exporting transactions")
