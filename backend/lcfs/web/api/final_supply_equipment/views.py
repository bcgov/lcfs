from typing import List, Optional, Union

import structlog
from fastapi import (
    APIRouter,
    Body,
    HTTPException,
    Query,
    status,
    Request,
    Response,
    Depends,
)
from starlette.responses import StreamingResponse

from lcfs.db import dependencies
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.compliance_report.schema import (
    CommonPaginatedReportRequestSchema,
)
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.final_supply_equipment.export import FinalSupplyEquipmentExporter
from lcfs.web.api.final_supply_equipment.schema import (
    DeleteFinalSupplyEquipmentResponseSchema,
    FSEOptionsSchema,
    FinalSupplyEquipmentCreateSchema,
    FinalSupplyEquipmentsSchema,
    FinalSupplyEquipmentSchema,
)
from lcfs.web.api.final_supply_equipment.services import FinalSupplyEquipmentServices
from lcfs.web.api.final_supply_equipment.validation import (
    FinalSupplyEquipmentValidation,
)
from lcfs.web.core.decorators import view_handler

router = APIRouter()
logger = structlog.get_logger(__name__)
get_async_db = dependencies.get_async_db_session


@router.get(
    "/table-options", response_model=FSEOptionsSchema, status_code=status.HTTP_200_OK
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_fse_options(
    request: Request, service: FinalSupplyEquipmentServices = Depends()
) -> FSEOptionsSchema:
    return await service.get_fse_options()


@router.post(
    "/list-all",
    response_model=FinalSupplyEquipmentsSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_final_supply_equipments(
    request: Request,
    request_data: CommonPaginatedReportRequestSchema = Body(...),
    response: Response = None,
    service: FinalSupplyEquipmentServices = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
) -> FinalSupplyEquipmentsSchema:
    """
    Endpoint to get list of final supply equipments for a compliance report
    """
    try:
        compliance_report_id = request_data.compliance_report_id

        compliance_report = await service.get_compliance_report_by_id(
            compliance_report_id
        )

        await report_validate.validate_compliance_report_access(compliance_report)
        await report_validate.validate_organization_access(compliance_report_id)

        if hasattr(request_data, "page") and request_data.page is not None:
            # Handle pagination
            pagination = PaginationRequestSchema(
                page=request_data.page,
                size=request_data.size,
                sort_orders=request_data.sort_orders,
                filters=request_data.filters,
            )
            return await service.get_final_supply_equipments_paginated(
                pagination, compliance_report_id
            )
        else:
            return await service.get_fse_list(compliance_report_id)
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
    response_model=Union[
        FinalSupplyEquipmentSchema, DeleteFinalSupplyEquipmentResponseSchema
    ],
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY])
async def save_final_supply_equipment_row(
    request: Request,
    request_data: FinalSupplyEquipmentCreateSchema = Body(...),
    fse_service: FinalSupplyEquipmentServices = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
    fse_validate: FinalSupplyEquipmentValidation = Depends(),
):
    """Endpoint to save single final supply equipment row"""
    compliance_report_id = request_data.compliance_report_id
    fse_id: Optional[int] = request_data.final_supply_equipment_id

    await report_validate.validate_organization_access(compliance_report_id)

    if request_data.deleted:
        # Delete existing final supply equipment row
        await fse_service.delete_final_supply_equipment(fse_id)
        return DeleteFinalSupplyEquipmentResponseSchema(
            message="Final supply equipment row deleted successfully"
        )
    elif fse_id:
        await fse_validate.check_equipment_uniqueness_and_overlap(data=request_data)
        # Update existing final supply equipment row
        return await fse_service.update_final_supply_equipment(request_data)
    else:
        await fse_validate.check_equipment_uniqueness_and_overlap(data=request_data)
        # Create new final supply equipment row
        return await fse_service.create_final_supply_equipment(request_data)


@router.get("/search", response_model=List[str], status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY])
async def search_table_options(
    request: Request,
    manufacturer: Optional[str] = Query(
        None, alias="manufacturer", description="Manfacturer for filtering options"
    ),
    service: FinalSupplyEquipmentServices = Depends(),
) -> List[str]:
    """Endpoint to search table options strings"""
    if manufacturer:
        return await service.search_manufacturers(manufacturer)
    return []


@router.get(
    "/export/{report_id}",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY])
async def export(
    request: Request,
    report_id: str,
    report_validate: ComplianceReportValidation = Depends(),
    exporter: FinalSupplyEquipmentExporter = Depends(),
):
    """
    Endpoint to export information of all FSE
    """
    try:
        compliance_report_id = int(report_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid report id. Must be an integer."
        )

    await report_validate.validate_organization_access(compliance_report_id)

    organization = request.user.organization
    return await exporter.export(compliance_report_id, organization, True)


@router.get(
    "/template/{report_id}",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY])
async def get_template(
    request: Request,
    report_id: str,
    report_validate: ComplianceReportValidation = Depends(),
    exporter: FinalSupplyEquipmentExporter = Depends(),
):
    """
    Endpoint to export a template for FSE
    """
    try:
        compliance_report_id = int(report_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid report id. Must be an integer."
        )

    await report_validate.validate_organization_access(compliance_report_id)

    organization = request.user.organization
    return await exporter.export(compliance_report_id, organization, False)
