from logging import getLogger
from typing import List, Optional

from sqlalchemy import and_, func, select, asc, desc, delete, distinct
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from lcfs.web.api.organization.schema import (
    OrganizationBaseSchema,
    OrganizationStatusBaseSchema,
    OrganizationTypeBaseSchema,
)
from lcfs.db.models.OrganizationStatus import OrganizationStatus
from lcfs.db.models.OrganizationType import OrganizationType
from lcfs.db.models.Organization import Organization
from lcfs.web.api.base import (
    PaginationRequestSchema,
    apply_filter_conditions,
    get_field_for_filter,
)
from fastapi import HTTPException

logger = getLogger("organization_repo")


class OrganizationRepository:
    def __init__(self, session: AsyncSession, request: Request = None) -> None:
        self.session = session
        self.request = request

    async def get_organizations(
        self, pagination: PaginationRequestSchema = {}
    ) -> List[OrganizationBaseSchema]:
        # Apply pagination and sorting parameters
        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
        limit = pagination.size
        query = select(Organization).options(
            joinedload(Organization.org_type), joinedload(Organization.org_status)
        )
        count_query = await self.session.execute(
            select(func.count(distinct(Organization.organization_id))).select_from(
                Organization
            )
        )
        total_count = count_query.unique().scalar_one_or_none()
        
        organization_results = await self.session.execute(
            query.offset(offset).limit(limit).order_by(asc(Organization.name))
        )
        results = organization_results.scalars().all()

        return [
            OrganizationBaseSchema.model_validate(organization)
            for organization in results
        ], total_count

    async def get_statuses(self) -> List[OrganizationStatusBaseSchema]:
        query = select(OrganizationStatus).distinct()
        status_results = await self.session.execute(query)
        results = status_results.scalars().all()
        return [
            OrganizationStatusBaseSchema.model_validate(status) for status in results
        ]

    async def get_types(self) -> List[OrganizationTypeBaseSchema]:
        query = select(OrganizationType).distinct()
        types_results = await self.session.execute(query)
        results = types_results.scalars().all()
        return [OrganizationTypeBaseSchema.model_validate(types) for types in results]
