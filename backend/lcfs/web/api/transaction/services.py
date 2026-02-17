import io
import logging
import zoneinfo
from datetime import datetime, timezone
from typing import List, Dict, Union
from fastapi import Depends
from fastapi.responses import StreamingResponse
from math import ceil
from lcfs.db.models.transaction.Transaction import Transaction
from sqlalchemy import or_, and_, cast, String
from .repo import TransactionRepository
from lcfs.web.core.decorators import service_handler
from lcfs.db.models.transaction.TransactionView import (
    TransactionView,
)
from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.web.api.transaction.schema import (
    TransactionStatusSchema,
    TransactionViewSchema,
)
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.api.base import (
    FilterModel,
    SortOrder,
    PaginationRequestSchema,
    PaginationResponseSchema,
    apply_filter_conditions,
    get_field_for_filter,
    validate_pagination,
)
from lcfs.utils.constants import (
    LCFS_Constants,
    FILE_MEDIA_TYPE,
    transaction_type_to_id_prefix_map,
    id_prefix_to_transaction_type_map,
)
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder


logger = logging.getLogger(__name__)


class TransactionsService:
    def __init__(
        self, repo: TransactionRepository = Depends(TransactionRepository)
    ) -> None:
        self.repo = repo

    @staticmethod
    def _to_pacific(dt):
        """Convert a naive-UTC or aware datetime to America/Vancouver."""
        pacific = zoneinfo.ZoneInfo("America/Vancouver")
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(pacific)

    def apply_transaction_filters(self, pagination, conditions):
        """
        Apply filters to the transactions query.

        Args:
            pagination (PaginationRequestSchema): The pagination object containing page and size information.
            conditions (List[Condition]): The list of conditions to apply.

        Returns:
            List[Transactions]: The list of transactions after applying the filters.
        """

        for filter in pagination.filters:
            if filter.field == "transaction_id":
                filter_value = filter.filter.upper()
                for (
                    prefix,
                    transaction_type,
                ) in id_prefix_to_transaction_type_map.items():
                    if filter_value.startswith(prefix):
                        numeric_part = filter_value[len(prefix) :]
                        if numeric_part:
                            if numeric_part.isdigit():
                                conditions.append(
                                    and_(
                                        TransactionView.transaction_type
                                        == transaction_type,
                                        TransactionView.transaction_id
                                        == int(numeric_part),
                                    )
                                )
                        else:
                            # Only prefix provided, filter by transaction type only
                            conditions.append(
                                TransactionView.transaction_type == transaction_type
                            )
                        break
                else:
                    # If no prefix matches, treat the whole value as a potential transaction_id
                    if filter_value.isdigit():
                        conditions.append(
                            TransactionView.transaction_id == int(filter_value)
                        )
            else:
                # Handle other filters
                field = get_field_for_filter(TransactionView, filter.field)
                filter_value = filter.filter
                # check if the date string is selected for filter
                if filter.filter is None:
                    if not filter.date_from and not filter.date_to:
                        continue

                    filter_value = []
                    if filter.date_from:
                        filter_value.append(
                            datetime.strptime(
                                filter.date_from, "%Y-%m-%d %H:%M:%S"
                            ).strftime("%Y-%m-%d")
                        )
                    if filter.date_to:
                        filter_value.append(
                            datetime.strptime(
                                filter.date_to, "%Y-%m-%d %H:%M:%S"
                            ).strftime("%Y-%m-%d")
                        )
                if filter.field == "status":
                    field = cast(
                        get_field_for_filter(TransactionView, "status"),
                        String,
                    )
                    # Check if filter_value is a comma-separated string
                    if isinstance(filter_value, str) and "," in filter_value:
                        filter_value = filter_value.split(",")  # Convert to list
                    if isinstance(filter_value, list):
                        filter.filter_type = "set"
                conditions.append(
                    apply_filter_conditions(
                        field, filter_value, filter.type, filter.filter_type
                    )
                )

    @service_handler
    async def get_transactions_paginated(
        self, pagination: PaginationRequestSchema = {}, organization_id: int = None
    ) -> Dict[str, Union[List[TransactionViewSchema], PaginationResponseSchema]]:
        """
        Fetch transactions with filters, sorting, and pagination.
        """
        pagination.filters.append(
            FilterModel(
                field="status", filter="Deleted", type="notEqual", filter_type="text"
            )
        )
        conditions = []
        pagination = validate_pagination(pagination)
        if pagination.filters and len(pagination.filters) > 0:
            self.apply_transaction_filters(pagination, conditions)

        offset = (pagination.page - 1) * pagination.size if pagination.page > 0 else 0
        limit = pagination.size

        if organization_id:
            org_conditions = or_(
                TransactionView.from_organization_id == organization_id,
                TransactionView.to_organization_id == organization_id,
            )
            conditions.append(org_conditions)

        transactions, total_count = await self.repo.get_transactions_paginated(
            offset, limit, conditions, pagination.sort_orders, None
        )

        return {
            "transactions": [
                TransactionViewSchema.model_validate(transaction)
                for transaction in transactions
            ],
            "pagination": PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=ceil(total_count / pagination.size),
            ),
        }

    @service_handler
    async def get_transaction_by_id(self, transaction_id: int) -> Transaction:
        """handles fetching a single transaction"""
        return await self.repo.get_transaction_by_id(transaction_id)

    @service_handler
    async def get_transaction_statuses(self) -> List[TransactionStatusSchema]:
        """handles fetching all transaction statuses"""
        results = await self.repo.get_transaction_statuses()
        statuses = [
            TransactionStatusSchema.model_validate(status) for status in results
        ]

        if len(statuses) == 0:
            raise DataNotFoundException("No transaction statuses found")

        return statuses

    @service_handler
    async def export_transactions(
        self,
        export_format: str,
        pagination: PaginationRequestSchema | None = None,
        organization_id: int | None = None,
    ) -> StreamingResponse:
        """
        Prepares a list of transactions in a file that is downloadable
        """
        if not export_format in ["xls", "xlsx", "csv"]:
            raise DataNotFoundException("Export format not supported")

        pagination = pagination or PaginationRequestSchema(
            page=1, size=10000, filters=[], sort_orders=[]
        )

        # Always exclude “Deleted”
        pagination.filters.append(
            FilterModel(
                field="status",
                filter="Deleted",
                type="notEqual",
                filter_type="text",
            )
        )

        conditions: list = []
        if pagination.filters:
            self.apply_transaction_filters(pagination, conditions)

        results = await self.repo.get_transactions_paginated(
            0,
            None,
            conditions,
            [SortOrder(field="update_date", direction="desc")],
            organization_id,
        )

        # Prepare data for the spreadsheet
        data = []
        for result in results[0]:
            # Mask the status if it matches "Recommended"
            masked_status = (
                TransferStatusEnum.Submitted.name
                if result.status == TransferStatusEnum.Recommended.value
                else result.status
            )

            prefix = transaction_type_to_id_prefix_map.get(result.transaction_type)
            if not prefix:
                logger.warning(
                    "No prefix configured for transaction type '%s'; using fallback",
                    result.transaction_type,
                )
                prefix = (
                    result.transaction_type[:2].upper()
                    if result.transaction_type
                    else "NA"
                )

            row_data = None
            try:
                row_data = [
                    f"{prefix}{result.transaction_id}",
                    result.compliance_period,
                    result.transaction_type,
                    result.from_organization,
                    result.to_organization,
                    result.quantity,
                    result.price_per_unit,
                    result.category,
                    masked_status,
                    (
                        result.transaction_effective_date.strftime("%Y-%m-%d")
                        if result.transaction_effective_date
                        else None
                    ),
                    (
                        self._to_pacific(result.recorded_date).strftime("%Y-%m-%d")
                        if result.recorded_date
                        else None
                    ),
                    (
                        self._to_pacific(result.approved_date).strftime("%Y-%m-%d")
                        if result.approved_date
                        else None
                    ),
                    result.from_org_comment,
                    result.to_org_comment,
                    result.government_comment,
                ]
                data.append(row_data)
            except Exception as exc:
                logger.error(
                    "Failed to append transaction %s to export data: %s | data=%s",
                    result.transaction_id,
                    exc,
                    row_data if row_data is not None else vars(result),
                )
                continue

        # Create a spreadsheet
        builder = SpreadsheetBuilder(file_format=export_format)

        builder.add_sheet(
            sheet_name=LCFS_Constants.TRANSACTIONS_EXPORT_SHEETNAME,
            columns=LCFS_Constants.TRANSACTIONS_EXPORT_COLUMNS,
            rows=data,
            styles={"bold_headers": True},
        )

        file_content = builder.build_spreadsheet()

        # Get the current date in YYYY-MM-DD format
        current_date = datetime.now().strftime("%Y-%m-%d")

        filename = f"{LCFS_Constants.TRANSACTIONS_EXPORT_FILENAME}-{current_date}.{export_format}"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=FILE_MEDIA_TYPE[export_format.upper()].value,
            headers=headers,
        )
