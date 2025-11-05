from decimal import Decimal

from lcfs.db.base import BaseModel
from lcfs.db.models.transaction import Transaction
from lcfs.web.api.transaction.schema import TransactionActionEnum
import structlog
from typing import Dict, List, Optional, TYPE_CHECKING

from fastapi import Depends, HTTPException
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, case, func, select, asc, desc, distinct, or_, delete

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
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatus,
    ComplianceReportStatusEnum,
)
from lcfs.db.models.compliance.ComplianceReportListView import (
    ComplianceReportListView,
)
from lcfs.db.models.organization.PenaltyLog import PenaltyLog
from lcfs.web.api.base import (
    PaginationRequestSchema,
    apply_filter_conditions,
    apply_number_filter_conditions,
    validate_pagination,
)

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

        # Add year-based early issuance for current year before validation
        org_model.has_early_issuance = await self.get_current_year_early_issuance(
            org_model.organization_id
        )

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

        # Add year-based early issuance for current year before validation
        organization.has_early_issuance = await self.get_current_year_early_issuance(
            organization.organization_id
        )

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
            organization.has_early_issuance = (
                await self.get_current_year_early_issuance(organization.organization_id)
            )
            validated_organizations.append(
                OrganizationSchema.model_validate(organization)
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
    async def get_organization_type(self, type_id: int) -> OrganizationType:
        """
        Get organization type by ID.
        """
        query = select(OrganizationType).where(
            OrganizationType.organization_type_id == type_id
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    @repo_handler
    async def get_organization_names(
        self,
        conditions=None,
        order_by=("name", "asc"),
        org_type_filter: str = "fuel_supplier",
        org_filters: Dict[str, List[str]] | None = None,
    ):
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
        normalized_org_type = (org_type_filter or "fuel_supplier").lower()
        query = (
            select(Organization)
            .options(joinedload(Organization.org_type))
            .join(OrganizationStatus)
            .join(Organization.org_type, isouter=True)
        )

        if normalized_org_type != "all":
            query = query.filter(OrganizationType.org_type == normalized_org_type)

        if conditions:
            query = query.filter(*conditions)

        if org_filters:
            for field, values in org_filters.items():
                if not values:
                    continue

                column_attr = getattr(Organization, field, None)
                if column_attr is None:
                    continue

                if isinstance(values, list) and len(values) > 1:
                    query = query.filter(column_attr.in_(values))
                else:
                    query = query.filter(column_attr == values[0])

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

        organization_summaries = []
        for org in organizations:
            org_type_value = None
            if org.org_type is not None:
                try:
                    org_type_value = org.org_type.org_type
                except AttributeError:
                    org_type_value = None

            organization_summaries.append(
                {
                    "organization_id": org.organization_id,
                    "name": org.name,
                    "operating_name": org.operating_name,
                    "total_balance": org.total_balance,
                    "reserved_balance": org.reserved_balance,
                    "status": org.org_status,
                    "org_type": org_type_value,
                }
            )

        return organization_summaries

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
    async def get_penalty_analytics_data(self, organization_id: int):
        """
        Retrieve compliance report penalty summary data and discretionary penalties
        for a given organization.
        """
        assessed_reports_cte = (
            select(
                ComplianceReportListView.compliance_report_id.label("report_id"),
                ComplianceReportListView.compliance_period_id.label(
                    "compliance_period_id"
                ),
                ComplianceReportListView.compliance_period.label("compliance_year"),
                func.row_number()
                .over(
                    partition_by=ComplianceReportListView.compliance_period_id,
                    order_by=[
                        ComplianceReportListView.update_date.desc(),
                        ComplianceReportListView.compliance_report_id.desc(),
                    ],
                )
                .label("row_number"),
            ).where(
                ComplianceReportListView.organization_id == organization_id,
                ComplianceReportListView.is_latest.is_(True),
                ComplianceReportListView.report_status.in_(
                    [
                        ComplianceReportStatusEnum.Submitted,
                        ComplianceReportStatusEnum.Assessed,
                    ]
                ),
            )
        ).cte("assessed_reports")

        summary_query = (
            select(
                assessed_reports_cte.c.compliance_period_id,
                assessed_reports_cte.c.compliance_year,
                ComplianceReportSummary.line_11_non_compliance_penalty_gasoline.label(
                    "line_11_penalty_gasoline"
                ),
                ComplianceReportSummary.line_11_non_compliance_penalty_diesel.label(
                    "line_11_penalty_diesel"
                ),
                ComplianceReportSummary.line_11_non_compliance_penalty_jet_fuel.label(
                    "line_11_penalty_jet_fuel"
                ),
                ComplianceReportSummary.line_21_non_compliance_penalty_payable.label(
                    "line_21_penalty_payable"
                ),
                ComplianceReportSummary.penalty_override_enabled.label(
                    "penalty_override_enabled"
                ),
                ComplianceReportSummary.renewable_penalty_override.label(
                    "renewable_penalty_override"
                ),
                ComplianceReportSummary.low_carbon_penalty_override.label(
                    "low_carbon_penalty_override"
                ),
            )
            .join(
                ComplianceReportSummary,
                ComplianceReportSummary.compliance_report_id
                == assessed_reports_cte.c.report_id,
            )
            .where(assessed_reports_cte.c.row_number == 1)
            .order_by(assessed_reports_cte.c.compliance_year.asc())
        )

        summaries = (await self.db.execute(summary_query)).mappings().all()

        penalty_logs_query = (
            select(
                PenaltyLog.penalty_log_id,
                PenaltyLog.compliance_period_id,
                CompliancePeriod.description.label("compliance_year"),
                PenaltyLog.contravention_type,
                PenaltyLog.offence_history,
                PenaltyLog.deliberate,
                PenaltyLog.efforts_to_correct,
                PenaltyLog.economic_benefit_derived,
                PenaltyLog.efforts_to_prevent_recurrence,
                PenaltyLog.notes,
                PenaltyLog.penalty_amount,
            )
            .join(
                CompliancePeriod,
                CompliancePeriod.compliance_period_id
                == PenaltyLog.compliance_period_id,
            )
            .where(PenaltyLog.organization_id == organization_id)
            .order_by(
                CompliancePeriod.description.asc(),
                PenaltyLog.penalty_log_id.asc(),
            )
        )
        penalty_logs_result = await self.db.execute(penalty_logs_query)
        penalty_logs = penalty_logs_result.mappings().all()

        return summaries, penalty_logs

    @repo_handler
    async def get_penalty_logs_paginated(
        self, organization_id: int, pagination: PaginationRequestSchema
    ):
        pagination = validate_pagination(pagination)

        conditions = [PenaltyLog.organization_id == organization_id]

        filter_field_map = {
            "compliance_year": CompliancePeriod.description,
            "contravention_type": PenaltyLog.contravention_type,
            "offence_history": PenaltyLog.offence_history,
            "deliberate": PenaltyLog.deliberate,
            "efforts_to_correct": PenaltyLog.efforts_to_correct,
            "economic_benefit_derived": PenaltyLog.economic_benefit_derived,
            "efforts_to_prevent_recurrence": PenaltyLog.efforts_to_prevent_recurrence,
            "notes": PenaltyLog.notes,
            "penalty_amount": PenaltyLog.penalty_amount,
        }

        boolean_fields = {
            "offence_history",
            "deliberate",
            "efforts_to_correct",
            "economic_benefit_derived",
            "efforts_to_prevent_recurrence",
        }

        def parse_boolean(value):
            if isinstance(value, bool):
                return value
            if value is None:
                return None
            value_str = str(value).strip().lower()
            if value_str in {"yes", "true", "1"}:
                return True
            if value_str in {"no", "false", "0"}:
                return False
            return None

        for filter_model in pagination.filters:
            column = filter_field_map.get(filter_model.field)
            if not column:
                continue

            if filter_model.field in boolean_fields:
                if filter_model.filter_type == "set":
                    raw_values = filter_model.filter or []
                    parsed_values = [
                        value
                        for value in (parse_boolean(v) for v in raw_values)
                        if value is not None
                    ]
                    if parsed_values:
                        conditions.append(column.in_(parsed_values))
                else:
                    bool_value = parse_boolean(filter_model.filter)
                    if bool_value is not None:
                        if filter_model.type == "notEqual":
                            conditions.append(column.is_not(bool_value))
                        else:
                            conditions.append(column.is_(bool_value))
                continue

            filter_value = filter_model.filter
            filter_type = filter_model.filter_type
            filter_option = filter_model.type

            if filter_model.field == "penalty_amount" and isinstance(
                filter_value, list
            ):
                numeric_range = [float(v) for v in filter_value if v is not None]
                if len(numeric_range) == 2:
                    conditions.append(
                        apply_number_filter_conditions(
                            column,
                            numeric_range,
                            "inRange",
                        )
                    )
                continue

            if filter_model.field == "penalty_amount" and filter_value is not None:
                try:
                    filter_value = float(filter_value)
                except (TypeError, ValueError):
                    continue

            if filter_value is not None:
                try:
                    conditions.append(
                        apply_filter_conditions(
                            column, filter_value, filter_option, filter_type
                        )
                    )
                except HTTPException:
                    continue

        total_query = (
            select(func.count())
            .select_from(PenaltyLog)
            .join(
                CompliancePeriod,
                CompliancePeriod.compliance_period_id
                == PenaltyLog.compliance_period_id,
            )
            .where(and_(*conditions))
        )
        total = await self.db.scalar(total_query)

        sort_map = {
            "compliance_year": CompliancePeriod.description,
            "contravention_type": PenaltyLog.contravention_type,
            "offence_history": PenaltyLog.offence_history,
            "deliberate": PenaltyLog.deliberate,
            "efforts_to_correct": PenaltyLog.efforts_to_correct,
            "economic_benefit_derived": PenaltyLog.economic_benefit_derived,
            "efforts_to_prevent_recurrence": PenaltyLog.efforts_to_prevent_recurrence,
            "notes": PenaltyLog.notes,
            "penalty_amount": PenaltyLog.penalty_amount,
        }

        order_by_clauses = []
        for sort in pagination.sort_orders:
            column = sort_map.get(sort.field)
            if not column:
                continue
            order_by_clauses.append(
                asc(column) if sort.direction == "asc" else desc(column)
            )

        if not order_by_clauses:
            order_by_clauses = [
                CompliancePeriod.description.desc(),
                PenaltyLog.penalty_log_id.desc(),
            ]

        offset = (pagination.page - 1) * pagination.size

        records_query = (
            select(
                PenaltyLog.penalty_log_id,
                PenaltyLog.compliance_period_id,
                CompliancePeriod.description.label("compliance_year"),
                PenaltyLog.contravention_type,
                PenaltyLog.offence_history,
                PenaltyLog.deliberate,
                PenaltyLog.efforts_to_correct,
                PenaltyLog.economic_benefit_derived,
                PenaltyLog.efforts_to_prevent_recurrence,
                PenaltyLog.notes,
                PenaltyLog.penalty_amount,
            )
            .join(
                CompliancePeriod,
                CompliancePeriod.compliance_period_id
                == PenaltyLog.compliance_period_id,
            )
            .where(and_(*conditions))
            .order_by(*order_by_clauses)
            .offset(offset)
            .limit(pagination.size)
        )

        records = (await self.db.execute(records_query)).mappings().all()

        return records, total

    @repo_handler
    async def create_penalty_log(self, organization_id: int, data):
        penalty_log = PenaltyLog(
            organization_id=organization_id,
            compliance_period_id=data.compliance_period_id,
            contravention_type=data.contravention_type.value,
            offence_history=data.offence_history,
            deliberate=data.deliberate,
            efforts_to_correct=data.efforts_to_correct,
            economic_benefit_derived=data.economic_benefit_derived,
            efforts_to_prevent_recurrence=data.efforts_to_prevent_recurrence,
            notes=data.notes,
            penalty_amount=Decimal(str(data.penalty_amount or 0)),
        )
        self.db.add(penalty_log)
        await self.db.flush()
        await self.db.refresh(penalty_log, attribute_names=["compliance_period"])
        return penalty_log

    @repo_handler
    async def get_penalty_log_by_id(
        self, organization_id: int, penalty_log_id: int
    ) -> Optional[PenaltyLog]:
        result = await self.db.execute(
            select(PenaltyLog)
            .options(joinedload(PenaltyLog.compliance_period))
            .where(
                PenaltyLog.penalty_log_id == penalty_log_id,
                PenaltyLog.organization_id == organization_id,
            )
        )
        return result.scalars().first()

    @repo_handler
    async def update_penalty_log(self, penalty_log: PenaltyLog, data):
        penalty_log.compliance_period_id = data.compliance_period_id
        penalty_log.contravention_type = data.contravention_type.value
        penalty_log.offence_history = data.offence_history
        penalty_log.deliberate = data.deliberate
        penalty_log.efforts_to_correct = data.efforts_to_correct
        penalty_log.economic_benefit_derived = data.economic_benefit_derived
        penalty_log.efforts_to_prevent_recurrence = data.efforts_to_prevent_recurrence
        penalty_log.notes = data.notes
        penalty_log.penalty_amount = Decimal(str(data.penalty_amount or 0))
        await self.db.flush()
        await self.db.refresh(penalty_log, attribute_names=["compliance_period"])
        return penalty_log

    @repo_handler
    async def delete_penalty_log(
        self, organization_id: int, penalty_log_id: int
    ) -> bool:
        result = await self.db.execute(
            delete(PenaltyLog)
            .where(
                PenaltyLog.penalty_log_id == penalty_log_id,
                PenaltyLog.organization_id == organization_id,
            )
            .returning(PenaltyLog.penalty_log_id)
        )
        deleted_id = result.scalar()
        return deleted_id is not None

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
