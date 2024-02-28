import io
import random
import math
from datetime import datetime
from logging import getLogger
from typing import List

from fastapi import Depends, Request
from fastapi.responses import StreamingResponse

from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    apply_filter_conditions,
    get_field_for_filter,
    validate_pagination,
)

from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder
from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.db.models.OrganizationAddress import OrganizationAddress
from lcfs.db.models.OrganizationStatus import OrganizationStatus
from lcfs.db.models.OrganizationAttorneyAddress import OrganizationAttorneyAddress
from lcfs.db.models.Organization import Organization

from .repo import OrganizationRepository
from .schema import (
    OrganizationTypeSchema,
    OrganizationSchema,
    OrganizationListSchema,
    OrganizationCreateSchema,
    OrganizationSummaryResponseSchema
)


logger = getLogger("organizations_repo")


class OrganizationServices:
    def __init__(
        self,
        request: Request = None,
        repo: OrganizationRepository = Depends(OrganizationRepository)
    ) -> None:
        self.repo = repo
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

    @service_handler
    async def export_organizations(self) -> StreamingResponse:
        '''
        Prepares a list of organizations in a .xls file that is downloadable
        '''
        organizations = await self.repo.get_organizations()

        data = [
            [
                organization.organization_id,
                organization.name,
                # TODO: Update this section with actual data retrieval
                # once the Compliance Units models are implemented.
                123456,
                123456,
                organization.org_status.status.value
            ]
            for organization in organizations
        ]

        export_format = "xls"

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
            io.BytesIO(file_content), media_type=FILE_MEDIA_TYPE.XLS, headers=headers
        )

    @service_handler
    async def create_organization(self, organization_data: OrganizationCreateSchema):
        '''handles creating an organization'''
        org_address = OrganizationAddress(
            **organization_data.address.dict())
        org_attorney_address = OrganizationAttorneyAddress(
            **organization_data.attorney_address.dict()
        )

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

        return await self.repo.create_organization(org_model)

    @service_handler
    async def update_organization(self, organization_id: int, organization_data: OrganizationCreateSchema):
        '''handles updating an organization'''

        organization = await self.repo.get_organization(organization_id)

        if not organization:
            raise DataNotFoundException("Organization not found")

        for key, value in organization_data.dict().items():
            if hasattr(organization, key):
                setattr(organization, key, value)

        if organization.organization_address_id:
            org_address = await self.repo.get_organization_address(organization.organization_address_id)

            if not org_address:
                raise DataNotFoundException("Organization address not found")

            for key, value in organization_data.address.dict().items():
                if hasattr(org_address, key):
                    setattr(org_address, key, value)

        if organization.organization_attorney_address_id:
            org_attorney_address = await self.repo.get_organization_attorney_address(organization.organization_attorney_address_id)

            if not org_attorney_address:
                raise DataNotFoundException(
                    "Organization attorney address not found")

            for key, value in organization_data.attorney_address.dict().items():
                if hasattr(org_attorney_address, key):
                    setattr(org_attorney_address, key, value)

        return organization

    @service_handler
    async def get_organization(self, organization_id: int):
        '''handles fetching an organization'''
        organization = await self.repo.get_organization(organization_id)

        if organization is None:
            raise DataNotFoundException("org not found")

        return organization

    @service_handler
    async def get_organizations(
        self, pagination: PaginationRequestSchema = {}
    ) -> List[OrganizationSchema]:
        '''handles fetching organizations and providing pagination data'''
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
                self.apply_filters(pagination, conditions)
            except Exception:
                raise ValueError(
                    f"Invalid filter provided: {pagination.filters}."
                )

        # Apply pagination
        offset = (
            0 if (pagination.page < 1) else (
                pagination.page - 1) * pagination.size
        )
        limit = pagination.size

        organizations, total_count = await self.repo.get_organizations_paginated(offset, limit, conditions, pagination)

        if not organizations:
            raise DataNotFoundException('Organizations not found')

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
        '''handles fetching all organization types'''
        result = await self.repo.get_organization_types()

        types = [OrganizationTypeSchema.model_validate(
            types) for types in result]

        if len(types) == 0:
            raise DataNotFoundException("No organization types found")

        return types

    @service_handler
    async def get_organization_names(self) -> List[OrganizationSummaryResponseSchema]:
        """
        handles fetching all organization names
        """
        results = await self.repo.get_organization_names()
        names = []

        for id, name in results:
            names.append(
                OrganizationSummaryResponseSchema.model_validate(
                    {
                        "name": name,
                        "organization_id": id,
                        # TODO: implement balance query
                        "balance": random.randint(0, 9),
                    }
                )
            )

        if len(names) == 0:
            raise DataNotFoundException("No organization names found")

        # TODO: Implement for All Organizations and Balance calculation for it.
        names.append(
            OrganizationSummaryResponseSchema.model_validate(
                {
                    "organization_id": 0,
                    "name": "All Organizations",
                    "balance": 0,
                }
            )
        )

        return names

    @service_handler
    async def get_externally_registered_organizations(
        self, org_id: int
    ) -> List[OrganizationSummaryResponseSchema]:
        '''handles getting a list of organizations excluding the current organization'''
        conditions = [Organization.org_status.has(status='Registered'),
                      Organization.organization_id != org_id]
        results = await self.repo.get_externally_registered_organizations(conditions)

        # Map the results to OrganizationSummaryResponseSchema
        organizations = [OrganizationSummaryResponseSchema.model_validate(organization)
                         for organization in results]

        if not organizations:
            raise DataNotFoundException(
                "No externally registered organizations found")

        return organizations

    @service_handler
    async def get_organization_statuses(self):
        '''handles fetching all organization statuses'''
        statuses = await self.repo.get_organization_statuses()

        if len(statuses) == 0:
            raise DataNotFoundException("No organization statuses found")

        return statuses
