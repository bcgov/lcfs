from lcfs.db.base import BaseModel
from lcfs.db.models.transaction import Transaction
from lcfs.web.api.transaction.schema import TransactionActionEnum
import structlog
from typing import List

from fastapi import Depends
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, case, func, select, asc, desc, distinct, or_

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.organization.OrganizationAddress import OrganizationAddress
from lcfs.db.models.organization.OrganizationAttorneyAddress import (
    OrganizationAttorneyAddress,
)
from lcfs.db.models.organization.OrganizationStatus import (
    OrgStatusEnum,
    OrganizationStatus,
)
from lcfs.db.models.organization.OrganizationType import OrganizationType
from lcfs.web.exception.exceptions import DataNotFoundException

from .schema import (
    OrganizationSchema,
    OrganizationStatusSchema,
    OrganizationTypeSchema,
    OrganizationResponseSchema,
)


logger = structlog.get_logger(__name__)


class OrganizationsRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_organizations(self) -> List[Organization]:
        """
        Fetch all organizations from the database
        """
        result = await self.db.execute(
            select(Organization)
            .options(joinedload(Organization.org_status))
            .order_by(Organization.organization_id)
        )
        return result.scalars().all()

    @repo_handler
    async def get_organizations_with_balances(self) -> List[dict]:
        """
        Fetch organization_id, name, status, and their reserved and available balances.
        """
        result = await self.db.execute(
            select(
                Organization.organization_id,
                Organization.name,
                OrganizationStatus.status,
                func.abs(
                    func.sum(
                        case(
                            (
                                and_(
                                    Transaction.transaction_action
                                    == TransactionActionEnum.Reserved,
                                    Transaction.compliance_units < 0,
                                ),
                                Transaction.compliance_units,
                            ),
                            else_=0,
                        )
                    )
                ).label("reserved_balance"),
                func.sum(
                    case(
                        (
                            Transaction.transaction_action
                            == TransactionActionEnum.Adjustment,
                            Transaction.compliance_units,
                        ),
                        else_=0,
                    )
                ).label("total_balance"),
            )
            .outerjoin(
                Transaction, Organization.organization_id == Transaction.organization_id
            )
            .outerjoin(
                OrganizationStatus,
                Organization.organization_status_id
                == OrganizationStatus.organization_status_id,
            )
            .group_by(
                Organization.organization_id,
                Organization.name,
                OrganizationStatus.status,
            )
            .order_by(Organization.organization_id)
        )
        return [
            [
                org_id,
                name,
                total_balance or 0,
                reserved_balance or 0,
                status.value,
            ]
            for org_id, name, status, reserved_balance, total_balance in result
        ]

    @repo_handler
    async def create_organization(self, org_model: Organization):
        """
        save an organization in the database
        """

        self.db.add(org_model)
        await self.db.flush()
        await self.db.refresh(org_model)
        return OrganizationResponseSchema.model_validate(org_model)

    @repo_handler
    async def get_organization(self, organization_id: int) -> Organization:
        """
        Fetch a single organization by organization id from the database
        """
        query = (
            select(Organization)
            .options(
                joinedload(Organization.org_status),
                joinedload(Organization.org_address),
                joinedload(Organization.org_attorney_address),
            )
            .where(Organization.organization_id == organization_id)
        )
        return await self.db.scalar(query)

    @repo_handler
    async def update_organization(self, organization: Organization) -> Organization:
        """
        Update an existing organization in the database
        """
        organization = await self.db.merge(organization)
        await self.db.flush()
        await self.db.refresh(organization)

        return OrganizationResponseSchema.model_validate(organization)

    def add(self, entity: BaseModel):
        self.db.add(entity)

    @repo_handler
    async def get_organization_lite(self, organization_id: int) -> Organization:
        """
        Fetch a single organization by organization id from the database without related tables
        """
        return await self.db.scalar(
            select(Organization).where(Organization.organization_id == organization_id)
        )

    @repo_handler
    async def get_organizations_paginated(self, offset, limit, conditions, pagination):
        """
        Fetch all organizations. returns pagination data
        """
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
        for order in pagination.sort_orders:
            sort_method = asc if order.direction == "asc" else desc
            query = query.order_by(
                sort_method(order.field if order.field != "status" else "description")
            )

        results = await self.db.execute(query.offset(offset).limit(limit))
        organizations = results.scalars().all()

        return [
            OrganizationSchema.model_validate(organization)
            for organization in organizations
        ], total_count

    @repo_handler
    async def get_organization_statuses(self) -> List[OrganizationStatusSchema]:
        """
        Get all available statuses for organizations from the database.

        Returns:
            List[OrganizationStatusSchema]: A list of OrganizationStatusSchema objects containing the basic organization status details.
        """
        query = select(OrganizationStatus).distinct()
        status_results = await self.db.execute(query)
        results = status_results.scalars().all()
        return [OrganizationStatusSchema.model_validate(status) for status in results]

    @repo_handler
    async def get_organization_types(self) -> List[OrganizationTypeSchema]:
        """
        Get all available types for organizations from the database.
        """
        query = select(OrganizationType).distinct()
        result = await self.db.execute(query)

        return result.scalars().all()

    @repo_handler
    async def get_organization_names(self, conditions=None, order_by=("name", "asc")):
        """
        Fetches organization names and details based on provided conditions and dynamic ordering.

        Parameters:
            conditions (list): SQLAlchemy conditions to filter the query.
            order_by (tuple): A tuple containing the field name as the first element and the sorting direction ('asc' or 'desc')
                            as the second element. Ensures the field exists on the model to prevent errors.

        Returns:
            List of dictionaries with organization details including ID, names, balances, and status.
        """
        query = select(Organization).join(OrganizationStatus)

        if conditions:
            query = query.filter(*conditions)

        # Apply dynamic ordering
        if order_by:
            field_name, direction = order_by
            if hasattr(Organization, field_name):  # Ensure the field is valid
                order_function = asc if direction.lower() == "asc" else desc
                query = query.order_by(
                    order_function(getattr(Organization, field_name))
                )
            else:
                raise ValueError(f"Invalid ordering field specified: {field_name}")

        result = await self.db.execute(query)
        organizations = result.scalars().all()

        return [
            {
                "organization_id": org.organization_id,
                "name": org.name,
                "operating_name": org.operating_name,
                "total_balance": org.total_balance,
                "reserved_balance": org.reserved_balance,
            }
            for org in organizations
        ]

    @repo_handler
    async def get_externally_registered_organizations(self, conditions):
        """
        Get all externally registered  organizations from the database.
        """

        query = (
            select(Organization)
            .where(and_(*conditions))
            .options(
                joinedload(Organization.org_type),
                joinedload(Organization.org_status),
            )
            .order_by(Organization.name)
        )

        # Execute the query
        results = await self.db.execute(query)
        return results.scalars().all()

    @repo_handler
    async def get_organization_address(self, organization_address_id: int):
        return await self.db.scalar(
            select(OrganizationAddress).where(
                OrganizationAddress.organization_address_id == organization_address_id
            )
        )

    @repo_handler
    async def get_organization_attorney_address(
        self, organization_attorney_address_id: int
    ):
        return await self.db.scalar(
            select(OrganizationAttorneyAddress).where(
                OrganizationAttorneyAddress.organization_attorney_address_id
                == organization_attorney_address_id
            )
        )

    @repo_handler
    async def is_registered_for_transfer(self, organization_id: int):
        """
        Check if an organization is registered in the database.
        """
        result = await self.db.scalar(
            select(Organization.organization_id).where(
                and_(
                    Organization.organization_id == organization_id,
                    OrganizationStatus.status == OrgStatusEnum.Registered,
                )
            )
        )
        return result is not None

    @repo_handler
    async def search_organizations_by_name(
        self, search_query: str
    ) -> List[Organization]:
        """
        Search for organizations based on a query string.
        Return exact match first if found, followed by partial matches.
        """
        query = (
            select(Organization)
            .options(joinedload(Organization.org_address))
            .filter(
                or_(
                    Organization.name.ilike(f"%{search_query}%"),
                    Organization.operating_name.ilike(f"%{search_query}%"),
                )
            )
            .order_by(Organization.name)
            .limit(10)
        )

        result = await self.db.execute(query)
        organizations = result.scalars().all()

        # Separate exact matches and partial matches
        exact_matches = [
            org
            for org in organizations
            if org.name.lower() == search_query.lower()
            or org.operating_name.lower() == search_query.lower()
        ]
        partial_matches = [org for org in organizations if org not in exact_matches]

        # Return exact matches first, followed by partial matches
        return exact_matches + partial_matches

    @repo_handler
    async def get_organization_by_code(self, org_code: str) -> Organization:
        """
        Fetch a single organization by organization code from the database
        """
        query = (
            select(Organization)
            .options(
                joinedload(Organization.org_status),
                joinedload(Organization.org_address),
                joinedload(Organization.org_attorney_address),
            )
            .where(Organization.organization_code == org_code)
        )
        return await self.db.scalar(query)
