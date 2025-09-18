import structlog
from fastapi import (
    APIRouter,
    status,
    Request,
    Response,
    Depends,
    HTTPException,
    Path,
    Body,
)
from typing import List, Union

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.charging_site.schema import (
    ChargingSiteWithAttachmentsSchema,
    ChargingSiteStatusSchema,
    BulkEquipmentStatusUpdateSchema,
    ChargingEquipmentPaginatedSchema,
    ChargingSiteCreateSchema,
    ChargingSiteSchema,
    ChargingSitesSchema,
    CommonPaginatedCSRequestSchema,
    DeleteChargingSiteResponseSchema,
)
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.charging_site.services import ChargingSiteService
from lcfs.web.core.decorators import view_handler
from lcfs.db import dependencies
from lcfs.web.api.fuel_code.schema import EndUserTypeSchema

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


@router.get(
    "/{site_id}",
    response_model=ChargingSiteWithAttachmentsSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
async def get_charging_site(
    request: Request,
    site_id: int = Path(..., description="Charging site ID"),
    service: ChargingSiteService = Depends(),
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
    request: Request, service: ChargingSiteService = Depends()
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
    service: ChargingSiteService = Depends(),
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
    service: ChargingSiteService = Depends(),
) -> ChargingEquipmentPaginatedSchema:
    """
    Get paginated charging equipment for a specific charging site.
    Supports filtering, sorting, and pagination.
    """
    return await service.get_charging_site_equipment_paginated(site_id, pagination)


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
    "/organization/{organization_id}/save/{charging_site_id}",
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
    request_data: ChargingSiteCreateSchema = Body(None),
    cs_service: ChargingSiteService = Depends(),
):
    """Endpoint to delete single charging site row"""
    # Delete existing charging site row
    await cs_service.delete_charging_site(charging_site_id)
    return DeleteChargingSiteResponseSchema(
        message="Charging site deleted successfully"
    )
