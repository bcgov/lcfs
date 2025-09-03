from lcfs.db.base import BaseModel
from lcfs.db.models.transaction import Transaction
from lcfs.web.api.transaction.schema import TransactionActionEnum
import structlog
from typing import List, Optional, TYPE_CHECKING

from fastapi import Depends, HTTPException
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
from lcfs.db.models.organization.OrganizationLinkKey import OrganizationLinkKey
from lcfs.db.models.form.Form import Form
from lcfs.db.models.organization.OrganizationStatus import (
    OrgStatusEnum,
    OrganizationStatus,
)
from lcfs.db.models.organization.OrganizationType import OrganizationType
from lcfs.db.models.organization.OrganizationEarlyIssuanceByYear import (
    OrganizationEarlyIssuanceByYear,
)
from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport

if TYPE_CHECKING:
    from lcfs.db.models.user.UserProfile import UserProfile

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

        # Get early issuance status for current year
        has_early_issuance = await self.get_current_year_early_issuance(
            org_model.organization_id
        )

        # Create response with early issuance data
        org_data = {
            **{column.name: getattr(org_model, column.name) for column in org_model.__table__.columns},
            "has_early_issuance": has_early_issuance
        }
        
        return OrganizationResponseSchema.model_validate(org_data)

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

        # Get early issuance status for current year  
        has_early_issuance = await self.get_current_year_early_issuance(
            organization.organization_id
        )

        # Create response with early issuance data
        org_data = {
            **{column.name: getattr(organization, column.name) for column in organization.__table__.columns},
            "has_early_issuance": has_early_issuance
        }

        return OrganizationResponseSchema.model_validate(org_data)

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
        from lcfs.utils.constants import LCFS_Constants

        current_year = LCFS_Constants.get_current_compliance_year()

        # Check if early issuance filter or sort is present
        has_early_issuance_filter = any(
            filter.field in ["has_early_issuance", "hasEarlyIssuance"]
            for filter in pagination.filters
        )
        has_early_issuance_sort = any(
            order.field in ["has_early_issuance", "hasEarlyIssuance"]
            for order in pagination.sort_orders
        )
        needs_early_issuance_joins = (
            has_early_issuance_filter or has_early_issuance_sort
        )

        # Base query with standard joins
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
        )

        # Count query
        count_query = (
            select(func.count(distinct(Organization.organization_id)))
            .select_from(Organization)
            .join(
                OrganizationStatus,
                Organization.organization_status_id
                == OrganizationStatus.organization_status_id,
            )
        )

        # Add early issuance joins if needed (either for filtering, sorting, or general data)
        if needs_early_issuance_joins:
            query = query.outerjoin(
                OrganizationEarlyIssuanceByYear,
                Organization.organization_id
                == OrganizationEarlyIssuanceByYear.organization_id,
            ).outerjoin(
                CompliancePeriod,
                and_(
                    OrganizationEarlyIssuanceByYear.compliance_period_id
                    == CompliancePeriod.compliance_period_id,
                    CompliancePeriod.description == current_year,
                ),
            )

            count_query = count_query.outerjoin(
                OrganizationEarlyIssuanceByYear,
                Organization.organization_id
                == OrganizationEarlyIssuanceByYear.organization_id,
            ).outerjoin(
                CompliancePeriod,
                and_(
                    OrganizationEarlyIssuanceByYear.compliance_period_id
                    == CompliancePeriod.compliance_period_id,
                    CompliancePeriod.description == current_year,
                ),
            )

        # Apply all conditions (including early_issuance if present)
        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        # Execute count query
        total_count = await self.db.execute(count_query)
        total_count = total_count.unique().scalar_one_or_none()

        # Sort the query results
        for order in pagination.sort_orders:
            sort_method = asc if order.direction == "asc" else desc

            # Map frontend field names to backend field names
            field_name = order.field
            if field_name == "hasEarlyIssuance":
                field_name = "has_early_issuance"

            if field_name == "status":
                # Sort by organization status description
                query = query.order_by(sort_method(OrganizationStatus.status))
            elif field_name == "registrationStatus":
                # Sort by whether the organization is registered (status == "Registered")
                registration_case = case(
                    (OrganizationStatus.status == "Registered", 1), else_=0
                )
                query = query.order_by(sort_method(registration_case))
            elif field_name == "has_early_issuance":
                # Sort by early issuance if the joins are available
                if needs_early_issuance_joins:
                    query = query.order_by(
                        sort_method(OrganizationEarlyIssuanceByYear.has_early_issuance)
                    )
                else:
                    # Skip sorting by early issuance if no joins are available
                    continue
            else:
                # Default sorting for other fields
                if hasattr(Organization, field_name):
                    query = query.order_by(
                        sort_method(getattr(Organization, field_name))
                    )
                else:
                    # Skip unknown fields
                    continue

        results = await self.db.execute(query.offset(offset).limit(limit))
        organizations = results.scalars().all()

        # Add year-based early issuance for current year to each organization
        validated_organizations = []
        for organization in organizations:
            has_early_issuance = await self.get_current_year_early_issuance(organization.organization_id)
            
            # Create organization data with early issuance and relationships
            org_data = {
                **{column.name: getattr(organization, column.name) for column in organization.__table__.columns},
                "has_early_issuance": has_early_issuance,
                "org_type": organization.org_type,
                "org_status": organization.org_status
            }
            
            validated_organizations.append(
                OrganizationSchema.model_validate(org_data)
            )

        return validated_organizations, total_count

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
        Only returns organizations with type 'fuel_supplier'.

        Parameters:
            conditions (list): SQLAlchemy conditions to filter the query.
            order_by (tuple): A tuple containing the field name as the first element and the sorting direction ('asc' or 'desc')
                            as the second element. Ensures the field exists on the model to prevent errors.

        Returns:
            List of dictionaries with organization details including ID, names, balances, and status.
        """
        query = (
            select(Organization)
            .join(OrganizationStatus)
            .join(Organization.org_type)
            .filter(OrganizationType.org_type == "fuel_supplier")
        )

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
                "status": org.org_status,
            }
            for org in organizations
        ]

    @repo_handler
    async def get_externally_registered_organizations(self, conditions):
        """
        Get all externally registered organizations from the database.
        Only returns organizations with type 'fuel_supplier'.
        """
        # Add fuel supplier type filter to existing conditions
        fuel_supplier_condition = Organization.org_type.has(
            OrganizationType.org_type == "fuel_supplier"
        )
        all_conditions = conditions + [fuel_supplier_condition]

        query = (
            select(Organization)
            .where(and_(*all_conditions))
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
        Only returns organizations with type 'fuel_supplier'.
        """
        query = (
            select(Organization)
            .options(
                joinedload(Organization.org_address), joinedload(Organization.org_type)
            )
            .join(Organization.org_type)
            .filter(
                and_(
                    or_(
                        Organization.name.ilike(f"%{search_query}%"),
                        Organization.operating_name.ilike(f"%{search_query}%"),
                    ),
                    OrganizationType.org_type == "fuel_supplier",
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

    @repo_handler
    async def get_early_issuance_by_year(
        self, organization_id: int, compliance_year: str
    ) -> Optional[OrganizationEarlyIssuanceByYear]:
        """Get early issuance setting for a specific organization and compliance year"""
        result = await self.db.execute(
            select(OrganizationEarlyIssuanceByYear)
            .join(CompliancePeriod)
            .where(
                OrganizationEarlyIssuanceByYear.organization_id == organization_id,
                CompliancePeriod.description == compliance_year,
            )
        )
        return result.scalars().first()

    @repo_handler
    async def check_existing_reports_for_year(
        self, organization_id: int, compliance_year: str
    ) -> bool:
        """Check if organization has any existing compliance reports for the given year"""
        result = await self.db.execute(
            select(ComplianceReport.compliance_report_id)
            .join(CompliancePeriod)
            .where(
                ComplianceReport.organization_id == organization_id,
                CompliancePeriod.description == compliance_year,
            )
            .limit(1)
        )
        return result.scalar() is not None

    @repo_handler
    async def update_early_issuance_by_year(
        self,
        organization_id: int,
        compliance_year: str,
        has_early_issuance: bool,
        user: "UserProfile",
    ) -> OrganizationEarlyIssuanceByYear:
        """Update early issuance setting for a specific organization and compliance year"""
        # First check if there are existing reports
        has_existing_reports = await self.check_existing_reports_for_year(
            organization_id, compliance_year
        )

        if has_existing_reports:
            raise HTTPException(
                status_code=400,
                detail="The Early issuance setting cannot be updated as the organization already has a report in progress. They must delete this report first.",
            )

        # Get the compliance period
        compliance_period_result = await self.db.execute(
            select(CompliancePeriod).where(
                CompliancePeriod.description == compliance_year
            )
        )
        compliance_period = compliance_period_result.scalar_one_or_none()

        if not compliance_period:
            raise HTTPException(
                status_code=404, detail=f"Compliance period {compliance_year} not found"
            )

        # Check if record exists
        existing_record = await self.get_early_issuance_by_year(
            organization_id, compliance_year
        )

        if existing_record:
            # Update existing record
            existing_record.has_early_issuance = has_early_issuance
            existing_record.update_user = user.keycloak_username
            await self.db.flush()
            return existing_record
        else:
            # Create new record
            new_record = OrganizationEarlyIssuanceByYear(
                organization_id=organization_id,
                compliance_period_id=compliance_period.compliance_period_id,
                has_early_issuance=has_early_issuance,
                create_user=user.keycloak_username,
                update_user=user.keycloak_username,
            )
            self.db.add(new_record)
            await self.db.flush()
            return new_record

    @repo_handler
    async def get_current_year_early_issuance(self, organization_id: int) -> bool:
        """Get early issuance setting for the current year"""
        from lcfs.utils.constants import LCFS_Constants

        current_year = LCFS_Constants.get_current_compliance_year()

        early_issuance_record = await self.get_early_issuance_by_year(
            organization_id, current_year
        )

        if early_issuance_record:
            return early_issuance_record.has_early_issuance

        # Default to False if no year-specific setting exists
        return False

    def get_early_issuance_field(self):
        """
        Get the field reference for early issuance filtering.
        Returns the SQLAlchemy field that can be used in filter conditions.
        """
        return OrganizationEarlyIssuanceByYear.has_early_issuance

    @repo_handler
    async def get_credit_market_organizations(self) -> List[Organization]:
        """
        Get organizations that have opted to display in the credit trading market.
        Only returns organizations that have display_in_credit_market set to True.
        """
        query = (
            select(Organization)
            .options(
                joinedload(Organization.org_status),
                joinedload(Organization.org_address),
            )
            .where(
                and_(
                    Organization.display_in_credit_market == True,
                    Organization.org_status.has(
                        OrganizationStatus.status == OrgStatusEnum.Registered
                    ),
                )
            )
            .order_by(Organization.name)
        )

        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def get_organization_link_keys(self, organization_id: int):
        """
        Get all link keys for an organization.
        """
        query = (
            select(OrganizationLinkKey)
            .options(
                joinedload(OrganizationLinkKey.organization),
                joinedload(OrganizationLinkKey.form),
            )
            .where(OrganizationLinkKey.organization_id == organization_id)
            .order_by(OrganizationLinkKey.form_id)
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def get_link_key_by_form_id(
        self, organization_id: int, form_id: int
    ) -> OrganizationLinkKey:
        """
        Get a link key for a specific organization and form.
        """
        query = (
            select(OrganizationLinkKey)
            .options(
                joinedload(OrganizationLinkKey.organization),
                joinedload(OrganizationLinkKey.form),
            )
            .where(
                and_(
                    OrganizationLinkKey.organization_id == organization_id,
                    OrganizationLinkKey.form_id == form_id,
                )
            )
        )
        return await self.db.scalar(query)

    @repo_handler
    async def get_link_key_by_key(self, link_key: str) -> OrganizationLinkKey:
        """
        Get a link key record by the actual link key value.
        Used for validating anonymous form access.
        """
        query = (
            select(OrganizationLinkKey)
            .options(
                joinedload(OrganizationLinkKey.organization),
                joinedload(OrganizationLinkKey.form),
            )
            .where(OrganizationLinkKey.link_key == link_key)
        )
        return await self.db.scalar(query)

    @repo_handler
    async def create_link_key(
        self, link_key: OrganizationLinkKey
    ) -> OrganizationLinkKey:
        """
        Create a new organization link key record.
        """
        self.db.add(link_key)
        await self.db.flush()
        await self.db.refresh(link_key)
        return link_key

    @repo_handler
    async def update_link_key(
        self, link_key: OrganizationLinkKey
    ) -> OrganizationLinkKey:
        """
        Update an existing organization link key record.
        """
        link_key = await self.db.merge(link_key)
        await self.db.flush()
        await self.db.refresh(link_key)
        return link_key

    @repo_handler
    async def get_form_by_id(self, form_id: int) -> Form:
        """
        Get a form by its ID.
        """
        query = select(Form).where(Form.form_id == form_id)
        return await self.db.scalar(query)

    @repo_handler
    async def get_available_forms_for_link_keys(self) -> List[Form]:
        """
        Get all forms that can have link keys generated for them.
        """
        query = select(Form).where(Form.allows_anonymous == True).order_by(Form.name)
        result = await self.db.execute(query)
        return result.scalars().all()
