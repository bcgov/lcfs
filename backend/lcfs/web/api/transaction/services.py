# transactions/services.py

from typing import List, Dict, Any
from fastapi import Depends
from math import ceil
from sqlalchemy import or_

from .repo import TransactionRepository  # Adjust import path as needed
from lcfs.web.core.decorators import service_handler
from lcfs.db.models.TransactionView import TransactionView
from lcfs.web.api.transaction.schema import TransactionStatusSchema, TransactionViewSchema
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.api.base import (
    FilterModel,
    PaginationRequestSchema,
    PaginationResponseSchema,
    apply_filter_conditions,
    get_field_for_filter,
    validate_pagination,
)

class TransactionsService:
    def __init__(
        self, 
        repo: TransactionRepository = Depends(TransactionRepository)
    ) -> None:
        self.repo = repo

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
            filter_type = filter.filter_type
            field = get_field_for_filter(TransactionView, filter.field)

            conditions.append(
                apply_filter_conditions(
                    field, filter_value, filter_option, filter_type)
            )

    @service_handler
    async def get_transactions_paginated(self, pagination: PaginationRequestSchema = {}, organization_id: int = None) -> List[TransactionViewSchema]:
        """
        Fetch transactions with filters, sorting, and pagination.
        """
        pagination.filters.append(FilterModel(field="status", filter="Deleted", type="notEqual", filter_type="text"))
        conditions = []
        pagination = validate_pagination(pagination)
        if pagination.filters and len(pagination.filters) > 0:
            self.apply_transaction_filters(pagination, conditions)

        offset = (pagination.page - 1) * pagination.size if pagination.page > 0 else 0
        limit = pagination.size

        if organization_id:
            org_conditions = or_(
                TransactionView.from_organization_id == organization_id,
                TransactionView.to_organization_id == organization_id
            )
            conditions.append(org_conditions)

        transactions, total_count = await self.repo.get_transactions_paginated(offset, limit, conditions, pagination.sort_orders)

        if not transactions:
            raise DataNotFoundException('Transactions not found')

        return {
            "transactions": [TransactionViewSchema.model_validate(transaction) for transaction in transactions],
            "pagination": PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=ceil(total_count / pagination.size),
            )
        }

    @service_handler
    async def get_transaction_statuses(self) -> List[TransactionStatusSchema]:
        '''handles fetching all transaction statuses'''
        results = await self.repo.get_transaction_statuses()
        statuses = [TransactionStatusSchema.model_validate(status) for status in results]

        if len(statuses) == 0:
            raise DataNotFoundException("No transaction statuses found")

        return statuses
