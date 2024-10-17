"""
Fuel codes endpoints
"""

from logging import getLogger
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

from lcfs.db import dependencies
from lcfs.web.core.decorators import view_handler
from lcfs.web.api.fuel_code.services import FuelCodeServices
from lcfs.web.api.fuel_code.schema import (
    AdditionalCarbonIntensitySchema,
    EnergyDensitySchema,
    EnergyEffectivenessRatioSchema,
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
logger = getLogger("fuel_code_view")
get_async_db = dependencies.get_async_db_session


@router.get(
    "/table-options", response_model=TableOptionsSchema, status_code=status.HTTP_200_OK
)
@view_handler([RoleEnum.GOVERNMENT])
@cache(expire=60 * 60 * 24)  # cache for 24 hours
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
    distinct_search: Optional[bool] = Query(
        False,
        alias="distinctSearch",
        description="Based on flag retrieve entire row data or just the list of distinct values",
    ),
    service: FuelCodeServices = Depends(),
):
    """Endpoint to search fuel codes based on a query string"""
    if fuel_code:
        logger.info(f"Searching for fuel code: {fuel_code} with prfix: {prefix}")
        return await service.search_fuel_code(fuel_code, prefix, distinct_search)
    elif company:
        logger.info(f"Searching for company: {company} with prefix: {prefix}")
        if contact_email and contact_name and company:
            logger.info(
                f"Searching for contact email: {contact_email} under the company: {company}"
            )
            return await service.search_contact_email(
                company, contact_name, contact_email
            )
        elif contact_name and company:
            logger.info(
                f"Searching for contact name: {contact_name} under the company: {company}"
            )
            return await service.search_contact_name(company, contact_name)
        return await service.search_company(company)
    else:
        logger.info("Invalid search parameters")
        return {"error": "Invalid search parameters"}


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


@router.post(
    "/save-fuel-codes",
    response_model=str,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.GOVERNMENT])
async def save_fuel_codes(
    request: Request,
    fuel_codes: List[FuelCodeCreateSchema] = Body(..., embed=False),
    service: FuelCodeServices = Depends(),
) -> str:
    """Endpoint to save fuel codes"""
    return await service.save_fuel_codes(fuel_codes)


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


@router.get(
    "/energy-densities",
    response_model=List[EnergyDensitySchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_energy_densities(
    request: Request,
    service: FuelCodeServices = Depends(),
):
    """Endpoint to get energy densities"""
    return await service.get_energy_densities()


@router.get(
    "/energy-effectiveness-ratios",
    response_model=List[EnergyEffectivenessRatioSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_energy_effectiveness_ratios(
    request: Request,
    service: FuelCodeServices = Depends(),
):
    """Endpoint to get energy effectiveness ratios (EER)"""
    return await service.get_energy_effectiveness_ratios()


@router.get(
    "/additional-carbon-intensities",
    response_model=List[AdditionalCarbonIntensitySchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_use_of_a_carbon_intensities(
    request: Request,
    service: FuelCodeServices = Depends(),
):
    """Endpoint to get UCI's"""
    return await service.get_use_of_a_carbon_intensities()


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
