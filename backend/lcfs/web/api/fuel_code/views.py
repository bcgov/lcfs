"""
Fuel codes endpoints
"""

import structlog
from typing import List, Union, Optional

from fastapi import (
    APIRouter,
    Body,
    status,
    Request,
    Response,
    Depends,
    Query,
)
from fastapi_cache.decorator import cache
from starlette.responses import StreamingResponse

from lcfs.db import dependencies
from lcfs.web.api.fuel_code.export import FuelCodeExporter
from lcfs.web.core.decorators import view_handler
from lcfs.web.api.fuel_code.services import FuelCodeServices
from lcfs.web.api.fuel_code.schema import (
    FuelCodeCreateSchema,
    FuelCodesSchema,
    FuelCodeSchema,
    SearchFuelCodeList,
    TableOptionsSchema,
    FuelCodeSchema,
    DeleteFuelCodeResponseSchema,
)
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.db.models.user.Role import RoleEnum

router = APIRouter()
logger = structlog.get_logger(__name__)
get_async_db = dependencies.get_async_db_session


@router.get(
    "/table-options", response_model=TableOptionsSchema, status_code=status.HTTP_200_OK
)
@view_handler([RoleEnum.GOVERNMENT])
async def get_fuel_code_table_options(
    request: Request,
    service: FuelCodeServices = Depends(),
):
    """Endpoint to retrieve table options related to fuel codes"""
    logger.info("Retrieving table options")
    return await service.get_table_options()


@router.get(
    "/search",
    response_model=Union[SearchFuelCodeList, List[str]],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def search_fuel_code_table_options_strings(
    request: Request,
    company: Optional[str] = Query(
        None, alias="company", description="Company for filtering options"
    ),
    contact_name: Optional[str] = Query(
        None, alias="contactName", description="Contact name for filtering options"
    ),
    contact_email: Optional[str] = Query(
        None, alias="contactEmail", description="Contact email for filtering options"
    ),
    fuel_code: Optional[str] = Query(
        None, alias="fuelCode", description="Fuel code for filtering options"
    ),
    prefix: Optional[str] = Query(
        None, alias="prefix", description="Prefix for filtering options"
    ),
    distinct_search: Optional[bool] = Query(
        False,
        alias="distinctSearch",
        description="Based on flag retrieve entire row data or just the list of distinct values",
    ),
    service: FuelCodeServices = Depends(),
):
    """Endpoint to search fuel codes based on a query string"""
    if fuel_code:
        logger.info("Searching fuel code", fuel_code=fuel_code, prefix=prefix)
        return await service.search_fuel_code(fuel_code, prefix, distinct_search)
    elif company:
        logger.info("Searching company", company=company, prefix=prefix)
        if contact_email and contact_name and company:
            logger.info(
                "Searching contact email under company",
                contact_email=contact_email,
                company=company,
            )
            return await service.search_contact_email(
                company, contact_name, contact_email
            )
        elif contact_name and company:
            logger.info(
                "Searching contact name under company",
                contact_name=contact_name,
                company=company,
            )
            return await service.search_contact_name(company, contact_name)
        return await service.search_company(company)
    else:
        raise ValueError("Invalid parameters provided for search")


@router.post("/list", response_model=FuelCodesSchema, status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.GOVERNMENT])
async def get_fuel_codes(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    response: Response = None,
    service: FuelCodeServices = Depends(),
):
    """Endpoint to get list of fuel codes with pagination options"""
    return await service.get_fuel_codes(pagination)


@router.get("/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.GOVERNMENT])
async def export_users(
    request: Request,
    format: str = Query(default="xls", description="File export format"),
    exporter: FuelCodeExporter = Depends(),
):
    """
    Endpoint to export information of all fuel codes

    This endpoint can support exporting data in different file formats (xls, xlsx, csv)
    as specified by the 'format' and 'media_type' variables.
    - 'format' specifies the file format: options are 'xls', 'xlsx', and 'csv'.
    - 'media_type' sets the appropriate MIME type based on 'format':
        'application/vnd.ms-excel' for 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' for 'xlsx',
        'text/csv' for 'csv'.

    The SpreadsheetBuilder class is used for building the spreadsheet.
    It allows adding multiple sheets with custom styling options and exports them as a byte stream.
    Also, an example of how to use the SpreadsheetBuilder is provided in its class documentation.

    Note: Only the first sheet data is used for the CSV format,
        as CSV files do not support multiple sheets.
    """
    return await exporter.export(format)


@router.get("/{fuel_code_id}", status_code=status.HTTP_200_OK)
@view_handler(["*"])
async def get_fuel_code(
    request: Request,
    fuel_code_id: int,
    service: FuelCodeServices = Depends(),
) -> FuelCodeSchema:
    return await service.get_fuel_code(fuel_code_id)


@router.put("/{fuel_code_id}", status_code=status.HTTP_200_OK)
@view_handler(["*"])
async def update_fuel_code(
    request: Request,
    fuel_code_id: int,
    fuel_code_data: FuelCodeCreateSchema,
    service: FuelCodeServices = Depends(),
):
    return await service.update_fuel_code(fuel_code_id, fuel_code_data)


@router.delete("/{fuel_code_id}", status_code=status.HTTP_200_OK)
@view_handler(["*"])
async def delete_fuel_code(
    request: Request, fuel_code_id: int, service: FuelCodeServices = Depends()
):
    return await service.delete_fuel_code(fuel_code_id)


@router.post(
    "/save",
    response_model=Union[FuelCodeSchema, DeleteFuelCodeResponseSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ADMINISTRATOR])
async def save_fuel_code_row(
    request: Request,
    request_data: FuelCodeCreateSchema = Body(...),
    service: FuelCodeServices = Depends(),
):
    """Endpoint to save a single fuel code row"""
    fuel_code_id: Optional[int] = request_data.fuel_code_id

    if request_data.deleted:
        # Delete existing fuel code
        await service.delete_fuel_code(fuel_code_id)
        return DeleteFuelCodeResponseSchema(message="Fuel code deleted successfully")
    elif fuel_code_id:
        # Update existing fuel code
        return await service.update_fuel_code(fuel_code_id, request_data)
    else:
        # Create new fuel code
        return await service.create_fuel_code(request_data)
