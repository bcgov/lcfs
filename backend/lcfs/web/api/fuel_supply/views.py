import structlog
from typing import Optional, Union

from fastapi import APIRouter, Body, Depends, Request, Response, status, HTTPException
from starlette.responses import JSONResponse

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.fuel_supply.schema import (
    DeleteFuelSupplyResponseSchema,
    FuelSuppliesSchema,
    FuelSupplyCreateUpdateSchema,
    FuelSupplyResponseSchema,
    FuelTypeOptionsResponse,
    CommonPaginatedReportRequestSchema,
)
from lcfs.web.api.fuel_supply.services import FuelSupplyServices
from lcfs.web.api.fuel_supply.validation import FuelSupplyValidation
from lcfs.web.api.fuel_supply.actions_service import FuelSupplyActionService
from lcfs.web.core.decorators import view_handler

router = APIRouter()
logger = structlog.get_logger(__name__)


@router.get(
    "/table-options",
    response_model=FuelTypeOptionsResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_fs_table_options(
    request: Request, compliancePeriod: str, service: FuelSupplyServices = Depends()
) -> FuelTypeOptionsResponse:
    return await service.get_fuel_supply_options(compliancePeriod)


@router.post(
    "/list-all", response_model=FuelSuppliesSchema, status_code=status.HTTP_200_OK
)
@view_handler(["*"])
async def get_fuel_supply(
    request: Request,
    request_data: CommonPaginatedReportRequestSchema = Body(...),
    response: Response = None,
    service: FuelSupplyServices = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
) -> FuelSuppliesSchema:
    """Endpoint to get list of fuel supplied list for a compliance report"""
    compliance_report_id = request_data.compliance_report_id
    await report_validate.validate_organization_access(compliance_report_id)
    if hasattr(request_data, "page") and request_data.page is not None:
        # Handle pagination.
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
    response_model=Union[FuelSupplyResponseSchema, DeleteFuelSupplyResponseSchema],
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def save_fuel_supply_row(
    request: Request,
    response: Response,
    request_data: FuelSupplyCreateUpdateSchema = Body(...),
    action_service: FuelSupplyActionService = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
    fs_validate: FuelSupplyValidation = Depends(),
):
    """Endpoint to save single fuel supply row"""
    compliance_report_id = request_data.compliance_report_id
    await report_validate.validate_organization_access(compliance_report_id)

    # Determine user type for record creation
    current_user_type = request.user.user_type
    if not current_user_type:
        raise HTTPException(
            status_code=403, detail="User does not have the required role."
        )

    if request_data.deleted:
        # Delete existing fuel supply row using actions service
        return await action_service.delete_fuel_supply(request_data, current_user_type)
    else:
        duplicate_id = await fs_validate.check_duplicate(request_data)
        await fs_validate.validate_other(request_data)
        if duplicate_id is not None:
            duplicate_response = format_duplicate_error(duplicate_id)
            return duplicate_response
        if request_data.fuel_supply_id:
            # Update existing fuel supply row using actions service
            return await action_service.update_fuel_supply(
                request_data, current_user_type
            )
        else:
            # Create new fuel supply row using actions service
            return await action_service.create_fuel_supply(
                request_data, current_user_type
            )


def format_duplicate_error(duplicate_id: int):
    return JSONResponse(
        status_code=422,
        content={
            "message": "Validation failed",
            "errors": [
                {
                    "fields": [
                        "fuelCode",
                        "fuelType",
                        "fuelCategory",
                        "provisionOfTheAct",
                    ],
                    "message": "There are duplicate fuel entries, please combine the quantity into a single value on one row.",
                }
            ],
            "warnings": [
                {
                    "id": duplicate_id,
                    "fields": [
                        "fuelCode",
                        "fuelType",
                        "fuelCategory",
                        "provisionOfTheAct",
                    ],
                    "message": "There are duplicate fuel entries, please combine the quantity into a single value on one row.",
                }
            ],
        },
    )
