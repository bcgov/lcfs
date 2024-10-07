from logging import getLogger
from typing import Optional, Union
from fastapi import (
    APIRouter,
    Body,
    status,
    Request,
    Response,
    Depends,
)
from lcfs.db import dependencies

from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_export.schema import (
    DeleteFuelExportResponseSchema,
    FuelExportsSchema,
    FuelExportCreateSchema,
    FuelTypeOptionsResponse,
    CommonPaginatedReportRequestSchema,
    FuelExportSchema,
)
from lcfs.web.api.fuel_export.services import FuelExportServices
from lcfs.web.api.fuel_export.validation import FuelExportValidation
from lcfs.web.core.decorators import view_handler
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.db.models.user.Role import RoleEnum

router = APIRouter()
logger = getLogger("fuel_export_view")
get_async_db = dependencies.get_async_db_session


@router.get(
    "/table-options",
    response_model=FuelTypeOptionsResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_fuel_export_table_options(
    request: Request, compliancePeriod: str, service: FuelExportServices = Depends()
) -> FuelTypeOptionsResponse:
    return await service.get_fuel_export_options(compliancePeriod)


@router.post(
    "/list-all", response_model=FuelExportsSchema, status_code=status.HTTP_200_OK
)
@view_handler(["*"])
async def get_fuel_exports(
    request: Request,
    request_data: CommonPaginatedReportRequestSchema = Body(...),
    response: Response = None,
    service: FuelExportServices = Depends(),
) -> FuelExportsSchema:
    """Endpoint to get list of fuel supplied list for a compliance report"""
    compliance_report_id = request_data.compliance_report_id
    if hasattr(request_data, "page") and request_data.page is not None:
        # handle pagination.
        pagination = PaginationRequestSchema(
            page=request_data.page,
            size=request_data.size,
            sort_orders=request_data.sort_orders,
            filters=request_data.filters,
        )
        return await service.get_fuel_exports_paginated(
            pagination, compliance_report_id
        )
    else:
        return await service.get_fuel_export_list(compliance_report_id)


@router.post(
    "/save",
    response_model=Union[FuelExportSchema, DeleteFuelExportResponseSchema],
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.SUPPLIER])
async def save_fuel_export_row(
    request: Request,
    request_data: FuelExportCreateSchema = Body(...),
    fs_service: FuelExportServices = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
    fs_validate: FuelExportValidation = Depends(),
):
    """Endpoint to save single fuel export row"""
    compliance_report_id = request_data.compliance_report_id
    fs_id: Optional[int] = request_data.fuel_export_id

    await report_validate.validate_organization_access(compliance_report_id)

    if request_data.deleted:
        # Delete existing fuel export row
        await fs_service.delete_fuel_export(fs_id)
        return DeleteFuelExportResponseSchema(
            success=True, message="fuel export row deleted successfully"
        )
    elif fs_id:
        # Update existing fuel export row
        return await fs_service.update_fuel_export(request_data)
    else:
        # Create new fuel export row
        return await fs_service.create_fuel_export(request_data)
