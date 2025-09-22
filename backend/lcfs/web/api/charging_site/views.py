import structlog

"""Charging Site API."""

from typing import List, Union
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Path,
    Request,
    Response,
    UploadFile,
    status,
    Body,
)

from lcfs.db.models.user.Role import RoleEnum
from fastapi.responses import JSONResponse, StreamingResponse
from lcfs.web.api.base import FilterModel, PaginationRequestSchema
from lcfs.web.api.charging_site.schema import (
    ChargingEquipmentStatusSchema,
    BulkEquipmentStatusUpdateSchema,
    ChargingEquipmentPaginatedSchema,
    ChargingSiteCreateSchema,
    ChargingSiteSchema,
    ChargingSiteStatusSchema,
    ChargingSitesSchema,
    CommonPaginatedCSRequestSchema,
    DeleteChargingSiteResponseSchema,
)
from lcfs.web.api.charging_site.services import ChargingSiteService
from lcfs.web.api.charging_site.export import ChargingSiteExporter
from lcfs.web.api.charging_site.importer import ChargingSiteImporter
from lcfs.db import dependencies
from lcfs.web.api.charging_site.validation import ChargingSiteValidation
from lcfs.web.api.fuel_code.schema import EndUserTypeSchema
from lcfs.web.core.decorators import view_handler


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
    "/equipment/statuses",
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
    "/statuses",
    response_model=List[ChargingSiteStatusSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.SUPPLIER])
async def get_charging_site_statuses(
    request: Request, service: ChargingSiteService = Depends()
) -> List[ChargingSiteStatusSchema]:
    """
    Get all available charging site statuses
    """
    return await service.get_charging_site_statuses()


@router.get(
    "/{site_id}",
    response_model=ChargingSiteSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.SUPPLIER])
async def get_charging_site(
    request: Request,
    site_id: int = Path(..., description="Charging site ID"),
    service: ChargingSiteService = Depends(),
) -> ChargingSiteSchema:
    """
    Get a specific charging site with its attachments
    """
    return await service.get_charging_site_by_id(site_id)


@router.post(
    "/{site_id}/equipment/list-all", response_model=ChargingEquipmentPaginatedSchema
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
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


@router.post(
    "/{site_id}/equipment/bulk-status-update",
    response_model=bool,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.SUPPLIER])
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


@router.post(
    "/organization/{organization_id}/list-all",
    response_model=ChargingSitesSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER])
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
                page=request_data.page or 1,
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
    "/list-all",
    response_model=ChargingSitesSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def get_all_charging_sites(
    request: Request,
    request_data: CommonPaginatedCSRequestSchema = Body(...),
    response: Response = None,
    service: ChargingSiteService = Depends(),
) -> ChargingSitesSchema:
    """
    Endpoint to get paginated list of all charging sites (IDIR use).
    """
    try:
        pagination = PaginationRequestSchema(
            page=request_data.page,
            size=request_data.size,
            sort_orders=request_data.sort_orders,
            filters=request_data.filters,
        )
        return await service.get_all_charging_sites_paginated(pagination)
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


@router.post(
    "/export/{organization_id}",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def export_charging_sites(
    request: Request,
    organization_id: str,
    site_ids: List[int] = Body(None),
    exporter: ChargingSiteExporter = Depends(),
):
    """
    Endpoint to export information of charging sites for an organization
    """
    try:
        org_id = int(organization_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid organization id. Must be an integer."
        )

    # Government users can access any organization
    if not request.user.is_government:
        organization = request.user.organization
        if organization.organization_id != org_id:
            raise HTTPException(
                status_code=403, detail="Access denied to this organization"
            )
    else:
        organization = request.user.organization

    return await exporter.export(org_id, request.user, organization, True, site_ids)


@router.post(
    "/import/{organization_id}",
    response_class=JSONResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def import_charging_sites(
    request: Request,
    organization_id: str,
    file: UploadFile = File(...),
    importer: ChargingSiteImporter = Depends(),
    overwrite: bool = Form(...),
    site_ids: str = Form(None),
):
    """
    Endpoint to import Charging Site data from an uploaded Excel file.
    """
    try:
        org_id = int(organization_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid organization id. Must be an integer."
        )

    # Government users can access any organization
    if not request.user.is_government:
        organization = request.user.organization
        if organization.organization_id != org_id:
            raise HTTPException(
                status_code=403, detail="Access denied to this organization"
            )
    else:
        organization = request.user.organization

    # Parse site_ids if provided
    parsed_site_ids = None
    if site_ids:
        try:
            import json

            parsed_site_ids = json.loads(site_ids)
        except (json.JSONDecodeError, TypeError):
            raise HTTPException(
                status_code=400, detail="Invalid site_ids format. Must be a JSON array."
            )

    job_id = await importer.import_data(
        org_id,
        request.user,
        organization.organization_code,
        file,
        overwrite,
        parsed_site_ids,
    )
    return JSONResponse(content={"jobId": job_id})


@router.get(
    "/template/{organization_id}",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_charging_site_template(
    request: Request,
    organization_id: str,
    exporter: ChargingSiteExporter = Depends(),
):
    """
    Endpoint to export a template for charging sites
    """
    try:
        org_id = int(organization_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid organization id. Must be an integer."
        )

    # Government users can access any organization
    if not request.user.is_government:
        organization = request.user.organization
        if organization.organization_id != org_id:
            raise HTTPException(
                status_code=403, detail="Access denied to this organization"
            )
    else:
        organization = request.user.organization

    return await exporter.export(org_id, request.user, organization, False)


@router.get(
    "/status/{job_id}",
    response_class=JSONResponse,
    status_code=status.HTTP_200_OK,
    name="get_import_job_status",
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_import_job_status(
    request: Request,
    job_id: str,
    importer: ChargingSiteImporter = Depends(),
):
    """
    Endpoint to get the current progress of a running charging site import job
    """
    status_result = await importer.get_status(job_id)
    return JSONResponse(content=status_result)
