import io
import math
from datetime import datetime, timezone
from typing import Dict, List

import structlog
from fastapi import Depends, Request
from fastapi.responses import StreamingResponse
from fastapi_cache import FastAPICache

from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.organization.OrganizationAddress import OrganizationAddress
from lcfs.db.models.organization.OrganizationAttorneyAddress import (
    OrganizationAttorneyAddress,
)
from lcfs.db.models.organization.OrganizationStatus import (
    OrganizationStatus,
    OrgStatusEnum,
)
from lcfs.db.models.organization.OrganizationType import OrganizationType
from lcfs.db.models.transaction import Transaction
from lcfs.db.models.transaction.Transaction import TransactionActionEnum
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder, SpreadsheetColumn
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    apply_filter_conditions,
    get_field_for_filter,
    validate_pagination,
)
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

from .repo import OrganizationsRepository
from .schema import (
    OrganizationCreateSchema,
    OrganizationDetailsSchema,
    OrganizationListSchema,
    OrganizationSchema,
    OrganizationSummaryResponseSchema,
    OrganizationTypeSchema,
    OrganizationUpdateSchema,
)


logger = structlog.get_logger(__name__)


class OrganizationsService:
    def __init__(
        self,
        request: Request = None,
        repo: OrganizationsRepository = Depends(OrganizationsRepository),
        transaction_repo: TransactionRepository = Depends(TransactionRepository),
    ) -> None:
        self.request = (request,)
        self.repo = repo
        self.transaction_repo = transaction_repo

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

            field_name = filter.field
            if field_name == "hasEarlyIssuance":
                field_name = "has_early_issuance"

            if field_name == "has_early_issuance":
                early_issuance_field = self.repo.get_early_issuance_field()
                conditions.append(
                    apply_filter_conditions(
                        early_issuance_field, filter_value, filter_option, filter_type
                    )
                )
                continue

            if field_name == "registration_status":
                if isinstance(filter_value, bool):
                    is_registered = filter_value
                elif isinstance(filter_value, str):
                    is_registered = filter_value.lower() == "true"
                else:
                    continue

                field = get_field_for_filter(OrganizationStatus, "status")
                if is_registered:
                    conditions.append(field == "Registered")
                else:
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

        current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

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
        requires_bceid = await self._requires_bceid(
            organization_data.organization_type_id
        )

        org_address = None
        org_attorney_address = None

        if requires_bceid:
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

            if not organization_data.email:
                raise ValueError("Email is required for all organization types")

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

        requires_bceid = await self._requires_bceid(
            organization_data.organization_type_id
        )

        if (
            hasattr(organization_data, "has_early_issuance")
            and organization_data.has_early_issuance is not None
        ):
            from lcfs.utils.constants import LCFS_Constants

            current_year = LCFS_Constants.get_current_compliance_year()

            current_setting = await self.repo.get_current_year_early_issuance(
                organization_id
            )

            if current_setting != organization_data.has_early_issuance:
                await self.repo.update_early_issuance_by_year(
                    organization_id,
                    current_year,
                    organization_data.has_early_issuance,
                    user,
                )

        for key, value in organization_data.dict().items():
            if key == "has_early_issuance":
                continue
            if hasattr(organization, key):
                setattr(organization, key, value)

        if (
            not requires_bceid
            and organization_data.email is not None
            and not organization_data.email
        ):
            raise ValueError("Email is required for all organization types")

        if organization_data.address:
            if requires_bceid and not hasattr(
                organization_data.address, "street_address"
            ):
                raise ValueError("Address is required for BCeID organization types")

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
            if requires_bceid and not hasattr(
                organization_data.attorney_address, "street_address"
            ):
                raise ValueError(
                    "Attorney address is required for BCeID organization types"
                )

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

        allowed_fields = {
            "company_details",
            "company_representation_agreements",
            "company_acting_as_aggregator",
            "company_additional_notes",
        }

        for key, value in company_overview_data.items():
            if key in allowed_fields and hasattr(organization, key):
                setattr(organization, key, value)

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

        organization.has_early_issuance = (
            await self.repo.get_current_year_early_issuance(organization_id)
        )

        organization.total_balance = await self.calculate_total_balance(organization_id)
        organization.reserved_balance = await self.calculate_reserved_balance(
            organization_id
        )

        return organization

    @service_handler
    async def get_early_issuance_for_year(
        self, organization_id: int, compliance_year: str
    ) -> bool:
        """
        Check if an organization has early issuance enabled for a specific compliance year.
        Used to determine if an organization can create compliance reports for future years.

        TEMPORARY SOLUTION - Issue #3730
        This method is part of a temporary approach to gate 2026 compliance year access.
        A more robust long-term solution should be implemented to support future years
        dynamically (e.g., database-driven configuration per compliance period).
        """
        early_issuance = await self.repo.get_early_issuance_by_year(
            organization_id, compliance_year
        )
        return early_issuance.has_early_issuance if early_issuance else False

    @service_handler
    async def get_organizations(
        self, pagination: PaginationRequestSchema = {}
    ) -> List[OrganizationSchema]:
        """handles fetching organizations and providing pagination data"""
        # TODO: Implement Redis cache wherever required
        # TODO: Implement Compliance Units and In Reserve fields once the transactions model is created
        conditions = []
        pagination = validate_pagination(pagination)
        if pagination.filters and len(pagination.filters) > 0:
            try:
                self.apply_organization_filters(pagination, conditions)
            except Exception:
                raise ValueError(f"Invalid filter provided: {pagination.filters}.")

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
            status_enums = [
                OrgStatusEnum(status)
                for status in statuses
                if status in [e.value for e in OrgStatusEnum]
            ]
            if status_enums:
                conditions.append(OrganizationStatus.status.in_(status_enums))

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
        """
        return await self.transaction_repo.calculate_total_balance(organization_id)

    @service_handler
    async def calculate_reserved_balance(self, organization_id: int) -> int:
        """
        Calculates the reserved balance for a given organization.
        """
        return await self.transaction_repo.calculate_reserved_balance(organization_id)

    @service_handler
    async def calculate_available_balance(self, organization_id: int) -> int:
        """
        Calculates the available balance for a given organization by subtracting the reserved balance from the total balance.
        """
        return await self.transaction_repo.calculate_available_balance(organization_id)

    @service_handler
    async def calculate_available_balance_for_period(
        self, organization_id: int, compliance_period: int
    ) -> int:
        """
        Calculates the available balance for a given organization that existed on or before the March 31 compliance deadline for a reporting year.
        """
        return await self.transaction_repo.calculate_available_balance_for_period(
            organization_id, compliance_period
        )

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
        """
        if compliance_units == 0:
            raise ValueError("Compliance units cannot be zero.")

        available_balance = await self.calculate_available_balance(organization_id)
        reserved_balance = await self.calculate_reserved_balance(organization_id)

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

        new_transaction = await self.transaction_repo.create_transaction(
            transaction_action, compliance_units, organization_id
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
