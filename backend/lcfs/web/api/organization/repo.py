from logging import getLogger
from typing import List

from fastapi import Depends
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, func, select, asc, desc, distinct

from lcfs.db.dependencies import get_async_db_session

from lcfs.web.core.decorators import repo_handler
from lcfs.web.exception.exceptions import DataNotFoundException

from lcfs.db.models.Organization import Organization
from lcfs.db.models.OrganizationAddress import OrganizationAddress
from lcfs.db.models.OrganizationAttorneyAddress import OrganizationAttorneyAddress
from lcfs.db.models.OrganizationStatus import OrganizationStatus
from lcfs.db.models.OrganizationType import OrganizationType

from .schema import OrganizationSchema, OrganizationBase, OrganizationStatusBase, OrganizationTypeBase


logger = getLogger("organization_repo")


class OrganizationRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_organizations(self) -> List[Organization]:
        '''
        Fetch all organizations from the database
        '''
        result = await self.db.execute(
            select(Organization)
            .options(joinedload(Organization.org_status))
            .order_by(Organization.organization_id)
        )
        return result.scalars().all()

    @repo_handler
    async def create_organization(
            self,
            org_address: OrganizationAddress, org_attorney_address: OrganizationAttorneyAddress, org_model: Organization
    ):
        '''
        save an organization in the database
        '''
        async with self.db.begin():

            self.db.add_all([org_address, org_attorney_address])
            await self.db.flush()

            self.db.add(org_model)
            await self.db.flush()

            return OrganizationSchema.from_orm(org_model)

    @repo_handler
    async def get_organization(self, organization_id: int) -> Organization:
        '''
        Fetch a single organization by organization id from the database
        '''
        return await self.db.scalar(
            select(Organization)
            .options(
                joinedload(Organization.org_status),
                joinedload(Organization.org_address),
                joinedload(Organization.org_attorney_address),
            )
            .where(Organization.organization_id == organization_id)
        )
    
    @repo_handler
    async def get_organization_lite(self, organization_id: int) -> Organization:
        '''
        Fetch a single organization by organization id from the database without related tables
        '''
        return await self.db.scalar(
            select(Organization).where(Organization.organization_id == organization_id)
        )

    @repo_handler
    async def update_organization(self, organization_id: int, organization_data) -> Organization:
        '''
        update an organization in the database
        '''
        async with self.db.begin():
            organization = await self.db.scalar(
                select(Organization).where(
                    Organization.organization_id == organization_id)
            )

            if not organization:
                raise DataNotFoundException("Organization not found")

            # Update the organization fields with new data
            for key, value in organization_data.dict().items():
                setattr(organization, key, value)

            await self.db.refresh(organization)

        return organization

    @repo_handler
    async def get_organizations_paginated(self, offset, limit, conditions, pagination):
        '''
        Fetch all organizations. returns pagination data
        '''
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
        count_query = await self.db.execute(
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

        results = await self.db.execute(query.offset(offset).limit(limit))
        organizations = results.scalars().all()

        return [
            OrganizationBase.model_validate(organization)
            for organization in organizations
        ], total_count

    @repo_handler
    async def get_organization_statuses(self) -> List[OrganizationStatusBase]:
        """
        Get all available statuses for organizations from the database.

        Returns:
            List[OrganizationStatusBase]: A list of OrganizationStatusBase objects containing the basic organization status details.
        """
        query = select(OrganizationStatus).distinct()
        status_results = await self.db.execute(query)
        results = status_results.scalars().all()
        return [OrganizationStatusBase.model_validate(status) for status in results]

    @repo_handler
    async def get_organization_types(self) -> List[OrganizationTypeBase]:
        '''
        Get all available types for organizations from the database.
        '''
        query = select(OrganizationType).distinct()
        result = await self.db.execute(query)

        return result.scalars().all()

    @repo_handler
    async def get_organization_names(self):
        '''
        Get all available names for organizations from the database.
        '''
        result = await self.db.execute(
            select(Organization.organization_id, Organization.name)
        )
        return result.unique().all()

    @repo_handler
    async def get_externally_registered_organizations(self, conditions):
        '''
        Get all externally registered  organizations from the database.
        '''

        query = (
            select(Organization)
            .where(and_(*conditions))
            .options(
                joinedload(Organization.org_type),
                joinedload(Organization.org_status),
            )
        )

        # Execute the query
        results = await self.db.execute(query)
        return results.scalars().all()