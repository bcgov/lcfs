from logging import getLogger
from typing import List

from sqlalchemy import and_, func, select, asc, desc, distinct
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

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
)

logger = getLogger("organization_repo")


class OrganizationRepository:
    def __init__(self, session: AsyncSession, request: Request = None) -> None:
        self.session = session
        self.request = request

    async def get_organizations(
        self, pagination: PaginationRequestSchema = {}
    ) -> List[OrganizationBase]:
        # TODO: Implement Redis cache wherever required
        # TODO: Implement Compliance Units and In Reserve fields once the transactions model is created
        # Apply filters
        conditions = []
        if pagination.filters and len(pagination.filters) > 0:
            for filter in pagination.filters:
                filter_value = filter.filter
                filter_option = filter.type
                filter_type = filter.filter_type.default

                if filter.field == "status":
                    field = get_field_for_filter(OrganizationStatus, "status")
                else:
                    field = get_field_for_filter(Organization, filter.field)

                conditions.append(
                    apply_filter_conditions(
                        field, filter_value, filter_option, filter_type
                    )
                )

        # Apply pagination
        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
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
                joinedload(Organization.org_type), joinedload(Organization.org_status)
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
                sort_method(order.field if order.field != "status" else "description")
            )

        results = await self.session.execute(query.offset(offset).limit(limit))
        organizations = results.scalars().all()

        return [
            OrganizationBase.model_validate(organization)
            for organization in organizations
        ], total_count

    async def get_statuses(self) -> List[OrganizationStatusBase]:
        query = select(OrganizationStatus).distinct()
        status_results = await self.session.execute(query)
        results = status_results.scalars().all()
        return [
            OrganizationStatusBase.model_validate(status) for status in results
        ]

    async def get_types(self) -> List[OrganizationTypeBase]:
        query = select(OrganizationType).distinct()
        types_results = await self.session.execute(query)
        results = types_results.scalars().all()
        return [OrganizationTypeBase.model_validate(types) for types in results]
