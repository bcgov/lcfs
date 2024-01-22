import io
import math
from datetime import datetime
from logging import getLogger
from typing import List
from starlette import status

from fastapi import Depends, Request, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, func, select, asc, desc, distinct
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.api.organization.schema import (
    OrganizationBase,
    OrganizationStatusBase,
    OrganizationTypeBase,
)
from lcfs.db.models.OrganizationStatus import OrganizationStatus
from lcfs.db.models.OrganizationType import OrganizationType
from lcfs.db.models.Organization import Organization
from lcfs.web.api.base import (
    PaginationRequestSchema,
    apply_filter_conditions,
    get_field_for_filter,
    validate_pagination,
)
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder
from lcfs.web.api.transaction.schema import TransactionBase
from lcfs.db.models.Transaction import Transaction
from lcfs.db.models.IssuanceHistory import IssuanceHistory
from lcfs.db.models.TransferHistory import TransferHistory
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema

logger = getLogger("organization_repo")


class OrganizationRepository:
    def __init__(
        self,
        session: AsyncSession = Depends(get_async_db_session),
        request: Request = None,
    ) -> None:
        self.session = session
        self.request = request

    def apply_filters(self, pagination, conditions):
        """
        Apply filters to the query.

        Args:
            pagination (PaginationRequestSchema): The pagination object containing page and size information.
            conditions (List[Condition]): The list of conditions to apply.

        Returns:
            List[Organization]: The list of organizations after applying the filters.
        """
        for filter in pagination.filters:
            filter_value = filter.filter
            filter_option = filter.type
            filter_type = filter.filterType

            if filter.field == "status":
                field = get_field_for_filter(OrganizationStatus, "status")
            else:
                field = get_field_for_filter(Organization, filter.field)

            conditions.append(
                apply_filter_conditions(
                    field, filter_value, filter_option, filter_type)
            )

    async def get_organizations(
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
            # TODO: Implement Redis cache wherever required
            # TODO: Implement Compliance Units and In Reserve fields once the transactions model is created
            # Apply filters
            conditions = []
            pagination = validate_pagination(pagination)
            if pagination.filters and len(pagination.filters) > 0:
                try:
                    self.apply_filters(pagination, conditions)
                except Exception as e:
                    raise ValueError(
                        f"Invalid filter provided: {pagination.filters}."
                    )

            # Apply pagination
            offset = (
                0 if (pagination.page < 1) else (
                    pagination.page - 1) * pagination.size
            )
            limit = pagination.size
            # Build base query
            query = (
                select(Organization)
                .join(
                    OrganizationStatus,
                    Organization.organization_status_id
                    == OrganizationStatus.organization_status_id,
                )
                .options(
                    joinedload(Organization.org_type),
                    joinedload(Organization.org_status),
                )
                .where(and_(*conditions))
            )
            count_query = await self.session.execute(
                select(func.count(distinct(Organization.organization_id)))
                .select_from(Organization)
                .join(
                    OrganizationStatus,
                    Organization.organization_status_id
                    == OrganizationStatus.organization_status_id,
                )
                .where(and_(*conditions))
            )
            total_count = count_query.unique().scalar_one_or_none()
            # Sort the query results
            for order in pagination.sortOrders:
                sort_method = asc if order.direction == "asc" else desc
                query = query.order_by(
                    sort_method(
                        order.field if order.field != "status" else "description"
                    )
                )

            results = await self.session.execute(query.offset(offset).limit(limit))
            organizations = results.scalars().all()

            return [
                OrganizationBase.model_validate(organization)
                for organization in organizations
            ], total_count
        except Exception as e:
            logger.error(
                f"Error occurred while fetching organization transactions: {e}")
            raise Exception(
                f"Error occurred while fetching organization transactions")

    async def get_statuses(self) -> List[OrganizationStatusBase]:
        """
        Get all available statuses for organizations from the database.

        Returns:
            List[OrganizationStatusBase]: A list of OrganizationStatusBase objects containing the basic organization status details.
        """
        try:
            query = select(OrganizationStatus).distinct()
            status_results = await self.session.execute(query)
            results = status_results.scalars().all()
            return [OrganizationStatusBase.model_validate(status) for status in results]
        except Exception as e:
            logger.error(f"Error occurred while fetching statuses: {e}")
            raise Exception(f"Error occurred while fetching statuses")

    async def get_types(self) -> List[OrganizationTypeBase]:
        """
        Get all types for organizations.

        Returns:
            List[OrganizationTypeBase]: A list of OrganizationTypeBase objects containing the basic organization type details.
        """
        try:
            query = select(OrganizationType).distinct()
            types_results = await self.session.execute(query)
            results = types_results.scalars().all()
            return [OrganizationTypeBase.model_validate(types) for types in results]
        except Exception as e:
            logger.error(f"Error occurred while fetching types: {e}")
            raise Exception(f"Error occurred while fetching types")

    async def export_organizations(self) -> StreamingResponse:
        try:
            export_format = "xls"
            media_type = "application/vnd.ms-excel"

            # Fetch all organizations from the database
            result = await self.session.execute(
                select(Organization)
                .options(joinedload(Organization.org_status))
                .order_by(Organization.organization_id)
            )
            organizations = result.scalars().all()

            # Prepare data for the spreadsheet
            data = [
                [
                    organization.organization_id,
                    organization.name,
                    # TODO: Update this section with actual data retrieval
                    # once the Compliance Units models are implemented.
                    123456,
                    123456,
                    organization.org_status.status.value,
                ]
                for organization in organizations
            ]

            # Create a spreadsheet
            builder = SpreadsheetBuilder(file_format=export_format)

            builder.add_sheet(
                sheet_name="Organizations",
                columns=[
                    "ID",
                    "Organization Name",
                    "Compliance Units",
                    "In Reserve",
                    "Registered",
                ],
                rows=data,
                styles={"bold_headers": True},
            )

            file_content = builder.build_spreadsheet()

            # Get the current date in YYYY-MM-DD format
            current_date = datetime.now().strftime("%Y-%m-%d")

            filename = f"BC-LCFS-organizations-{current_date}.{export_format}"
            headers = {
                "Content-Disposition": f'attachment; filename="{filename}"'}

            return StreamingResponse(
                io.BytesIO(file_content), media_type=media_type, headers=headers
            )

        except Exception as e:
            logger.error("Internal Server Error: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal Server Error",
            ) from e

    async def get_transactions(self, organization_id, pagination) -> List[TransactionBase]:
        # Apply filters
        conditions = []
        pagination = validate_pagination(pagination)
        if pagination.filters and len(pagination.filters) > 0:
            try:
                self.apply_filters(pagination, conditions)
            except Exception as e:
                raise ValueError(
                    f"Invalid filter provided: {pagination.filters}."
                )

        offset = 0 if (pagination.page < 1) else (
            pagination.page - 1) * pagination.size
        limit = pagination.size

        query = (
            select(Transaction)
            .options(
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
            .where(Organization.organization_id == organization_id)
            .where(and_(*conditions))
        )
        count_query = await self.session.execute(
            select(func.count(distinct(Transaction.transaction_id)))
            .where(Organization.organization_id == organization_id)
            .where(and_(*conditions))
        )

        total_count = count_query.unique().scalar_one_or_none()

        for order in pagination.sortOrders:
            sort_method = asc if order.direction == "asc" else desc
            query = query.order_by(
                sort_method(
                    order.field if order.field != "status" else "description"
                )
            )

        transaction_results = await self.session.execute(query.offset(offset).limit(limit))
        results = transaction_results.scalars().unique().all()

        return [
            Transaction.model_validate(transaction) for transaction in results
        ], total_count
