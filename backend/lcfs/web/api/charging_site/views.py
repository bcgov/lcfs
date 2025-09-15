import structlog
from fastapi import APIRouter, status, Request, Depends, HTTPException, Path, Body
from typing import List

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.charging_site.schema import (
    ChargingSiteWithAttachmentsSchema,
    ChargingSiteStatusSchema,
    BulkEquipmentStatusUpdateSchema,
    ChargingEquipmentPaginatedSchema,
)
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.charging_site.services import ChargingSiteServices
from lcfs.web.core.decorators import view_handler

router = APIRouter()
logger = structlog.get_logger(__name__)


@router.get(
    "/{site_id}",
    response_model=ChargingSiteWithAttachmentsSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
async def get_charging_site(
    request: Request,
    site_id: int = Path(..., description="Charging site ID"),
    service: ChargingSiteServices = Depends(),
) -> ChargingSiteWithAttachmentsSchema:
    """
    Get a specific charging site with its attachments
    """
    result = await service.get_charging_site_with_attachments(site_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Charging site with ID {site_id} not found",
        )
    return result


@router.get(
    "/statuses/",
    response_model=List[ChargingSiteStatusSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
async def get_charging_site_statuses(
    request: Request, service: ChargingSiteServices = Depends()
) -> List[ChargingSiteStatusSchema]:
    """
    Get all available charging site statuses
    """
    return await service.get_charging_site_statuses()


@router.post(
    "/{site_id}/equipment/bulk-status-update",
    response_model=List[ChargingSiteWithAttachmentsSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
async def bulk_update_equipment_status(
    request: Request,
    site_id: int = Path(..., description="Charging site ID"),
    bulk_update: BulkEquipmentStatusUpdateSchema = Body(...),
    service: ChargingSiteServices = Depends(),
):
    """
    Bulk update status for equipment records associated with a charging site.
    """
    # Validate new status
    valid_statuses = ["Draft", "Submitted", "Validated"]
    if bulk_update.new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{bulk_update.new_status}'. Must be one of: {valid_statuses}",
        )

    try:
        await service.bulk_update_equipment_status(bulk_update, site_id, request.user)

        # Return updated charging site data
        updated_site = await service.get_charging_site_with_attachments(site_id)
        return [updated_site] if updated_site else []

    except Exception as e:
        logger.error(f"Error during bulk equipment status update: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update equipment status: {str(e)}",
        )


@router.post("/{site_id}/equipment", response_model=ChargingEquipmentPaginatedSchema)
@view_handler([RoleEnum.ANALYST, RoleEnum.GOVERNMENT])
async def get_charging_site_equipment_paginated(
    request: Request,
    site_id: int = Path(..., description="Charging site ID"),
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: ChargingSiteServices = Depends(),
) -> ChargingEquipmentPaginatedSchema:
    """
    Get paginated charging equipment for a specific charging site.
    Supports filtering, sorting, and pagination.
    """
    return await service.get_charging_site_equipment_paginated(site_id, pagination)
