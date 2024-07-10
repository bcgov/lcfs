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
from lcfs.web.core.decorators import roles_required, view_handler
from lcfs.db import dependencies
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_supply.schema import (
    DeleteFuelSupplyResponseSchema,
    FuelSuppliesSchema,
    FuelSupplySchema,
    FuelTypeOptionsResponse,
    CommmonPaginatedReportRequestSchema,
)
from lcfs.web.api.fuel_supply.services import FuelSupplyServices
from lcfs.web.api.fuel_supply.validation import FuelSupplyValidation

router = APIRouter()
logger = getLogger("fuel_supply_view")
get_async_db = dependencies.get_async_db_session


@router.get(
    "/table-options",
    response_model=FuelTypeOptionsResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler
async def get_fs_table_options(
    request: Request, compliancePeriod: str, service: FuelSupplyServices = Depends()
) -> FuelTypeOptionsResponse:
    return await service.get_fuel_supply_options(compliancePeriod)


@router.post(
    "/list-all", response_model=FuelSupplySchema, status_code=status.HTTP_200_OK
)
@roles_required("Supplier")
@view_handler
async def get_fuel_supply(
    request: Request,
    request_data: CommmonPaginatedReportRequestSchema = Body(...),
    response: Response = None,
    service: FuelSupplyServices = Depends(),
) -> FuelSuppliesSchema:
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
        return await service.get_fuel_supplies_paginated(
            pagination, compliance_report_id
        )
    else:
        return await service.get_fuel_supply_list(compliance_report_id)


@router.post(
    "/save",
    response_model=Union[FuelSupplySchema, DeleteFuelSupplyResponseSchema],
    status_code=status.HTTP_201_CREATED,
)
@roles_required("Supplier")
@view_handler
async def save_fuel_supply_row(
    request: Request,
    request_data: FuelSupplySchema = Body(...),
    fs_service: FuelSupplyServices = Depends(),
    fs_validate: FuelSupplyValidation = Depends(),
):
    """Endpoint to save single fuel supply row"""
    compliance_report_id = request_data.compliance_report_id
    fs_id: Optional[int] = request_data.fuel_supply_id

    await fs_validate.validate_organization_access(compliance_report_id)

    if request_data.deleted:
        # Delete existing fuel supply row
        await fs_service.delete_fuel_supply(fs_id)
        return DeleteFuelSupplyResponseSchema(
            message="fuel supply row deleted successfully"
        )
    elif fs_id:
        # Update existing fuel supply row
        return await fs_service.update_fuel_supply(request_data)
    else:
        # Create new fuel supply row
        return await fs_service.create_fuel_supply(request_data)
