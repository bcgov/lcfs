import structlog
from fastapi import (
    APIRouter,
    Body,
    status,
    Request,
    Response,
    Depends,
    HTTPException,
)
from typing import Union

from lcfs.db import dependencies
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.fuel_export.actions_service import (
    FuelExportActionService,
)
from lcfs.web.api.fuel_export.schema import (
    DeleteFuelExportResponseSchema,
    FuelExportsSchema,
    FuelExportCreateUpdateSchema,
    FuelTypeOptionsResponse,
    CommonPaginatedReportRequestSchema,
    FuelExportSchema,
)
from lcfs.web.api.fuel_export.services import FuelExportServices
from lcfs.web.core.decorators import view_handler

router = APIRouter()
logger = structlog.get_logger(__name__)
get_async_db = dependencies.get_async_db_session


@router.get(
    "/table-options",
    response_model=FuelTypeOptionsResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_fuel_export_table_options(
    request: Request, compliancePeriod: str, service: FuelExportServices = Depends()
) -> FuelTypeOptionsResponse:
    return await service.get_fuel_export_options(compliancePeriod)


@router.post(
    "/list-all", response_model=FuelExportsSchema, status_code=status.HTTP_200_OK
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_fuel_exports(
    request: Request,
    request_data: CommonPaginatedReportRequestSchema = Body(...),
    response: Response = None,
    service: FuelExportServices = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
) -> FuelExportsSchema:
    """Endpoint to get list of fuel supplied list for a compliance report"""
    try:
        compliance_report_id = request_data.compliance_report_id

        compliance_report = await service.get_compliance_report_by_id(
            compliance_report_id
        )
        if not compliance_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compliance report not found",
            )

        await report_validate.validate_compliance_report_access(compliance_report)
        await report_validate.validate_organization_access(compliance_report_id)
        if hasattr(request_data, "page") and request_data.page is not None:
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
            return await service.get_fuel_export_list(
                compliance_report_id, request_data.changelog
            )
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions to preserve status code and message
        raise http_ex
    except Exception as e:
        # Log and handle unexpected errors
        logger.exception("Error occurred", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your request",
        )


@router.post(
    "/save",
    response_model=Union[FuelExportSchema, DeleteFuelExportResponseSchema],
    status_code=status.HTTP_201_CREATED,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.ANALYST]
)
async def save_fuel_export_row(
    request: Request,
    request_data: FuelExportCreateUpdateSchema = Body(...),
    action_service: FuelExportActionService = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
):
    """Endpoint to save single fuel export row"""
    compliance_report_id = request_data.compliance_report_id
    compliance_report = await report_validate.validate_organization_access(
        compliance_report_id
    )
    await report_validate.validate_compliance_report_access(compliance_report)

    if request_data.deleted:
        # Use action service to handle delete logic
        return await action_service.delete_fuel_export(request_data)
    else:
        if request_data.fuel_export_id:
            # Use action service to handle update logic
            return await action_service.update_fuel_export(
                request_data, compliance_report.compliance_period.description
            )
        else:
            # Use action service to handle create logic
            return await action_service.create_fuel_export(
                request_data, compliance_report.compliance_period.description
            )
