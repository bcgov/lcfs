import structlog
from typing import List

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, cast, String

from lcfs.utils.constants import id_prefix_to_transaction_type_map
from lcfs.web.api.user.repo import UserRepository
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.base import (
    calculate_total_pages,
    FilterModel,
    PaginationRequestSchema,
    PaginationResponseSchema,
    PaginatedQueryBuilder,
    apply_filter_conditions,
    get_field_for_filter,
    validate_pagination,
)
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.models.transaction.TransactionView import TransactionView
from lcfs.web.api.transaction.schema import TransactionViewSchema
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.user.schema import UsersSchema

logger = structlog.get_logger(__name__)


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
        builder = PaginatedQueryBuilder(
            TransactionView,
            custom_filters={"transaction_id": self._transaction_id_filter},
            default_filter=self._generic_transaction_filter,
        )
        conditions.extend(builder.build_conditions(pagination.filters))

    @staticmethod
    def _transaction_id_filter(filter_model):
        filter_value = filter_model.filter.upper()
        for prefix, transaction_type in id_prefix_to_transaction_type_map.items():
            if filter_value.startswith(prefix):
                numeric_part = filter_value[len(prefix) :]
                if not numeric_part:
                    return TransactionView.transaction_type == transaction_type
                if numeric_part.isdigit():
                    return and_(
                        TransactionView.transaction_type == transaction_type,
                        TransactionView.transaction_id == int(numeric_part),
                    )
                return False  # invalid numeric part, never matches
        if filter_value.isdigit():
            return TransactionView.transaction_id == int(filter_value)
        return False  # invalid input, never matches

    @staticmethod
    def _generic_transaction_filter(filter_model):
        field = get_field_for_filter(TransactionView, filter_model.field)

        if filter_model.filter_type == "date":
            if filter_model.type == "inRange":
                start = filter_model.date_from
                end = filter_model.date_to
                if not start and not end:
                    logger.info(
                        "Skipping date range filter with no values",
                        field=filter_model.field,
                    )
                    return None
                filter_value = [v for v in (start, end) if v]
            else:
                if not filter_model.date_from:
                    logger.info(
                        "Skipping date filter with no value", field=filter_model.field
                    )
                    return None
                filter_value = filter_model.date_from
        else:
            filter_value = filter_model.filter

        if not filter_value and filter_value != 0:
            logger.info(
                "Skipping filter due to empty value",
                field=filter_model.field,
                filter_type=filter_model.filter_type,
            )
            return None

        filter_type = filter_model.filter_type
        filter_option = filter_model.type

        if field.description == "transaction_type":
            if not isinstance(filter_value, str):
                logger.info(
                    "Skipping transaction_type filter with non-string value",
                    value=filter_value,
                )
                return None
            filter_value = filter_value.replace(" ", "").lower()
        elif filter_model.field == "status":
            field = cast(get_field_for_filter(TransactionView, "status"), String)
            if isinstance(filter_value, str) and "," in filter_value:
                filter_value = filter_value.split(",")
            if isinstance(filter_value, list):
                filter_type = "set"
                filter_option = "set"
                if not filter_value:
                    logger.info("Skipping status filter with empty values list")
                    return None

        if filter_type == "set" and (
            filter_value is None
            or (isinstance(filter_value, (list, tuple, set)) and not filter_value)
        ):
            logger.info(
                "Skipping set filter due to empty values", field=filter_model.field
            )
            return None

        return apply_filter_conditions(field, filter_value, filter_option, filter_type)

    @service_handler
    async def get_organization_users_list(
        self, organization_id: int, status: str, pagination: PaginationRequestSchema
    ) -> UsersSchema:
        """
        Get all users for the organization
        """
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
                total_pages=calculate_total_pages(total_count, pagination.size),
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

        return {
            "transactions": [
                TransactionViewSchema.model_validate(transaction)
                for transaction in transactions
            ],
            "pagination": PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=calculate_total_pages(total_count, pagination.size),
            ),
        }
