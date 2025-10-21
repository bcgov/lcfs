"""API views for Charging Equipment management."""

import structlog
from fastapi import (
    APIRouter,
    Body,
    Depends,
    Query,
    status,
    Request,
    HTTPException,
    UploadFile,
    File,
    Form,
)
from fastapi.responses import JSONResponse, StreamingResponse
from typing import List, Optional

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema
from pydantic import Field
from typing import Optional as OptionalType

# Extended pagination schema to support organization filtering for IDIR users
class ChargingEquipmentPaginationRequestSchema(PaginationRequestSchema):
    organization_id: OptionalType[int] = Field(None, alias="organization_id")
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
from lcfs.web.api.charging_equipment.export import ChargingEquipmentExporter
from lcfs.web.api.charging_equipment.importer import ChargingEquipmentImporter

router = APIRouter()
logger = structlog.get_logger(__name__)


@router.post(
    "/list",
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_charging_equipment_list(
    request: Request,
    body: ChargingEquipmentPaginationRequestSchema = Body(...),
    service: ChargingEquipmentServices = Depends(),
) -> ChargingEquipmentListSchema:
    """
    Get paginated list of charging equipment (FSE) for the organization.

    - **Suppliers** can view their own organization's equipment
    - **Government/Analysts** can view any organization's equipment with optional filtering
    """
    # Extract organization_id from body if provided (for IDIR users dropdown filter)
    # This is separate from table filters
    filters = None
    if body.organization_id:
        filters = ChargingEquipmentFilterSchema(organization_id=body.organization_id)

    return await service.get_charging_equipment_list(request.user, body, filters)


@router.get(
    "/{charging_equipment_id}",
    response_model=ChargingEquipmentBaseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
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


@router.post(
    "/bulk/validate",
    response_model=BulkActionResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def bulk_validate_equipment(
    request: Request,
    bulk_request: BulkSubmitRequestSchema,
    service: ChargingEquipmentServices = Depends(),
) -> BulkActionResponseSchema:
    """
    Bulk validate charging equipment (Government/Analyst only).

    - Changes status from Submitted to Validated
    - Only government users can validate equipment
    """
    return await service.bulk_validate_equipment(
        request.user, bulk_request.charging_equipment_ids
    )


@router.post(
    "/bulk/return-to-draft",
    response_model=BulkActionResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def bulk_return_to_draft(
    request: Request,
    bulk_request: BulkSubmitRequestSchema,
    service: ChargingEquipmentServices = Depends(),
) -> BulkActionResponseSchema:
    """
    Bulk return charging equipment to draft (Government/Analyst only).

    - Changes status from Submitted/Validated to Draft
    - Only government users can return equipment to draft
    """
    return await service.bulk_return_to_draft(
        request.user, bulk_request.charging_equipment_ids
    )


@router.get(
    "/charging-sites/{site_id}/equipment-processing",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def get_site_equipment_processing(
    request: Request,
    site_id: int,
    service: ChargingEquipmentServices = Depends(),
) -> dict:
    """
    Get charging site details and equipment for FSE processing (Government/Analyst view).
    """
    return await service.get_site_equipment_processing(request.user, site_id)


@router.get(
    "/statuses/list",
    response_model=List[dict],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
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
@view_handler(["*"])
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
@view_handler(["*"])
async def get_end_use_types(
    request: Request,
    service: ChargingEquipmentServices = Depends(),
) -> List[dict]:
    """
    Get all available end use types for intended use selection.
    """
    return await service.get_end_use_types()


@router.get(
    "/end-user-types/list",
    response_model=List[dict],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_end_user_types(
    request: Request,
    service: ChargingEquipmentServices = Depends(),
) -> List[dict]:
    """
    Get all available end user types for intended user selection.
    """
    return await service.get_end_user_types()


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
@view_handler(["*"])
async def get_organizations(
    request: Request,
    service: ChargingEquipmentServices = Depends(),
) -> List[dict]:
    """
    Get all organizations for allocating organization selection.
    """
    return await service.get_organizations()


@router.get(
    "/organizations/has-allocation-agreements",
    response_model=bool,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER])
async def has_allocation_agreements(
    request: Request,
    service: ChargingEquipmentServices = Depends(),
) -> bool:
    """Boolean flag indicating if the supplier has any allocation agreements."""
    return await service.has_allocation_agreements(request.user)


@router.get(
    "/export/{organization_id}",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def export_charging_equipment(
    request: Request,
    organization_id: str,
    exporter: ChargingEquipmentExporter = Depends(),
):
    """
    Export all charging equipment for an organization.
    """
    try:
        org_id = int(organization_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid organization id. Must be an integer."
        )

    organization = request.user.organization
    if not request.user.is_government and organization.organization_id != org_id:
        raise HTTPException(
            status_code=403, detail="Access denied to this organization"
        )

    return await exporter.export(org_id, request.user, organization, True)


@router.get(
    "/template/{organization_id}",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_charging_equipment_template(
    request: Request,
    organization_id: str,
    exporter: ChargingEquipmentExporter = Depends(),
):
    """
    Export a template for charging equipment without data.
    """
    try:
        org_id = int(organization_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid organization id. Must be an integer."
        )

    organization = request.user.organization
    if not request.user.is_government and organization.organization_id != org_id:
        raise HTTPException(
            status_code=403, detail="Access denied to this organization"
        )

    return await exporter.export(org_id, request.user, organization, False)


@router.post(
    "/import/{organization_id}",
    response_class=JSONResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def import_charging_equipment(
    request: Request,
    organization_id: str,
    file: UploadFile = File(...),
    importer: ChargingEquipmentImporter = Depends(),
    overwrite: bool = Form(...),
):
    """
    Import charging equipment from an uploaded Excel file.
    """
    try:
        org_id = int(organization_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid organization id. Must be an integer."
        )

    organization = request.user.organization
    if not request.user.is_government and organization.organization_id != org_id:
        raise HTTPException(
            status_code=403, detail="Access denied to this organization"
        )

    job_id = await importer.import_data(
        org_id,
        request.user,
        organization.organization_code,
        file,
        overwrite,
    )
    return JSONResponse(content={"jobId": job_id})


@router.get(
    "/status/{job_id}",
    response_class=JSONResponse,
    status_code=status.HTTP_200_OK,
    name="get_charging_equipment_import_job_status",
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_import_job_status(
    request: Request,
    job_id: str,
    importer: ChargingEquipmentImporter = Depends(),
):
    """
    Get the current progress of a running charging equipment import job.
    """
    status_result = await importer.get_status(job_id)
    return JSONResponse(content=status_result)
