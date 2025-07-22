"""
Fuel codes endpoints
"""

from typing import List, Union, Optional

from datetime import date, timedelta
import structlog
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
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.export import FuelCodeExporter
from lcfs.web.api.fuel_code.schema import (
    ExpiringFuelCodesSchema,
    FuelCodeCreateUpdateSchema,
    FuelCodesSchema,
    SearchFuelCodeList,
    TableOptionsSchema,
    FuelCodeSchema,
    FuelCodeStatusSchema,
    TransportModeSchema,
)
from lcfs.web.api.fuel_code.services import FuelCodeServices
from lcfs.web.core.decorators import view_handler

router = APIRouter()
logger = structlog.get_logger(__name__)
get_async_db = dependencies.get_async_db_session


@router.get(
    "/table-options", response_model=TableOptionsSchema, status_code=status.HTTP_200_OK
)
@view_handler([RoleEnum.GOVERNMENT])
async def get_table_options(
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
async def search_table_options_strings(
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
    fp_city: Optional[str] = Query(
        None,
        alias="fpCity",
        description="Fuel production facility city for suggestions",
    ),
    fp_province: Optional[str] = Query(
        None,
        alias="fpProvince",
        description="Fuel production facility province for suggestions",
    ),
    fp_country: Optional[str] = Query(
        None,
        alias="fpCountry",
        description="Fuel production facility country for suggestions",
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
    elif fp_city or fp_province or fp_country:
        logger.info("Searching fuel production facility location")
        return await service.search_fp_facility_location(
            fp_city, fp_province, fp_country
        )
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
    return await service.search_fuel_codes(pagination)


@router.post(
    "/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK
)
@view_handler([RoleEnum.GOVERNMENT])
async def export_fuel_codes(
    request: Request,
    format: str = Query(default="xlsx", description="File export format"),
    pagination: PaginationRequestSchema | None = Body(None),
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
    return await exporter.export(format, pagination)


@router.get(
    "/statuses",
    response_model=List[FuelCodeStatusSchema],
    status_code=status.HTTP_200_OK,
)
@cache(expire=60 * 60 * 24)  # cache for 24 hours
@view_handler(["*"])
async def get_fuel_code_statuses(
    request: Request, service: FuelCodeServices = Depends()
) -> List[FuelCodeStatusSchema]:
    """Fetch all fuel code statuses"""
    return await service.get_fuel_code_statuses()


@router.get(
    "/transport-modes",
    response_model=List[TransportModeSchema],
    status_code=status.HTTP_200_OK,
)
@cache(expire=60 * 60 * 24)  # cache for 24 hours
@view_handler(["*"])
async def get_transport_modes(
    request: Request, service: FuelCodeServices = Depends()
) -> List[TransportModeSchema]:
    """Fetch all fuel code transport modes"""
    return await service.get_transport_modes()

@router.get(
    "/expiring",
    response_model=List[ExpiringFuelCodesSchema],
    status_code=status.HTTP_200_OK,
)
async def get_expiring_fuel_codes(
    from_date: date = Query(
        default_factory=lambda: (date.today() + timedelta(days=90)).isoformat(),
        description="Start of the expiration window (defaults to 88 days from today)",
    ),
    service: FuelCodeServices = Depends(),
) -> List[ExpiringFuelCodesSchema]:
    """Fetch all fuel codes expiring within a given date range (88-119 days from today by default)"""
    return await service.send_fuel_code_expiry_notifications(from_date)

@router.get("/{fuel_code_id}", status_code=status.HTTP_200_OK)
@view_handler(["*"])
async def get_fuel_code(
    request: Request,
    fuel_code_id: int,
    service: FuelCodeServices = Depends(),
) -> FuelCodeSchema:
    return await service.get_fuel_code(fuel_code_id)


@router.post("/{fuel_code_id}/approve", status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.GOVERNMENT])
async def approve_fuel_code(
    request: Request,
    fuel_code_id: int,
    service: FuelCodeServices = Depends(),
):
    # TODO: Add Logic that checks if the code has necessary fields for approval
    return await service.approve_fuel_code(fuel_code_id)


@router.post("", status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.ANALYST])
async def save_fuel_code(
    request: Request,
    fuel_code_data: FuelCodeCreateUpdateSchema,
    service: FuelCodeServices = Depends(),
):
    """Endpoint to create or update a fuel code"""
    if fuel_code_data.fuel_code_id:
        return await service.update_fuel_code(fuel_code_data)
    else:
        return await service.create_fuel_code(fuel_code_data)


@router.delete("/{fuel_code_id}", status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.ANALYST])
async def delete_fuel_code(
    request: Request, fuel_code_id: int, service: FuelCodeServices = Depends()
):
    return await service.delete_fuel_code(fuel_code_id)

