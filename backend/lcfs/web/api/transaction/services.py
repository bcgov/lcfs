# transactions/services.py

from typing import List, Dict, Any
from fastapi import Depends

from .repo import TransactionsRepository  # Adjust import path as needed
from lcfs.web.core.decorators import service_handler
from lcfs.db.models import Transfer, TransferStatus
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    apply_filter_conditions,
    get_field_for_filter,
    validate_pagination,
)

class TransactionsService:
    def __init__(self, transactions_repo: TransactionsRepository = Depends()):
        self.transactions_repo = transactions_repo

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
            filter_value = filter.filter
            filter_option = filter.type
            filter_type = filter.filterType
            if filter.field == "status":
                field = get_field_for_filter(TransferStatus, "status")
                # field = get_field_for_filter(TransferStatus, "status")
                # TODO add other transaction type status lookups here
            else:
                field = get_field_for_filter(Transfer, filter.field)

            conditions.append(
                apply_filter_conditions(
                    field, filter_value, filter_option, filter_type)
            )

    @service_handler
    async def get_combined_transactions_paginated(self, pagination: PaginationRequestSchema = {}) -> Dict[str, Any]:
        """
        Fetches a combined paginated list of Transfers and Issuances, ordered by create_date.
        Returns a structured response that includes the paginated list and pagination details.
        """
        # Apply filters
        conditions = []
        pagination = validate_pagination(pagination)
        if pagination.filters and len(pagination.filters) > 0:
            try:
                self.apply_transaction_filters(pagination, conditions)
            except Exception:
                raise ValueError(
                    f"Invalid filter provided: {pagination.filters}."
                )

        # Apply pagination
        offset = (
            0 if (pagination.page < 1) else (
                pagination.page - 1) * pagination.size
        )
        limit = pagination.size
        combined_transactions = await self.transactions_repo.get_combined_transactions_paginated()
        
        # Example post-processing to fit a common schema or structure
        processed_transactions = [
            {
                "type": transaction[0],  # 'Transfer' or 'Issuance'
                "id": transaction[1],
                "create_date": transaction[2].isoformat()  # Assuming create_date is a datetime object
            } for transaction in combined_transactions
        ]
        
        # Assuming you have a way to calculate total count for accurate pagination.
        # This might require an additional repository method or a different approach.
        total_count = len(processed_transactions)  # Placeholder for total count calculation
        
        # Construct and return the paginated response
        return {
            "transactions": processed_transactions,
            "pagination": {
                "total": total_count,
                "page": page,
                "size": size,
                "total_pages": (total_count // size) + (1 if total_count % size > 0 else 0),
            }
        }
