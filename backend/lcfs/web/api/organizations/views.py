import structlog
from typing import Dict, List, Optional

from fastapi import APIRouter, Body, Depends, status, Request, Query, HTTPException, Response
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
    OrganizationCreditMarketUpdateSchema,
    OrganizationCreditMarketListingSchema,
    OrganizationCompanyOverviewUpdateSchema,
    OrganizationLinkKeyCreateSchema,
    OrganizationLinkKeysListSchema,
    LinkKeyOperationResponseSchema,
    LinkKeyValidationSchema,
    AvailableFormsSchema,
    PenaltyAnalyticsResponseSchema,
    PenaltyLogListResponseSchema,
    PenaltyLogCreateSchema,
    PenaltyLogUpdateSchema,
    PenaltyLogEntrySchema,
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
        ..., min_length=1, description="Company name or operating name"
    ),
    service: OrganizationsService = Depends(),
):
    """
    Search for organizations based on a query string.
    Returns a list of organizations with their names and formatted addresses.
    """
    return await service.search_organization_details(org_name)


@router.get(
    "/credit-market-listings",
    response_model=List[OrganizationCreditMarketListingSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_credit_market_listings(
    request: Request, service: OrganizationsService = Depends()
):
    """
    Fetch organizations that have opted to display in the credit trading market.
    Returns organizations with credit market details for public visibility.
    """
    return await service.get_credit_market_listings()


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


@router.get(
    "/{organization_id}/penalties/analytics",
    response_model=PenaltyAnalyticsResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.SUPPLIER])
async def get_penalty_analytics(
    request: Request, organization_id: int, service: OrganizationsService = Depends()
):
    """
    Retrieve penalty analytics (automatic and discretionary) for the specified organization.
    """
    return await service.get_penalty_analytics(organization_id)


@router.post(
    "/{organization_id}/penalties/logs/list",
    response_model=PenaltyLogListResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.SUPPLIER])
async def get_penalty_logs(
    request: Request,
    organization_id: int,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: OrganizationsService = Depends(),
):
    """Fetch paginated penalty log entries for an organization."""
    return await service.get_penalty_logs_paginated(organization_id, pagination)


@router.post(
    "/{organization_id}/penalties/logs",
    response_model=PenaltyLogEntrySchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.GOVERNMENT])
async def create_penalty_log(
    request: Request,
    organization_id: int,
    penalty_data: PenaltyLogCreateSchema,
    service: OrganizationsService = Depends(),
):
    return await service.create_penalty_log(organization_id, penalty_data)


