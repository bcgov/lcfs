"""API views for Charging Equipment management."""

import structlog
from fastapi import APIRouter, Body, Depends, Query, status, Request
from typing import List, Optional

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.charging_equipment.schema import (
    ChargingEquipmentBaseSchema,
    ChargingEquipmentCreateSchema,
    ChargingEquipmentUpdateSchema,
    ChargingEquipmentListSchema,
    ChargingEquipmentFilterSchema,
    ChargingEquipmentStatusEnum,
    BulkSubmitRequestSchema,
    BulkDecommissionRequestSchema,
    BulkActionResponseSchema,
)
from lcfs.web.api.charging_equipment.services import ChargingEquipmentServices
from lcfs.web.core.decorators import view_handler

router = APIRouter()
logger = structlog.get_logger(__name__)


@router.post(
    "/list",
    response_model=ChargingEquipmentListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
async def get_charging_equipment_list(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    filters: Optional[ChargingEquipmentFilterSchema] = Body(None),
    service: ChargingEquipmentServices = Depends(),
) -> ChargingEquipmentListSchema:
    """
    Get paginated list of charging equipment (FSE) for the organization.
    
    - **Suppliers** can view their own organization's equipment
    - **Government/Analysts** can view any organization's equipment
    """
    return await service.get_charging_equipment_list(
        request.user, pagination, filters
    )


@router.get(
    "/{charging_equipment_id}",
    response_model=ChargingEquipmentBaseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
async def get_charging_equipment(
    request: Request,
    charging_equipment_id: int,
    service: ChargingEquipmentServices = Depends(),
) -> ChargingEquipmentBaseSchema:
    """
    Get detailed information about a specific charging equipment.
    """
    return await service.get_charging_equipment_by_id(
        request.user, charging_equipment_id
    )


@router.post(
    "/",
    response_model=ChargingEquipmentBaseSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.SUPPLIER])
async def create_charging_equipment(
    request: Request,
    equipment_data: ChargingEquipmentCreateSchema,
    service: ChargingEquipmentServices = Depends(),
) -> ChargingEquipmentBaseSchema:
    """
    Create new charging equipment in Draft status.
    
    - Equipment number will be auto-generated
    - Initial status will be "Draft"
    - Version will be set to 1
    """
    return await service.create_charging_equipment(request.user, equipment_data)


@router.put(
    "/{charging_equipment_id}",
    response_model=ChargingEquipmentBaseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER])
async def update_charging_equipment(
    request: Request,
    charging_equipment_id: int,
    equipment_data: ChargingEquipmentUpdateSchema,
    service: ChargingEquipmentServices = Depends(),
) -> ChargingEquipmentBaseSchema:
    """
    Update existing charging equipment.
    
    - Only equipment in Draft, Updated, or Validated status can be edited
    - Validated equipment will create a new version when edited
    """
    return await service.update_charging_equipment(
        request.user, charging_equipment_id, equipment_data
    )


@router.delete(
    "/{charging_equipment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@view_handler([RoleEnum.SUPPLIER])
async def delete_charging_equipment(
    request: Request,
    charging_equipment_id: int,
    service: ChargingEquipmentServices = Depends(),
):
    """
    Delete charging equipment.
    
    - Only equipment in Draft status can be deleted
    """
    await service.delete_charging_equipment(request.user, charging_equipment_id)
    return None


@router.post(
    "/bulk/submit",
    response_model=BulkActionResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER])
async def bulk_submit_equipment(
    request: Request,
    bulk_request: BulkSubmitRequestSchema,
    service: ChargingEquipmentServices = Depends(),
) -> BulkActionResponseSchema:
    """
    Bulk submit charging equipment for validation.
    
    - Changes status from Draft/Updated to Submitted
    - Also sets associated charging sites to Submitted if applicable
    - No further edits allowed after submission
    """
    return await service.bulk_submit_equipment(
        request.user, bulk_request.charging_equipment_ids
    )


@router.post(
    "/bulk/decommission",
    response_model=BulkActionResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER])
async def bulk_decommission_equipment(
    request: Request,
    bulk_request: BulkDecommissionRequestSchema,
    service: ChargingEquipmentServices = Depends(),
) -> BulkActionResponseSchema:
    """
    Bulk decommission charging equipment.
    
    - Changes status from Validated to Decommissioned
    - Equipment will no longer be available in future compliance reports
    """
    return await service.bulk_decommission_equipment(
        request.user, bulk_request.charging_equipment_ids
    )


@router.get(
    "/statuses/list",
    response_model=List[dict],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
async def get_equipment_statuses(
    request: Request,
    service: ChargingEquipmentServices = Depends(),
) -> List[dict]:
    """
    Get all available charging equipment statuses.
    """
    return await service.get_equipment_statuses()


@router.get(
    "/levels/list",
    response_model=List[dict],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
async def get_levels_of_equipment(
    request: Request,
    service: ChargingEquipmentServices = Depends(),
) -> List[dict]:
    """
    Get all available levels of equipment.
    """
    return await service.get_levels_of_equipment()


@router.get(
    "/end-use-types/list",
    response_model=List[dict],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
async def get_end_use_types(
    request: Request,
    service: ChargingEquipmentServices = Depends(),
) -> List[dict]:
    """
    Get all available end use types for intended use selection.
    """
    return await service.get_end_use_types()


@router.get(
    "/charging-sites/list",
    response_model=List[dict],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER])
async def get_charging_sites(
    request: Request,
    service: ChargingEquipmentServices = Depends(),
) -> List[dict]:
    """
    Get all charging sites for the supplier's organization.
    """
    return await service.get_charging_sites(request.user)


@router.get(
    "/organizations/list",
    response_model=List[dict],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
async def get_organizations(
    request: Request,
    service: ChargingEquipmentServices = Depends(),
) -> List[dict]:
    """
    Get all organizations for allocating organization selection.
    """
    return await service.get_organizations()