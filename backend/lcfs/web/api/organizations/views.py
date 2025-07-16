import structlog
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, status, Request, Query
from fastapi.responses import StreamingResponse
from fastapi_cache.decorator import cache
from starlette import status

from lcfs.db import dependencies

from lcfs.web.core.decorators import view_handler
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.db.models.organization.OrganizationStatus import OrgStatusEnum

from .services import OrganizationsService
from .schema import (
    OrganizationTypeSchema,
    OrganizationStatusSchema,
    OrganizationListSchema,
    OrganizationCreateSchema,
    OrganizationResponseSchema,
    OrganizationSummaryResponseSchema,
    OrganizationBalanceResponseSchema,
    OrganizationUpdateSchema,
    OrganizationDetailsSchema,
)
from lcfs.db.models.user.Role import RoleEnum


logger = structlog.get_logger(__name__)
router = APIRouter()
get_async_db = dependencies.get_async_db_session


@router.get("/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.GOVERNMENT])
async def export_organizations(
    request: Request, service: OrganizationsService = Depends()
):
    """
    Endpoint to export information of all organizations

    This endpoint can support exporting data in different file formats (xls, xlsx, csv)
    as specified by the 'export_format' and 'media_type' variables.
    - 'export_format' specifies the file format: options are 'xls', 'xlsx', and 'csv'.
    - 'media_type' sets the appropriate MIME type based on 'export_format':
        'application/vnd.ms-excel' for 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' for 'xlsx',
        'text/csv' for 'csv'.

    The SpreadsheetBuilder class is used for building the spreadsheet.
    It allows adding multiple sheets with custom styling options and exports them as a byte stream.
    Also, an example of how to use the SpreadsheetBuilder is provided in its class documentation.

    Note: Only the first sheet data is used for the CSV format,
        as CSV files do not support multiple sheets.
    """
    return await service.export_organizations()


@router.post(
    "/create",
    response_model=OrganizationResponseSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR])
async def create_organization(
    request: Request,
    organization_data: OrganizationCreateSchema,
    service: OrganizationsService = Depends(),
):
    """
    Endpoint to create a new organization. This includes processing the provided
    organization details along with associated addresses.
    """
    return await service.create_organization(organization_data, request.user)


@router.get(
    "/search",
    response_model=List[OrganizationDetailsSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def search_organizations(
    request: Request,
    org_name: str = Query(
        ..., min_length=3, description="Company name or operating name"
    ),
    service: OrganizationsService = Depends(),
):
    """
    Search for organizations based on a query string.
    Returns a list of organizations with their names and formatted addresses.
    """
    return await service.search_organization_details(org_name)


@router.get(
    "/{organization_id}",
    response_model=OrganizationResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_organization(
    request: Request, organization_id: int, service: OrganizationsService = Depends()
):
    """Fetch a single organization by id"""
    return await service.get_organization(organization_id)


@router.put("/{organization_id}")
@view_handler([RoleEnum.GOVERNMENT])
async def update_organization(
    request: Request,
    organization_id: int,
    organization_data: OrganizationUpdateSchema,
    service: OrganizationsService = Depends(),
):
    """Update an organizations data by id"""
    return await service.update_organization(organization_id, organization_data, request.user)


@router.post("/", response_model=OrganizationListSchema, status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.GOVERNMENT])
async def get_organizations(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: OrganizationsService = Depends(),
):
    """Fetch a list of organizations"""

    return await service.get_organizations(pagination)


@router.get(
    "/statuses/",
    response_model=List[OrganizationStatusSchema],
    status_code=status.HTTP_200_OK,
)
@cache(expire=60 * 60 * 24)  # cache for 24 hours
@view_handler(["*"])
async def get_organization_statuses(
    request: Request, service: OrganizationsService = Depends()
) -> List[OrganizationStatusSchema]:
    """Fetch all organization statuses"""
    return await service.get_organization_statuses()


@router.get(
    "/types/",
    response_model=List[OrganizationTypeSchema],
    status_code=status.HTTP_200_OK,
)
@cache(expire=60 * 60 * 24)  # cache for 24 hours
@view_handler(["*"])
async def get_organization_types(
    request: Request, service: OrganizationsService = Depends()
) -> List[OrganizationTypeSchema]:
    """Fetch all organization types"""
    return await service.get_organization_types()


@router.get(
    "/names/",
    response_model=List[OrganizationSummaryResponseSchema],
    status_code=status.HTTP_200_OK,
)
@cache(expire=1)  # Cache for 1 hour
@view_handler(
    [RoleEnum.GOVERNMENT]
)  # Ensure only government can access this endpoint because it returns balances
async def get_organization_names(
    request: Request,
    statuses: Optional[List[str]] = Query(None),
    service: OrganizationsService = Depends(),
):
    """Fetch all organization names."""
    order_by = ("name", "asc")
    return await service.get_organization_names(order_by, statuses)


@router.get(
    "/registered/external",
    response_model=List[OrganizationSummaryResponseSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_externally_registered_organizations(
    request: Request, service: OrganizationsService = Depends()
):
    """
    Retrieve a list of registered organizations, excluding the specified organization.

    Args:
        org_id (int): The ID of the organization to be excluded from the list.

    Returns:
        List[OrganizationSummaryResponseSchema]: A list of OrganizationSummaryResponseSchema objects
            representing registered organizations, excluding the specified organization.

    Raises:
        Exception: If an error occurs during the database query.
    """
    return await service.get_externally_registered_organizations(
        org_id=request.user.organization_id
    )


@router.get(
    "/balances/{organization_id}",
    response_model=OrganizationBalanceResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def get_balances(
    request: Request, organization_id: int, service: OrganizationsService = Depends()
):
    """
    Retrieve the total and reserved balances for a specific organization identified by its ID.
    """
    total_balance = await service.calculate_total_balance(organization_id)
    reserved_balance = await service.calculate_reserved_balance(organization_id)
    organization = await service.get_organization(organization_id)

    return OrganizationBalanceResponseSchema(
        organization_id=organization_id,
        name=organization.name,
        registered=(
            True
            if organization.org_status.status == OrgStatusEnum.Registered
            else False
        ),
        total_balance=total_balance,
        reserved_balance=reserved_balance,
    )


@router.get(
    "/current/balances",
    response_model=OrganizationBalanceResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_balances(request: Request, service: OrganizationsService = Depends()):
    """
    Retrieve the total and reserved balances for a specific organization identified by its ID.
    """
    org_id = request.user.organization_id
    total_balance = await service.calculate_total_balance(org_id)
    reserved_balance = await service.calculate_reserved_balance(org_id)
    organization = await service.get_organization(org_id)

    return OrganizationBalanceResponseSchema(
        organization_id=org_id,
        name=organization.name,
        registered=(
            True
            if organization.org_status.status == OrgStatusEnum.Registered
            else False
        ),
        total_balance=total_balance,
        reserved_balance=reserved_balance,
    )
