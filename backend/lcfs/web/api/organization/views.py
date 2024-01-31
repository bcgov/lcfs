from logging import getLogger
from typing import List

from fastapi import APIRouter, Body, Depends, status, Request
from fastapi.responses import StreamingResponse
from fastapi_cache.decorator import cache
from starlette import status

from lcfs.db import dependencies

from lcfs.web.core.decorators import roles_required, view_handler
from lcfs.web.api.base import PaginationRequestSchema

from .services import OrganizationServices
from .schema import (
    MiniOrganization,
    OrganizationSchema,
    OrganizationSummarySchema,
    OrganizationCreateSchema,
    OrganizationStatusBase,
    OrganizationTypeBase,
    OrganizationUpdateSchema,
    GetOrganizationResponse,
    Organizations,
)


logger = getLogger("organization")
router = APIRouter()
get_async_db = dependencies.get_async_db_session


@router.get("/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK)
@roles_required("Government")
@view_handler
async def export_organizations(
    request: Request,
    service: OrganizationServices = Depends()
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


@router.post("/create", response_model=OrganizationSchema, status_code=status.HTTP_201_CREATED)
@roles_required("Government", "Administrator")
async def create_organization(
    request: Request,
    organization_data: OrganizationCreateSchema,
    service: OrganizationServices = Depends()
):
    """
    Endpoint to create a new organization. This includes processing the provided
    organization details along with associated addresses.
    """
    return await service.create_organization(organization_data)


@router.get(
    "/{organization_id}",
    response_model=GetOrganizationResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler
async def get_organization(
    request: Request,
    organization_id: int,
    service: OrganizationServices = Depends()
):
    '''Fetch a single organization by id'''
    return await service.get_organization(organization_id)


@router.put("/{organization_id}", response_model=OrganizationSchema)
@view_handler
async def update_organization(
    request: Request,
    organization_id: int,
    organization_data: OrganizationUpdateSchema,
    service: OrganizationServices = Depends()
):
    '''Update an organizations data by id'''
    return await service.update_organization(organization_id, organization_data)


@router.post("/", response_model=Organizations, status_code=status.HTTP_200_OK)
@roles_required("Government")
@view_handler
async def get_organizations(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: OrganizationServices = Depends()
):
    '''Fetch a list of organizations'''
    return await service.get_organizations(pagination)


@router.get(
    "/statuses/",
    response_model=List[OrganizationStatusBase],
    status_code=status.HTTP_200_OK,
)
@cache(expire=60 * 60 * 24)  # cache for 24 hours
@view_handler
async def get_organization_statuses(
    service: OrganizationServices = Depends()
) -> List[OrganizationStatusBase]:
    '''Fetch all organization statuses'''
    return await service.get_organization_statuses()


@router.get(
    "/types/",
    response_model=List[OrganizationTypeBase],
    status_code=status.HTTP_200_OK,
)
@cache(expire=60 * 60 * 24)  # cache for 24 hours
@view_handler
async def get_organization_types(
    service: OrganizationServices = Depends()
) -> List[OrganizationTypeBase]:
    '''Fetch all organization types'''
    return await service.get_organization_types()


@router.get(
    "/names/", response_model=List[MiniOrganization], status_code=status.HTTP_200_OK
)
@cache(expire=60 * 60)  # cache for 1 hour
@view_handler
async def get_organization_names(service: OrganizationServices = Depends()):
    '''Fetch all organization names'''
    return await service.get_organization_names()


@router.get("/registered/external", response_model=List[OrganizationSummarySchema], status_code=status.HTTP_200_OK)
@view_handler
async def get_externally_registered_organizations(
    request: Request,
    service: OrganizationServices = Depends()
):
    """
    Retrieve a list of registered organizations, excluding the specified organization.

    Args:
        org_id (int): The ID of the organization to be excluded from the list.

    Returns:
        List[OrganizationSummarySchema]: A list of OrganizationSummarySchema objects
            representing registered organizations, excluding the specified organization.

    Raises:
        Exception: If an error occurs during the database query.
    """
    return await service.get_externally_registered_organizations(org_id=request.user.organization_id)
