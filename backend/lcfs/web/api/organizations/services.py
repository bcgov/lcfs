import io
import math
import json
from datetime import datetime
from decimal import Decimal
import structlog
from typing import List, Dict

from lcfs.settings import settings
from fastapi import Depends, Request
from fastapi.responses import StreamingResponse
from fastapi_cache import FastAPICache

from lcfs.db.models.organization.Organization import (
    Organization,
    generate_secure_link_key,
)
from lcfs.db.models.organization.OrganizationType import OrganizationType
from lcfs.db.models.organization.OrganizationLinkKey import OrganizationLinkKey
from lcfs.db.models.organization.OrganizationAddress import OrganizationAddress
from lcfs.db.models.organization.OrganizationAttorneyAddress import (
    OrganizationAttorneyAddress,
)
from lcfs.db.models.organization.OrganizationStatus import (
    OrganizationStatus,
    OrgStatusEnum,
)
from lcfs.db.models.transaction import Transaction
from lcfs.db.models.transaction.Transaction import TransactionActionEnum
from lcfs.services.tfrs.redis_balance import (
    RedisBalanceService,
)
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder, SpreadsheetColumn
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    apply_filter_conditions,
    get_field_for_filter,
    validate_pagination,
    NotificationTypeEnum,
)
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.notification.services import NotificationService
from lcfs.web.api.notification.schema import (
    NotificationRequestSchema,
    NotificationMessageSchema,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException
from .repo import OrganizationsRepository
from .schema import (
    OrganizationTypeSchema,
    OrganizationSchema,
    OrganizationListSchema,
    OrganizationCreateSchema,
    OrganizationSummaryResponseSchema,
    OrganizationDetailsSchema,
    OrganizationUpdateSchema,
    PenaltyAnalyticsResponseSchema,
    PenaltyTotalsSchema,
    PenaltyYearlySummarySchema,
    PenaltyLogEntrySchema,
    PenaltyLogListResponseSchema,
    PenaltyLogCreateSchema,
    PenaltyLogUpdateSchema,
)


logger = structlog.get_logger(__name__)


class OrganizationsService:
    def __init__(
        self,
        request: Request = None,
        repo: OrganizationsRepository = Depends(OrganizationsRepository),
        transaction_repo: TransactionRepository = Depends(TransactionRepository),
        redis_balance_service: RedisBalanceService = Depends(RedisBalanceService),
        notification_service: NotificationService = Depends(NotificationService),
    ) -> None:
        self.request = (request,)
        self.repo = repo
        self.transaction_repo = transaction_repo
        self.redis_balance_service = redis_balance_service
        self.notification_service = notification_service

    def _map_penalty_log_model(self, penalty_log) -> PenaltyLogEntrySchema:
        compliance_year = None
        if penalty_log and getattr(penalty_log, "compliance_period", None):
            compliance_year = penalty_log.compliance_period.description

        return PenaltyLogEntrySchema(
            penalty_log_id=penalty_log.penalty_log_id,
            compliance_period_id=penalty_log.compliance_period_id,
            compliance_year=compliance_year,
            contravention_type=penalty_log.contravention_type,
            offence_history=bool(penalty_log.offence_history),
            deliberate=bool(penalty_log.deliberate),
            efforts_to_correct=bool(penalty_log.efforts_to_correct),
            economic_benefit_derived=bool(penalty_log.economic_benefit_derived),
            efforts_to_prevent_recurrence=bool(
                penalty_log.efforts_to_prevent_recurrence
            ),
            notes=penalty_log.notes,
            penalty_amount=float(penalty_log.penalty_amount or 0),
        )

    async def _requires_bceid(self, organization_type_id: int) -> bool:
        """Check if organization type requires BCeID."""
        org_type = await self.repo.get_organization_type(organization_type_id)
        return org_type.is_bceid_user if org_type else True

    def apply_organization_filters(self, pagination, conditions):
        """
        Apply filters to the organizations query.

        Args:
            pagination (PaginationRequestSchema): The pagination object containing page and size information.
            conditions (List[Condition]): The list of conditions to apply.

        Returns:
            List[Organization]: The list of organizations after applying the filters.
        """
        for filter in pagination.filters:
            filter_value = filter.filter
            filter_option = filter.type
            filter_type = filter.filter_type

            # Map frontend field names to backend field names
            field_name = filter.field
            if field_name == "hasEarlyIssuance":
                field_name = "has_early_issuance"

            if field_name == "has_early_issuance":
                # Get the early issuance field reference
                early_issuance_field = self.repo.get_early_issuance_field()
                conditions.append(
                    apply_filter_conditions(
                        early_issuance_field, filter_value, filter_option, filter_type
                    )
                )
                continue

            if field_name == "registration_status":
                # Registration status is computed from org status
                # Convert boolean or string boolean to status enum for filtering
                # Handle both boolean and string representations from frontend
                if isinstance(filter_value, bool):
                    is_registered = filter_value
                elif isinstance(filter_value, str):
                    is_registered = filter_value.lower() == "true"
                else:
                    # Skip invalid filter values
                    continue

                field = get_field_for_filter(OrganizationStatus, "status")
                if is_registered:
                    # Filter for "Registered" status
                    conditions.append(field == "Registered")
                else:
                    # Filter for non-registered statuses
                    conditions.append(
                        field.in_(["Unregistered", "Suspended", "Canceled"])
                    )
                continue

            if field_name == "org_type":
                field = get_field_for_filter(OrganizationType, "org_type")
            elif field_name == "status":
                field = get_field_for_filter(OrganizationStatus, "status")
            else:
                field = get_field_for_filter(Organization, field_name)

            conditions.append(
                apply_filter_conditions(field, filter_value, filter_option, filter_type)
            )

        return None

    @service_handler
    async def export_organizations(self) -> StreamingResponse:
        """
        Prepares a list of organizations in a .xls file that is downloadable
        """
        data = await self.repo.get_organizations_with_balances()

        export_format = "xlsx"

        # Create a spreadsheet
        builder = SpreadsheetBuilder(file_format=export_format)

        builder.add_sheet(
            sheet_name="Organizations",
            columns=[
                SpreadsheetColumn("ID", "int"),
                SpreadsheetColumn("Organization Name", "text"),
                SpreadsheetColumn("Organization Type", "text"),
                SpreadsheetColumn("Compliance Units", "int"),
                SpreadsheetColumn("In Reserve", "int"),
                SpreadsheetColumn("Registered", "date"),
            ],
            rows=data,
            styles={"bold_headers": True},
        )

        file_content = builder.build_spreadsheet()

        # Get the current date in YYYY-MM-DD format
        current_date = datetime.now().strftime("%Y-%m-%d")

        filename = f"BC-LCFS-organizations-{current_date}.{export_format}"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type="application/vnd.ms-excel",
            headers=headers,
        )

    @service_handler
    async def create_organization(
        self, organization_data: OrganizationCreateSchema, user=None
    ):
        """handles creating an organization"""
        # Check if the organization type requires BCeID
        requires_bceid = await self._requires_bceid(
            organization_data.organization_type_id
        )

        # Handle address creation based on organization type
        org_address = None
        org_attorney_address = None

        if requires_bceid:
            # For BCeID organizations, address is required
            if not organization_data.address:
                raise ValueError("Address is required for BCeID organization types")
            org_address = OrganizationAddress(**organization_data.address.dict())

            if not organization_data.attorney_address:
                raise ValueError(
                    "Attorney address is required for BCeID organization types"
                )
            org_attorney_address = OrganizationAttorneyAddress(
                **organization_data.attorney_address.dict()
            )
        else:
            # For non-BCeID organizations, address is optional
            if (
                organization_data.address
                and hasattr(organization_data.address, "street_address")
                and organization_data.address.street_address
            ):
                org_address = OrganizationAddress(**organization_data.address.dict())

            if (
                organization_data.attorney_address
                and hasattr(organization_data.attorney_address, "street_address")
                and organization_data.attorney_address.street_address
            ):
                org_attorney_address = OrganizationAttorneyAddress(
                    **organization_data.attorney_address.dict()
                )

            # For non-BCeID types, email is required
            if not organization_data.email:
                raise ValueError("Email is required for all organization types")

        # Create and add organization model to the database
        org_model = Organization(
            name=organization_data.name,
            operating_name=organization_data.operating_name,
            email=organization_data.email,
            phone=organization_data.phone,
            edrms_record=organization_data.edrms_record,
            organization_status_id=organization_data.organization_status_id,
            organization_type_id=organization_data.organization_type_id,
            org_address=org_address,
            org_attorney_address=org_attorney_address,
        )

        created_organization = await self.repo.create_organization(org_model)

        # Set early issuance for current year if provided
        if (
            hasattr(organization_data, "has_early_issuance")
            and organization_data.has_early_issuance is not None
        ):
            from lcfs.utils.constants import LCFS_Constants

            current_year = LCFS_Constants.get_current_compliance_year()

            await self.repo.update_early_issuance_by_year(
                created_organization.organization_id,
                current_year,
                organization_data.has_early_issuance,
                user,
            )

        # Clear cache after creating to ensure fresh data in subsequent requests
        await FastAPICache.clear()

        return created_organization

    @service_handler
    async def update_organization(
        self,
        organization_id: int,
        organization_data: OrganizationUpdateSchema,
        user=None,
    ):
        """handles updating an organization"""

        organization = await self.repo.get_organization(organization_id)
        if not organization:
            raise DataNotFoundException("Organization not found")

        # Check if the organization type requires BCeID
        requires_bceid = await self._requires_bceid(
            organization_data.organization_type_id
        )

        # If early issuance setting is being updated, validate against existing reports for current year
        if (
            hasattr(organization_data, "has_early_issuance")
            and organization_data.has_early_issuance is not None
        ):
            from lcfs.utils.constants import LCFS_Constants

            current_year = LCFS_Constants.get_current_compliance_year()

            # Check if setting is different from current setting
            current_setting = await self.repo.get_current_year_early_issuance(
                organization_id
            )

            if current_setting != organization_data.has_early_issuance:
                # Update the year-specific setting, this will raise HTTPException if reports exist
                await self.repo.update_early_issuance_by_year(
                    organization_id,
                    current_year,
                    organization_data.has_early_issuance,
                    user,
                )

        for key, value in organization_data.dict().items():
            # Skip has_early_issuance as it's now handled by year-based structure
            if key == "has_early_issuance":
                continue
            if hasattr(organization, key):
                setattr(organization, key, value)

        # For non-BCeID types, validate email is present if being updated
        if (
            not requires_bceid
            and organization_data.email is not None
            and not organization_data.email
        ):
            raise ValueError("Email is required for all organization types")

        # Handle address updates based on organization type requirements
        if organization_data.address:
            # Check if switching to BCeID type requires addresses
            if requires_bceid and not hasattr(
                organization_data.address, "street_address"
            ):
                raise ValueError("Address is required for BCeID organization types")

            # Only update if there's meaningful address data
            has_address_data = (
                hasattr(organization_data.address, "street_address")
                and organization_data.address.street_address
            )

            if has_address_data or requires_bceid:
                if organization.organization_address_id:
                    org_address = await self.repo.get_organization_address(
                        organization.organization_address_id
                    )
                else:
                    org_address = OrganizationAddress(
                        organization=organization,
                    )
                    organization.organization_address = org_address
                    self.repo.add(org_address)

                for key, value in organization_data.address.dict().items():
                    if hasattr(org_address, key):
                        setattr(org_address, key, value)

        if organization_data.attorney_address:
            # Check if switching to BCeID type requires attorney addresses
            if requires_bceid and not hasattr(
                organization_data.attorney_address, "street_address"
            ):
                raise ValueError(
                    "Attorney address is required for BCeID organization types"
                )

            # Only update if there's meaningful attorney address data
            has_attorney_address_data = (
                hasattr(organization_data.attorney_address, "street_address")
                and organization_data.attorney_address.street_address
            )

            if has_attorney_address_data or requires_bceid:
                if organization.organization_attorney_address_id:
                    org_attorney_address = (
                        await self.repo.get_organization_attorney_address(
                            organization.organization_attorney_address_id
                        )
                    )
                else:
                    org_attorney_address = OrganizationAttorneyAddress(
                        organization=organization,
                    )
                    organization.organization_attorney_address = org_attorney_address
                    self.repo.add(org_attorney_address)

                if not org_attorney_address:
                    raise DataNotFoundException(
                        "Organization attorney address not found"
                    )

                for key, value in organization_data.attorney_address.dict().items():
                    if hasattr(org_attorney_address, key):
                        setattr(org_attorney_address, key, value)

        updated_organization = await self.repo.update_organization(organization)
        return updated_organization

    @service_handler
    async def update_organization_credit_market_details(
        self,
        organization_id: int,
        credit_market_data: dict,
        user=None,
    ):
        """
        Update only the credit market contact details for an organization.
        This method only updates the specific credit market fields without affecting other organization data.
        """
        organization = await self.repo.get_organization(organization_id)
        if not organization:
            raise DataNotFoundException("Organization not found")

        # Store original values to detect if a new credit listing is being created
        was_displayed_in_market = organization.display_in_credit_market or False
        old_credits_to_sell = organization.credits_to_sell or 0

        # Update only the credit market fields
        allowed_fields = {
            "credit_market_contact_name",
            "credit_market_contact_email",
            "credit_market_contact_phone",
            "credit_market_is_seller",
            "credit_market_is_buyer",
            "credits_to_sell",
            "display_in_credit_market",
        }

        for key, value in credit_market_data.items():
            if key in allowed_fields and hasattr(organization, key):
                # Special validation for credits_to_sell
                if key == "credits_to_sell" and value is not None:
                    if value < 0:
                        raise ValueError("Credits to sell cannot be negative")

                    # Get the organization's total balance to validate against
                    total_balance = await self.calculate_total_balance(
                        organization.organization_id
                    )
                    if value > total_balance:
                        raise ValueError(
                            f"Credits to sell ({value}) cannot exceed available balance ({total_balance})"
                        )

                setattr(organization, key, value)

        # Set the update user
        if user:
            organization.update_user = user.keycloak_username

        updated_organization = await self.repo.update_organization(organization)

        # Check if this is a new credit listing that should trigger notifications
        # A new listing is when:
        # 1. The organization is now displayed in the credit market AND has credits to sell
        # 2. AND either wasn't displayed before OR didn't have credits to sell before
        is_now_displayed = updated_organization.display_in_credit_market or False
        new_credits_to_sell = updated_organization.credits_to_sell or 0

        is_new_listing = (
            is_now_displayed
            and new_credits_to_sell > 0
            and (not was_displayed_in_market or old_credits_to_sell == 0)
        )

        if is_new_listing and settings.feature_credit_market_notifications:
            await self._send_credit_market_notification(updated_organization, user)

        return updated_organization

    @service_handler
    async def update_organization_company_overview(
        self,
        organization_id: int,
        company_overview_data: dict,
        user=None,
    ):
        """
        Update only the company overview fields for an organization.
        This method only updates the specific company overview fields without affecting other organization data.
        """
        organization = await self.repo.get_organization(organization_id)
        if not organization:
            raise DataNotFoundException("Organization not found")

        # Update only the company overview fields
        allowed_fields = {
            "company_details",
            "company_representation_agreements",
            "company_acting_as_aggregator",
            "company_additional_notes",
        }

        for key, value in company_overview_data.items():
            if key in allowed_fields and hasattr(organization, key):
                setattr(organization, key, value)

        # Set the update user
        if user:
            organization.update_user = user.keycloak_username

        updated_organization = await self.repo.update_organization(organization)
        return updated_organization

    @service_handler
    async def get_organization(self, organization_id: int):
        """handles fetching an organization"""
        organization = await self.repo.get_organization(organization_id)

        if organization is None:
            raise DataNotFoundException("org not found")

        # Add year-based early issuance for current year
        organization.has_early_issuance = (
            await self.repo.get_current_year_early_issuance(organization_id)
        )

        # Calculate and add balance information for credit trading validation
        organization.total_balance = await self.calculate_total_balance(organization_id)
        organization.reserved_balance = await self.calculate_reserved_balance(
            organization_id
        )

        return organization

    @service_handler
    async def get_penalty_analytics(
        self, organization_id: int
    ) -> PenaltyAnalyticsResponseSchema:
        """
        Assemble penalty analytics data for the organization, combining automatic
        penalties from compliance reports with discretionary penalties from the
        penalty log.
        """

        def _to_float(value) -> float:
            if value is None:
                return 0.0
            if isinstance(value, Decimal):
                return float(value)
            return float(value)

        summaries, penalty_logs = await self.repo.get_penalty_analytics_data(
            organization_id
        )

        yearly_penalties: List[PenaltyYearlySummarySchema] = []
        total_auto_renewable = 0.0
        total_auto_low_carbon = 0.0

        for row in summaries:
            penalty_override_enabled = bool(row.get("penalty_override_enabled"))

            renewable_penalty = (
                _to_float(row.get("renewable_penalty_override"))
                if penalty_override_enabled
                and row.get("renewable_penalty_override") is not None
                else _to_float(row.get("line_11_penalty_gasoline"))
                + _to_float(row.get("line_11_penalty_diesel"))
                + _to_float(row.get("line_11_penalty_jet_fuel"))
            )

            low_carbon_penalty = (
                _to_float(row.get("low_carbon_penalty_override"))
                if penalty_override_enabled
                and row.get("low_carbon_penalty_override") is not None
                else _to_float(row.get("line_21_penalty_payable"))
            )

            compliance_year_value = row.get("compliance_year")
            try:
                compliance_year = (
                    int(compliance_year_value)
                    if compliance_year_value is not None
                    else None
                )
            except (TypeError, ValueError):
                compliance_year = compliance_year_value

            total_automatic = renewable_penalty + low_carbon_penalty
            total_auto_renewable += renewable_penalty
            total_auto_low_carbon += low_carbon_penalty

            yearly_penalties.append(
                PenaltyYearlySummarySchema(
                    compliance_period_id=row.get("compliance_period_id"),
                    compliance_year=compliance_year,
                    auto_renewable=renewable_penalty,
                    auto_low_carbon=low_carbon_penalty,
                    total_automatic=total_automatic,
                )
            )

        penalty_log_entries: List[PenaltyLogEntrySchema] = []
        discretionary_total = 0.0

        for log in penalty_logs:
            penalty_amount = _to_float(log.get("penalty_amount"))
            discretionary_total += penalty_amount

            compliance_year_value = log.get("compliance_year")
            try:
                compliance_year = (
                    int(compliance_year_value)
                    if compliance_year_value is not None
                    else None
                )
            except (TypeError, ValueError):
                compliance_year = compliance_year_value

            penalty_log_entries.append(
                PenaltyLogEntrySchema(
                    penalty_log_id=log.get("penalty_log_id"),
                    compliance_period_id=log.get("compliance_period_id"),
                    compliance_year=compliance_year,
                    contravention_type=log.get("contravention_type"),
                    offence_history=bool(log.get("offence_history")),
                    deliberate=bool(log.get("deliberate")),
                    efforts_to_correct=bool(log.get("efforts_to_correct")),
                    economic_benefit_derived=bool(log.get("economic_benefit_derived")),
                    efforts_to_prevent_recurrence=bool(
                        log.get("efforts_to_prevent_recurrence")
                    ),
                    notes=log.get("notes"),
                    penalty_amount=penalty_amount,
                )
            )

        total_automatic = total_auto_renewable + total_auto_low_carbon

        totals = PenaltyTotalsSchema(
            auto_renewable=total_auto_renewable,
            auto_low_carbon=total_auto_low_carbon,
            discretionary=discretionary_total,
            total_automatic=total_automatic,
            total=total_automatic + discretionary_total,
        )

        return PenaltyAnalyticsResponseSchema(
            yearly_penalties=yearly_penalties,
            totals=totals,
            penalty_logs=penalty_log_entries,
        )

    @service_handler
    async def get_penalty_logs_paginated(
        self, organization_id: int, pagination: PaginationRequestSchema
    ) -> PenaltyLogListResponseSchema:
        pagination = validate_pagination(pagination)

        records, total = await self.repo.get_penalty_logs_paginated(
            organization_id, pagination
        )

        penalty_logs = [
            PenaltyLogEntrySchema(
                penalty_log_id=row["penalty_log_id"],
                compliance_period_id=row["compliance_period_id"],
                compliance_year=row["compliance_year"],
                contravention_type=row["contravention_type"],
                offence_history=bool(row["offence_history"]),
                deliberate=bool(row["deliberate"]),
                efforts_to_correct=bool(row["efforts_to_correct"]),
                economic_benefit_derived=bool(row["economic_benefit_derived"]),
                efforts_to_prevent_recurrence=bool(
                    row["efforts_to_prevent_recurrence"]
                ),
                notes=row["notes"],
                penalty_amount=float(row["penalty_amount"] or 0),
            )
            for row in records
        ]

        total_pages = (
            math.ceil(total / pagination.size) if pagination.size else 1
        ) or 1

        return PenaltyLogListResponseSchema(
            pagination=PaginationResponseSchema(
                total=total,
                page=pagination.page,
                size=pagination.size,
                total_pages=total_pages,
            ),
            penalty_logs=penalty_logs,
        )

    @service_handler
    async def create_penalty_log(
        self,
        organization_id: int,
        payload: PenaltyLogCreateSchema,
    ) -> PenaltyLogEntrySchema:
        penalty_log = await self.repo.create_penalty_log(organization_id, payload)
        return self._map_penalty_log_model(penalty_log)

    @service_handler
    async def update_penalty_log(
        self,
        organization_id: int,
        penalty_log_id: int,
        payload: PenaltyLogUpdateSchema,
    ) -> PenaltyLogEntrySchema:
        existing = await self.repo.get_penalty_log_by_id(
            organization_id, penalty_log_id
        )
        if not existing:
            raise DataNotFoundException("Penalty log not found")

        updated = await self.repo.update_penalty_log(existing, payload)
        return self._map_penalty_log_model(updated)

    @service_handler
    async def delete_penalty_log(
        self, organization_id: int, penalty_log_id: int
    ) -> None:
        existing = await self.repo.get_penalty_log_by_id(
            organization_id, penalty_log_id
        )
        if not existing:
            raise DataNotFoundException("Penalty log not found")

        deleted = await self.repo.delete_penalty_log(organization_id, penalty_log_id)
        if not deleted:
            raise DataNotFoundException("Penalty log not found")
        return None

    @service_handler
    async def get_organizations(
        self, pagination: PaginationRequestSchema = {}
    ) -> List[OrganizationSchema]:
        """handles fetching organizations and providing pagination data"""
        """
        Get all organizations based on the provided filters and pagination.
        This method returns a list of OrganizationSchema objects.
        The OrganizationSchema objects contain the basic organization details,
        including the organization type, organization status, and other relevant fields.
        The pagination object is used to control the number of results returned
        and the page number.
        The filters object is used to filter the results based on specific criteria.
        The OrganizationSchema objects are returned in the order specified by the sortOrders object.
        The total_count field is used to return the total number of organizations that match the filters.
        The OrganizationSchema objects are returned in the order specified by the sortOrders object.

        Args:
            pagination (PaginationRequestSchema, optional): The pagination object containing page and size information. Defaults to {}.

        Returns:
            List[OrganizationSchema]: A list of OrganizationSchema objects containing the basic organization details.
            The total_count field is used to return the total number of organizations that match the filters.
            The OrganizationSchema objects are returned in the order specified by the sortOrders object.

        Raises:
            Exception: If any errors occur during the query execution.
            ValueError: If the provided pagination object is invalid.
        """
        # TODO: Implement Redis cache wherever required
        # TODO: Implement Compliance Units and In Reserve fields once the transactions model is created
        # Apply filters
        conditions = []
        pagination = validate_pagination(pagination)
        if pagination.filters and len(pagination.filters) > 0:
            try:
                self.apply_organization_filters(pagination, conditions)
            except Exception:
                raise ValueError(f"Invalid filter provided: {pagination.filters}.")

        # Apply pagination
        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
        limit = pagination.size

        organizations, total_count = await self.repo.get_organizations_paginated(
            offset, limit, conditions, pagination
        )

        return OrganizationListSchema(
            organizations=organizations,
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
        )

    @service_handler
    async def get_organization_types(self) -> List[OrganizationTypeSchema]:
        """handles fetching all organization types"""
        result = await self.repo.get_organization_types()

        types = [OrganizationTypeSchema.model_validate(types) for types in result]

        if len(types) == 0:
            raise DataNotFoundException("No organization types found")

        return types

    @service_handler
    async def get_organization_names(
        self,
        order_by=("name", "asc"),
        statuses: List[str] = None,
        org_type_filter: str = "fuel_supplier",
        org_filters: Dict[str, List[str]] | None = None,
    ) -> List[OrganizationSummaryResponseSchema]:
        """
        Fetches all organization names and their detailed information, formatted as per OrganizationSummaryResponseSchema.

        Parameters:
            order_by (tuple): Tuple containing the field name to sort by and the direction ('asc' or 'desc').
            statuses (List[str]): List of statuses to filter by. If None, returns all organizations.

        Returns:
            List[OrganizationSummaryResponseSchema]: List of organizations with their summary information.
        """
        conditions = []

        if statuses:
            # If specific statuses are provided, filter by those
            status_enums = [
                OrgStatusEnum(status)
                for status in statuses
                if status in [e.value for e in OrgStatusEnum]
            ]
            if status_enums:
                conditions.append(OrganizationStatus.status.in_(status_enums))

        # The order_by tuple directly specifies both the sort field and direction
        organization_data = await self.repo.get_organization_names(
            conditions, order_by, org_type_filter, org_filters
        )

        return [
            OrganizationSummaryResponseSchema(
                organization_id=org["organization_id"],
                name=org["name"],
                operating_name=org["operating_name"],
                total_balance=org["total_balance"],
                reserved_balance=org["reserved_balance"],
                org_status=org["status"],
                org_type=org.get("org_type"),
            )
            for org in organization_data
        ]

    @service_handler
    async def get_externally_registered_organizations(
        self, org_id: int
    ) -> List[OrganizationSummaryResponseSchema]:
        """handles getting a list of organizations excluding the current organization"""
        conditions = [
            Organization.org_status.has(status="Registered"),
            Organization.organization_id != org_id,
        ]
        results = await self.repo.get_externally_registered_organizations(conditions)

        # Map the results to OrganizationSummaryResponseSchema
        organizations = [
            OrganizationSummaryResponseSchema.model_validate(organization)
            for organization in results
        ]

        if not organizations:
            raise DataNotFoundException("No externally registered organizations found")

        return organizations

    @service_handler
    async def get_organization_statuses(self):
        """handles fetching all organization statuses"""
        statuses = await self.repo.get_organization_statuses()

        if len(statuses) == 0:
            raise DataNotFoundException("No organization statuses found")

        return statuses

    @service_handler
    async def calculate_total_balance(self, organization_id: int) -> int:
        """
        Calculates the total balance for a given organization.

        Args:
            organization_id (int): The ID of the organization.

        Returns:
            int: The total balance of the organization.
        """
        total_balance = await self.transaction_repo.calculate_total_balance(
            organization_id
        )
        return total_balance

    @service_handler
    async def calculate_reserved_balance(self, organization_id: int) -> int:
        """
        Calculates the reserved balance for a given organization.

        Args:
            organization_id (int): The ID of the organization.

        Returns:
            int: The reserved balance of the organization.
        """
        reserved_balance = await self.transaction_repo.calculate_reserved_balance(
            organization_id
        )
        return reserved_balance

    @service_handler
    async def calculate_available_balance(self, organization_id: int) -> int:
        """
        Calculates the available balance for a given organization by subtracting the reserved balance from the total balance.

        Args:
            organization_id (int): The ID of the organization.

        Returns:
            int: The available balance of the organization.
        """
        available_balance = await self.transaction_repo.calculate_available_balance(
            organization_id
        )
        return available_balance

    @service_handler
    async def adjust_balance(
        self,
        transaction_action: TransactionActionEnum,
        compliance_units: int,
        organization_id: int,
    ) -> Transaction:
        """
        Adjusts an organization's balance based on the transaction action.

        Validates the transaction against the organization's current balances before proceeding.
        It raises an error if the requested action violates balance constraints (e.g., attempting to reserve more than the available balance).

        Args:
            transaction_action (TransactionActionEnum): The type of balance adjustment (Adjustment, Reserved, Released).
            compliance_units (int): The number of compliance units involved in the transaction.
            organization_id (int): The ID of the organization whose balance is being adjusted.

        Raises:
            ValueError: If the transaction violates balance constraints.
        """
        if compliance_units == 0:
            raise ValueError("Compliance units cannot be zero.")

        # Retrieve balances
        available_balance = await self.calculate_available_balance(organization_id)
        reserved_balance = await self.calculate_reserved_balance(organization_id)

        # Check constraints based on transaction action
        if transaction_action == TransactionActionEnum.Reserved:
            if compliance_units < 0 and abs(compliance_units) > available_balance:
                raise ValueError("Reserve amount cannot exceed available balance.")
        elif transaction_action == TransactionActionEnum.Released:
            if abs(compliance_units) > reserved_balance:
                raise ValueError("Release amount cannot exceed reserved balance.")
        elif (
            transaction_action == TransactionActionEnum.Adjustment
            and compliance_units < 0
        ):
            if abs(compliance_units) > available_balance:
                raise ValueError("Cannot decrement available balance below zero.")

        # Create a new transaction record in the database
        new_transaction = await self.transaction_repo.create_transaction(
            transaction_action, compliance_units, organization_id
        )

        await self.redis_balance_service.populate_organization_redis_balance(
            organization_id
        )

        return new_transaction

    @service_handler
    async def search_organization_details(
        self, search_query: str
    ) -> List[OrganizationDetailsSchema]:
        """
        Get organizations matching the transaction partner query.
        The organization details include name, full address, email, and phone.
        """
        organizations = await self.repo.search_organizations_by_name(search_query)

        return [
            {
                "name": org.name,
                "address": " ".join(
                    part
                    for part in [
                        org.org_address.street_address,
                        org.org_address.address_other,
                        org.org_address.city,
                        org.org_address.province_state,
                        org.org_address.country,
                        org.org_address.postalCode_zipCode,
                    ]
                    if part
                ),
                "email": org.email,
                "phone": org.phone,
            }
            for org in organizations
        ]

    @service_handler
    async def get_credit_market_listings(self):
        """
        Get organizations that have opted to display in the credit trading market.
        Returns organizations with their credit market contact details for public viewing.
        """
        from .schema import OrganizationCreditMarketListingSchema

        organizations = await self.repo.get_credit_market_organizations()

        return [
            OrganizationCreditMarketListingSchema(
                organization_id=org.organization_id,
                organization_name=org.name,
                credits_to_sell=org.credits_to_sell or 0,
                display_in_credit_market=org.display_in_credit_market,
                credit_market_is_seller=org.credit_market_is_seller or False,
                credit_market_is_buyer=org.credit_market_is_buyer or False,
                credit_market_contact_name=org.credit_market_contact_name,
                credit_market_contact_email=org.credit_market_contact_email,
                credit_market_contact_phone=org.credit_market_contact_phone,
            )
            for org in organizations
        ]

    @service_handler
    async def get_available_forms(self):
        """
        Get available forms for link key generation.
        """
        from .schema import AvailableFormsSchema

        # Get published forms that allow anonymous access
        forms = await self.repo.get_available_forms_for_link_keys()

        return AvailableFormsSchema(
            forms={
                form.form_id: {
                    "id": form.form_id,
                    "name": form.name,
                    "slug": form.slug,
                    "description": form.description,
                }
                for form in forms
            }
        )

    @service_handler
    async def get_organization_link_keys(self, organization_id: int):
        """
        Get all link keys for an organization.
        """
        from .schema import (
            OrganizationLinkKeysListSchema,
            OrganizationLinkKeyResponseSchema,
        )

        organization = await self.repo.get_organization(organization_id)
        if not organization:
            raise DataNotFoundException("Organization not found")

        link_keys = await self.repo.get_organization_link_keys(organization_id)

        link_key_responses = [
            OrganizationLinkKeyResponseSchema(
                link_key_id=lk.link_key_id,
                organization_id=lk.organization_id,
                form_id=lk.form_id,
                form_name=lk.form_name,
                form_slug=lk.form_slug,
                link_key=lk.link_key,
                create_date=lk.create_date,
                update_date=lk.update_date,
            )
            for lk in link_keys
        ]

        return OrganizationLinkKeysListSchema(
            organization_id=organization_id,
            organization_name=organization.name,
            link_keys=link_key_responses,
        )

    @service_handler
    async def generate_link_key(self, organization_id: int, form_id: int, user=None):
        """
        Generate a new secure link key for a specific form.
        """
        from .schema import LinkKeyOperationResponseSchema

        organization = await self.repo.get_organization(organization_id)
        if not organization:
            raise DataNotFoundException("Organization not found")

        # Verify the form exists and allows anonymous access
        form = await self.repo.get_form_by_id(form_id)
        if not form:
            raise DataNotFoundException(f"Form with ID {form_id} not found")

        if not form.allows_anonymous:
            raise ValueError("Form does not support anonymous access")

        # Check if link key already exists for this form
        existing_link_key = await self.repo.get_link_key_by_form_id(
            organization_id, form_id
        )
        if existing_link_key:
            raise ValueError(
                f"Link key already exists for {form.name}. "
                "Please regenerate if you want to replace it."
            )

        # Generate a new secure link key
        new_link_key = generate_secure_link_key()

        # Create new link key record
        link_key_record = OrganizationLinkKey(
            organization_id=organization_id,
            form_id=form_id,
            link_key=new_link_key,
        )

        created_link_key = await self.repo.create_link_key(link_key_record)

        return LinkKeyOperationResponseSchema(
            link_key=created_link_key.link_key,
            form_id=form_id,
            form_name=form.name,
            form_slug=form.slug,
        )

    @service_handler
    async def regenerate_link_key(self, organization_id: int, form_id: int, user=None):
        """
        Regenerate the link key for a specific form.
        This invalidates the previous key and creates a new one.
        """
        from .schema import LinkKeyOperationResponseSchema

        organization = await self.repo.get_organization(organization_id)
        if not organization:
            raise DataNotFoundException("Organization not found")

        # Verify the form exists
        form = await self.repo.get_form_by_id(form_id)
        if not form:
            raise DataNotFoundException(f"Form with ID {form_id} not found")

        # Get existing link key
        existing_link_key = await self.repo.get_link_key_by_form_id(
            organization_id, form_id
        )
        if not existing_link_key:
            raise DataNotFoundException(f"No link key found for {form.name}")

        old_key = existing_link_key.link_key

        # Generate a new secure link key
        new_link_key = generate_secure_link_key()
        existing_link_key.link_key = new_link_key

        updated_link_key = await self.repo.update_link_key(existing_link_key)

        return LinkKeyOperationResponseSchema(
            link_key=updated_link_key.link_key,
            form_id=form_id,
            form_name=form.name,
            form_slug=form.slug,
        )

    @service_handler
    async def validate_link_key(self, link_key: str):
        """
        Validate a link key and return the associated organization and form info.
        Returns detailed validation result including form info and organization info.
        """
        from .schema import LinkKeyValidationSchema

        link_key_record = await self.repo.get_link_key_by_key(link_key)

        if not link_key_record:
            return LinkKeyValidationSchema(
                organization_id=0,
                form_id=0,
                form_name="Unknown",
                form_slug="unknown",
                organization_name="",
                is_valid=False,
            )

        return LinkKeyValidationSchema(
            organization_id=link_key_record.organization_id,
            form_id=link_key_record.form_id,
            form_name=link_key_record.form_name,
            form_slug=link_key_record.form_slug,
            organization_name=link_key_record.organization.name,
            is_valid=True,
        )

    async def _send_credit_market_notification(
        self, organization: Organization, user=None
    ):
        """
        Send notification to subscribed BCeID users when new credits are listed for sale.
        """
        try:
            # Create notification message with organization and credit details
            message_data = {
                "organizationName": organization.name,
                "creditsToSell": organization.credits_to_sell,
                "service": "CreditMarket",
                "action": "CreditsListedForSale",
            }

            # Create notification data
            notification_data = NotificationMessageSchema(
                type="Credit market - credits listed for sale",
                related_transaction_id=f"CM{organization.organization_id}",
                message=json.dumps(message_data),
                related_organization_id=organization.organization_id,
                origin_user_profile_id=user.user_profile_id if user else None,
            )

            # Send notification to all subscribed BCeID users
            await self.notification_service.send_notification(
                NotificationRequestSchema(
                    notification_types=[
                        NotificationTypeEnum.BCEID__CREDIT_MARKET__CREDITS_LISTED_FOR_SALE
                    ],
                    notification_context={
                        "subject": f"LCFS Credit Market - New Credits Available from {organization.name}"
                    },
                    notification_data=notification_data,
                )
            )

            logger.info(
                f"Credit market notification sent for organization {organization.organization_id}"
            )

        except Exception as e:
            logger.error(f"Failed to send credit market notification: {str(e)}")
            # Don't raise the exception - notification failure shouldn't break the main operation