@router.put(
    "/{organization_id}/penalties/logs/{penalty_log_id}",
    response_model=PenaltyLogEntrySchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def update_penalty_log(
    request: Request,
    organization_id: int,
    penalty_log_id: int,
    penalty_data: PenaltyLogUpdateSchema,
    service: OrganizationsService = Depends(),
):
    return await service.update_penalty_log(
        organization_id, penalty_log_id, penalty_data
    )


@router.delete(
    "/{organization_id}/penalties/logs/{penalty_log_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@view_handler([RoleEnum.GOVERNMENT])
async def delete_penalty_log(
    request: Request,
    organization_id: int,
    penalty_log_id: int,
    service: OrganizationsService = Depends(),
):
    await service.delete_penalty_log(organization_id, penalty_log_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{organization_id}")
@view_handler([RoleEnum.GOVERNMENT])
async def update_organization(
    request: Request,
    organization_id: int,
    organization_data: OrganizationUpdateSchema,
    service: OrganizationsService = Depends(),
):
    """Update an organizations data by id"""
    return await service.update_organization(
        organization_id, organization_data, request.user
    )


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


def _extract_org_filters(request: Request) -> Dict[str, List[str]]:
    reserved_params = {"statuses"}
    filters: Dict[str, List[str]] = {}
    for key, value in request.query_params.multi_items():
        if key in reserved_params:
            continue
        filters.setdefault(key, []).append(value)
    return filters


async def _fetch_organization_names(
    request: Request,
    service: OrganizationsService,
    statuses: Optional[List[str]],
    org_filter: str,
):
    order_by = ("name", "asc")
    org_filters = _extract_org_filters(request)
    return await service.get_organization_names(
        order_by, statuses, org_filter, org_filters or None
    )


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
    """Fetch fuel supplier organization names by default."""
    return await _fetch_organization_names(
        request, service, statuses, org_filter="fuel_supplier"
    )


@router.get(
    "/names/{org_filter}",
    response_model=List[OrganizationSummaryResponseSchema],
    status_code=status.HTTP_200_OK,
)
@cache(expire=1)  # Cache for 1 hour
@view_handler([RoleEnum.GOVERNMENT])
async def get_organization_names_by_filter(
    request: Request,
    org_filter: str,
    statuses: Optional[List[str]] = Query(None),
    service: OrganizationsService = Depends(),
):
    """
    Fetch organization names for a specified organization type. Use 'all' to include every type.
    """
    return await _fetch_organization_names(request, service, statuses, org_filter)


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


@router.put(
    "/current/credit-market",
    response_model=OrganizationResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER])
async def update_current_org_credit_market_details(
    request: Request,
    credit_market_data: OrganizationCreditMarketUpdateSchema,
    service: OrganizationsService = Depends(),
):
    """
    Update credit market contact details for the current user's organization.
    This endpoint allows BCeID users to update their organization's credit trading market contact information.
    """
    organization_id = request.user.organization_id
    if not organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with an organization",
        )

    # Use the dedicated method to update only credit market fields
    return await service.update_organization_credit_market_details(
        organization_id, credit_market_data.model_dump(exclude_unset=True), request.user
    )


@router.put(
    "/{organization_id}/company-overview",
    response_model=OrganizationResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ANALYST, RoleEnum.COMPLIANCE_MANAGER, RoleEnum.DIRECTOR])
async def update_company_overview(
    request: Request,
    organization_id: int,
    company_overview_data: OrganizationCompanyOverviewUpdateSchema,
    service: OrganizationsService = Depends(),
):
    """
    Update company overview details for an organization.
    This endpoint allows analysts, managers, and directors to update company overview information.
    """
    return await service.update_organization_company_overview(
        organization_id, company_overview_data.model_dump(exclude_unset=True), request.user
    )


@router.get(
    "/{organization_id}/forms",
    response_model=AvailableFormsSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ANALYST])
async def get_available_forms(
    request: Request,
    organization_id: int,
    service: OrganizationsService = Depends(),
):
    """
    Get available forms for link key generation.
    """
    return await service.get_available_forms()


@router.get(
    "/{organization_id}/link-keys",
    response_model=OrganizationLinkKeysListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ANALYST])
async def get_organization_link_keys(
    request: Request,
    organization_id: int,
    service: OrganizationsService = Depends(),
):
    """
    Get all link keys for an organization.
    """
    return await service.get_organization_link_keys(organization_id)


@router.post(
    "/{organization_id}/link-keys",
    response_model=LinkKeyOperationResponseSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.ANALYST])
async def generate_organization_link_key(
    request: Request,
    organization_id: int,
    link_key_data: OrganizationLinkKeyCreateSchema,
    service: OrganizationsService = Depends(),
):
    """
    Generate a new secure link key for a specific form type.
    """
    return await service.generate_link_key(
        organization_id, link_key_data.form_id, request.user
    )


@router.put(
    "/{organization_id}/link-keys/{form_id}",
    response_model=LinkKeyOperationResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ANALYST])
async def regenerate_organization_link_key(
    request: Request,
    organization_id: int,
    form_id: int,
    service: OrganizationsService = Depends(),
):
    """
    Regenerate the link key for a specific form.
    This invalidates the previous key and creates a new one.
    """
    return await service.regenerate_link_key(organization_id, form_id, request.user)


@router.get(
    "/validate-link-key/{link_key}",
    response_model=LinkKeyValidationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])  # Allow anonymous access
async def validate_link_key(
    request: Request,
    link_key: str,
    service: OrganizationsService = Depends(),
):
    """
    Validate a link key and return the associated organization and form type.
    Returns 404 if the key is invalid or inactive.
    """
    result = await service.validate_link_key(link_key)
    if not result.is_valid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or expired link key"
        )
    return result
