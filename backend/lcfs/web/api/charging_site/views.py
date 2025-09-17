"""Charging Site API."""

from typing import List, Union
from fastapi import (
    APIRouter,
    Body,
    Depends,
    HTTPException,
    Path,
    Request,
    Response,
    status,
)
from lcfs.web.api.base import FilterModel, PaginationRequestSchema
from lcfs.web.api.charging_site.schema import (
    BulkEquipmentStatusUpdateSchema,
    ChargingEquipmentPaginatedSchema,
    ChargingEquipmentStatusSchema,
    ChargingSiteCreateSchema,
    ChargingSiteSchema,
    ChargingSiteStatusSchema,
    ChargingSitesSchema,
    CommonPaginatedCSRequestSchema,
    DeleteChargingSiteResponseSchema,
)
from lcfs.web.api.charging_site.services import ChargingSiteService
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db import dependencies
from lcfs.web.api.charging_site.validation import ChargingSiteValidation
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
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_intended_users(
    request: Request,
    service: ChargingSiteService = Depends(),
) -> List[EndUserTypeSchema]:
    """
    Endpoint to get a list of intended users
    """
    return await service.get_intended_user_types()


@router.get(
    "/equipment/statuses/",
    response_model=List[ChargingEquipmentStatusSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ANALYST, RoleEnum.SUPPLIER])
async def get_charging_equipment_statuses(
    request: Request, service: ChargingSiteService = Depends()
) -> List[ChargingEquipmentStatusSchema]:
    """
    Get all available charging site statuses
    """
    return await service.get_charging_equipment_statuses()


@router.get(
    "/statuses/",
    response_model=List[ChargingSiteStatusSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ANALYST, RoleEnum.SUPPLIER])
async def get_charging_site_statuses(
    request: Request, service: ChargingSiteService = Depends()
) -> List[ChargingSiteStatusSchema]:
    """
    Get all available charging site statuses
    """
    return await service.get_charging_site_statuses()


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
                size=request_data.size or 10,
                sort_orders=request_data.sort_orders or [],
                filters=request_data.filters or [],
            )
            return await service.get_charging_sites_paginated(
                pagination, organization_id
            )
        else:
            result = await service.get_cs_list(organization_id)
            if result is None:
                from lcfs.web.api.base import PaginationResponseSchema

                return ChargingSitesSchema(
                    charging_sites=[],
                    pagination=PaginationResponseSchema(
                        total=0, page=1, size=10, total_pages=0
                    ),
                )
            return result
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
@view_handler([RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY])
async def create_charging_site_row(
    request: Request,
    organization_id: int,
    request_data: ChargingSiteCreateSchema = Body(...),
    cs_service: ChargingSiteService = Depends(),
    validate: ChargingSiteValidation = Depends(),
):
    """Endpoint to create single charging site row"""
    await validate.charging_site_create_access(organization_id, request_data)
    # Create new charging site row
    return await cs_service.create_charging_site(request_data, organization_id)


@router.put(
    "/organization/{organization_id}/save/{charging_site_id}",
    response_model=Union[ChargingSiteSchema, DeleteChargingSiteResponseSchema],
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY])
async def update_charging_site_row(
    request: Request,
    organization_id: int,
    charging_site_id: int,
    request_data: ChargingSiteCreateSchema = Body(...),
    cs_service: ChargingSiteService = Depends(),
    validate: ChargingSiteValidation = Depends(),
):
    """Endpoint to update single charging site row"""
    # Update existing charging site row
    await validate.charging_site_delete_update_access(charging_site_id, organization_id)
    return await cs_service.update_charging_site(request_data)


@router.delete(
    "/organization/{organization_id}/save/{charging_site_id}",
    response_model=Union[ChargingSiteSchema, DeleteChargingSiteResponseSchema],
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY])
async def delete_charging_site_row(
    request: Request,
    organization_id: int,
    charging_site_id: int,
    request_data: ChargingSiteCreateSchema = Body(None),
    cs_service: ChargingSiteService = Depends(),
    validate: ChargingSiteValidation = Depends(),
):
    """Endpoint to delete single charging site row"""
    await validate.charging_site_delete_update_access(charging_site_id, organization_id)
    # Delete existing charging site row
    await cs_service.delete_charging_site(charging_site_id)
    return DeleteChargingSiteResponseSchema(
        message="Charging site deleted successfully"
    )


@router.get(
    "/{site_id}",
    response_model=ChargingSiteSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ANALYST, RoleEnum.SUPPLIER])
async def get_charging_site(
    request: Request,
    site_id: int = Path(..., description="Charging site ID"),
    service: ChargingSiteService = Depends(),
    validate: ChargingSiteValidation = Depends(),
) -> ChargingSiteSchema:
    """
    Get a specific charging site with its attachments
    """
    await validate.validate_organization_access(site_id)
    result = await service.get_charging_site_with_attachments(site_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Charging site with ID {site_id} not found",
        )
    return result


@router.post(
    "/{site_id}/equipment/bulk-status-update",
    response_model=bool,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ANALYST, RoleEnum.SUPPLIER])
async def bulk_update_equipment_status(
    request: Request,
    site_id: int = Path(..., description="Charging site ID"),
    bulk_update: BulkEquipmentStatusUpdateSchema = Body(...),
    service: ChargingSiteService = Depends(),
    validate: ChargingSiteValidation = Depends(),
):
    """
    Bulk update status for equipment records associated with a charging site.
    """
    await validate.validate_organization_access(site_id)
    try:
        return await service.bulk_update_equipment_status(
            bulk_update, site_id, request.user
        )
    except Exception as e:
        logger.error(f"Error during bulk equipment status update: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update equipment status: {str(e)}",
        )


@router.post("/{site_id}/equipment", response_model=ChargingEquipmentPaginatedSchema)
@view_handler([RoleEnum.ANALYST, RoleEnum.GOVERNMENT, RoleEnum.SUPPLIER])
async def get_charging_site_equipment_paginated(
    request: Request,
    site_id: int = Path(..., description="Charging site ID"),
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: ChargingSiteService = Depends(),
    validate: ChargingSiteValidation = Depends(),
) -> ChargingEquipmentPaginatedSchema:
    """
    Get paginated charging equipment for a specific charging site.
    Supports filtering, sorting, and pagination.
    """
    await validate.validate_organization_access(site_id)
    if request.user.is_government:
        pagination.filters.append(
            FilterModel(
                field="status", filter_type="text", type="not_equals", filter="Draft"
            )
        )
    return await service.get_charging_site_equipment_paginated(site_id, pagination)
