"""Charging Site API."""

from typing import List, Optional, Union
from fastapi import (
    APIRouter,
    Body,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from lcfs.web.api.base import FilterModel, PaginationRequestSchema, SortOrder
from lcfs.web.api.charging_site.schema import (
    ChargingSiteCreateSchema,
    ChargingSiteSchema,
    ChargingSitesSchema,
    CommonPaginatedCSRequestSchema,
    DeleteChargingSiteResponseSchema,
)
from lcfs.web.api.charging_site.services import ChargingSiteService
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db import dependencies
from lcfs.web.api.fuel_code.schema import EndUserTypeSchema
from lcfs.web.core.decorators import view_handler
import structlog

router = APIRouter()
logger = structlog.get_logger(__name__)
get_async_db = dependencies.get_async_db_session


@router.get(
    "/intended-users",
    response_model=List[EndUserTypeSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_intended_users(
    request: Request,
    service: ChargingSiteService = Depends(),
) -> List[EndUserTypeSchema]:
    """
    Endpoint to get a list of intended users
    """
    return await service.get_intended_user_types()


@router.post(
    "/organization/{organization_id}/list-all",
    response_model=ChargingSitesSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_charging_sites(
    request: Request,
    organization_id: int,
    request_data: CommonPaginatedCSRequestSchema = Body(...),
    response: Response = None,
    service: ChargingSiteService = Depends(),
) -> ChargingSitesSchema:
    """
    Endpoint to get list of charging_sites for the given organization
    """
    try:

        if hasattr(request_data, "page") and request_data.page is not None:
            # Handle pagination
            pagination = PaginationRequestSchema(
                page=request_data.page,
                size=request_data.size,
                sort_orders=request_data.sort_orders,
                filters=request_data.filters,
            )
            return await service.get_charging_sites_paginated(
                pagination, organization_id
            )
        else:
            return await service.get_cs_list(organization_id)
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        logger.exception("Error occurred", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your request",
        )


@router.post(
    "/organization/{organization_id}/save",
    response_model=Union[ChargingSiteSchema, DeleteChargingSiteResponseSchema],
    status_code=status.HTTP_201_CREATED,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.ANALYST]
)
async def create_charging_site_row(
    request: Request,
    organization_id: int,
    request_data: ChargingSiteCreateSchema = Body(...),
    cs_service: ChargingSiteService = Depends(),
):
    """Endpoint to create single charging site row"""
    # Create new charging site row
    return await cs_service.create_charging_site(request_data, organization_id)


@router.put(
    "/organization/{organization_id}/save/{chargingSiteId}",
    response_model=Union[ChargingSiteSchema, DeleteChargingSiteResponseSchema],
    status_code=status.HTTP_201_CREATED,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.ANALYST]
)
async def update_charging_site_row(
    request: Request,
    organization_id: int,
    charging_site_id: int,
    request_data: ChargingSiteCreateSchema = Body(...),
    cs_service: ChargingSiteService = Depends(),
):
    """Endpoint to create single charging site row"""
    # Update existing charging site row
    return await cs_service.update_charging_site(request_data)


@router.delete(
    "/organization/{organization_id}/save/{charging_site_id}",
    response_model=Union[ChargingSiteSchema, DeleteChargingSiteResponseSchema],
    status_code=status.HTTP_201_CREATED,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.ANALYST]
)
async def delete_charging_site_row(
    request: Request,
    organization_id: int,
    charging_site_id: int,
    request_data: ChargingSiteCreateSchema = Body(...),
    cs_service: ChargingSiteService = Depends(),
):
    """Endpoint to delete single charging site row"""
    if request_data.deleted:
        # Delete existing charging site row
        await cs_service.delete_charging_site(charging_site_id)
        return DeleteChargingSiteResponseSchema(
            message="Charging site deleted successfully"
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request"
        )
