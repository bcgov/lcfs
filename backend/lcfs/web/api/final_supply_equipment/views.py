from typing import List, Optional, Union

import structlog
from fastapi import (
    APIRouter,
    Body,
    HTTPException,
    Path,
    Query,
    status,
    Request,
    Response,
    Depends,
    UploadFile,
    File,
    Form,
)
from starlette.responses import StreamingResponse, JSONResponse

from lcfs.db import dependencies
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.final_supply_equipment.repo import FinalSupplyEquipmentRepository
from lcfs.web.api.compliance_report.schema import (
    CommonPaginatedReportRequestSchema,
)
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.final_supply_equipment.export import FinalSupplyEquipmentExporter
from lcfs.web.api.final_supply_equipment.importer import FinalSupplyEquipmentImporter
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
    return await service.get_fse_options(request.user)


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
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.ANALYST]
)
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

    compliance_report = await report_validate.validate_organization_access(
        compliance_report_id
    )
    await report_validate.validate_compliance_report_access(compliance_report)
    await report_validate.validate_compliance_report_editable(compliance_report)

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
        return await fse_service.create_final_supply_equipment(
            request_data, compliance_report.organization.organization_id
        )


@router.get("/search", response_model=List[str], status_code=status.HTTP_200_OK)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.ANALYST]
)
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
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
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

    compliance_report = await report_validate.validate_organization_access(
        compliance_report_id
    )
    if compliance_report is None:
        raise HTTPException(status_code=404, detail="Compliance report not found")

    return await exporter.export(
        compliance_report_id, request.user, compliance_report.organization, True
    )


@router.post(
    "/import/{report_id}",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def import_fse(
    request: Request,
    report_id: str,
    file: UploadFile = File(...),
    report_validate: ComplianceReportValidation = Depends(),
    fse_repo: FinalSupplyEquipmentRepository = Depends(),
    importer: FinalSupplyEquipmentImporter = Depends(),
    overwrite: bool = Form(...),
):
    """
    Endpoint to import Final Supply Equipment data from an uploaded Excel file.
    The Excel must have a sheet named 'FSE' with the same columns as in the exporter.

    Columns:
    1. Organization
    2. Supply from date
    3. Supply to date
    4. kWh usage
    5. Serial #
    6. Manufacturer
    7. Model
    8. Level of equipment
    9. Ports
    10. Intended use  (comma-separated if multiple)
    11. Intended users (comma-separated if multiple)
    12. Street address
    13. City
    14. Postal code
    15. Latitude
    16. Longitude
    17. Notes
    """
    try:
        compliance_report_id = int(report_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid report id. Must be an integer."
        )

    compliance_report = await report_validate.validate_organization_access(
        compliance_report_id
    )
    await report_validate.validate_compliance_report_editable(compliance_report)

    if compliance_report is None:
        raise HTTPException(status_code=404, detail="Compliance report not found")

    await report_validate.validate_compliance_report_editable(compliance_report)

    version = compliance_report.version
    is_original = version == 0

    if overwrite:
        existing_fse = await fse_repo.get_fse_list(compliance_report_id)
        if not is_original and len(existing_fse) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Overwrite not allowed: this is a non-initial report with existing data",
            )

    # Import data
    job_id = await importer.import_data(
        compliance_report_id,
        request.user,
        compliance_report.organization.organization_code,
        file,
        overwrite,
    )
    return JSONResponse(content={"jobId": job_id})


@router.get(
    "/template/{report_id}",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
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

    compliance_report = await report_validate.validate_organization_access(
        compliance_report_id
    )
    if compliance_report is None:
        raise HTTPException(status_code=404, detail="Compliance report not found")

    organization = compliance_report.organization
    return await exporter.export(
        compliance_report_id, request.user, organization, False
    )


@router.get(
    "/status/{job_id}",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def get_job_status(
    request: Request,
    job_id: str,
    importer: FinalSupplyEquipmentImporter = Depends(),
):
    """
    Endpoint to get the current progress of a running FSE job
    """

    status = await importer.get_status(job_id)
    return JSONResponse(content=status)


@router.post(
    "/reporting/list",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_fse_reporting_list(
    request: Request,
    pagination: PaginationRequestSchema = Body(...),
    organization_id: int = Query(None, description="Organization ID"),
    service: FinalSupplyEquipmentServices = Depends(),
) -> dict:
    """
    Get paginated charging equipment with related charging site and FSE compliance reporting data
    """
    org_id = (
        organization_id
        if request.user.is_government and organization_id
        else request.user.organization_id
    )
    return await service.get_fse_reporting_list_paginated(org_id, pagination)


@router.post(
    "/reporting/save",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def create_fse_reporting(
    request: Request,
    request_data: dict = Body(...),
    service: FinalSupplyEquipmentServices = Depends(),
) -> dict:
    """
    Create FSE compliance reporting data
    """
    return await service.create_fse_reporting(request_data)


@router.put(
    "/reporting/{reporting_id}",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def update_fse_reporting(
    request: Request,
    reporting_id: int,
    request_data: dict = Body(...),
    service: FinalSupplyEquipmentServices = Depends(),
) -> dict:
    """
    Update FSE compliance reporting data
    """
    return await service.update_fse_reporting(reporting_id, request_data)


@router.delete(
    "/reporting/{reporting_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def delete_fse_reporting(
    request: Request,
    reporting_id: int,
    service: FinalSupplyEquipmentServices = Depends(),
):
    """
    Delete FSE compliance reporting data
    """
    await service.delete_fse_reporting(reporting_id)
