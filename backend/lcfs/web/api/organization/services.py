import math
from logging import getLogger
from typing import List

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.web.api.user.repo import UserRepository
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.base import (
    FilterModel,
    PaginationRequestSchema,
    PaginationResponseSchema,
    apply_filter_conditions,
    get_field_for_filter,
    validate_pagination,
)
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.models.transaction.TransactionView import TransactionView
from lcfs.web.api.transaction.schema import TransactionViewSchema
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.user.schema import UsersSchema

logger = getLogger("organization_services")


class OrganizationService:
    def __init__(
        self,
        request: Request = None,
        user_repo: UserRepository = Depends(UserRepository),
        transaction_repo: TransactionRepository = Depends(TransactionRepository),
        session: AsyncSession = Depends(get_async_db_session),
    ) -> None:
        self.transaction_repo = transaction_repo
        self.user_repo = user_repo
        self.request = request
        self.session = session

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
                apply_filter_conditions(field, filter_value, filter_option, filter_type)
            )

    @service_handler
    async def get_organization_users_list(
        self, organization_id: int, status: str, pagination: PaginationRequestSchema
    ) -> UsersSchema:
        """
        Get all users for the organization
        """
        # Add Organization and status to filter
        if (pagination.filters is None) or (len(pagination.filters) == 0):
            pagination.filters.append(
                FilterModel(
                    filter_type="text", field="is_active", type="equals", filter=status
                )
            )
        pagination.filters.append(
            FilterModel(
                filter_type="number",
                field="organization_id",
                type="equals",
                filter=organization_id,
            )
        )
        users, total_count = await self.user_repo.get_users_paginated(
            pagination=pagination
        )
        return UsersSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            users=users,
        )

    @service_handler
    async def get_transactions_paginated(
        self, pagination: PaginationRequestSchema = {}, organization_id: int = None
    ) -> List[TransactionViewSchema]:
        """
        Fetch transactions with filters, sorting, and pagination.
        """
        conditions = []
        pagination = validate_pagination(pagination)
        if pagination.filters and len(pagination.filters) > 0:
            self.apply_transaction_filters(pagination, conditions)

        offset = (pagination.page - 1) * pagination.size if pagination.page > 0 else 0
        limit = pagination.size

        transactions, total_count = (
            await self.transaction_repo.get_transactions_paginated(
                offset, limit, conditions, pagination.sort_orders, organization_id
            )
        )

        if not transactions:
            raise DataNotFoundException("Transactions not found")

        return {
            "transactions": [
                TransactionViewSchema.model_validate(transaction)
                for transaction in transactions
            ],
            "pagination": PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
        }
