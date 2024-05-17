"""
Fuel codes endpoints
"""

from logging import getLogger
from typing import List

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
from lcfs.web.core.decorators import roles_required, view_handler
from lcfs.web.api.fuel_code.services import FuelCodeServices
from lcfs.web.api.fuel_code.schema import (
    AdditionalCarbonIntensitySchema,
    EnergyDensitySchema,
    EnergyEffectivenessRatioSchema,
    FuelCodeCreateSchema,
    FuelCodesSchema,
    TableOptionsSchema,
    FuelCodeSchema
)
from lcfs.web.api.base import PaginationRequestSchema

router = APIRouter()
logger = getLogger("fuel_code_view")
get_async_db = dependencies.get_async_db_session


@router.get(
    "/table-options", response_model=TableOptionsSchema, status_code=status.HTTP_200_OK
)
@roles_required("Government")
@view_handler
@cache(expire=60 * 60 * 24)  # cache for 24 hours
async def get_table_options(
    request: Request,
    service: FuelCodeServices = Depends(),
):
    """Endpoint to retrieve table options related to fuel codes"""
    return await service.get_table_options()


@router.post("/list", response_model=FuelCodesSchema, status_code=status.HTTP_200_OK)
@roles_required("Government")
@view_handler
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
@roles_required("Government")
@view_handler
async def save_fuel_codes(
    request: Request,
    fuel_codes: List[FuelCodeCreateSchema] = Body(..., embed=False),
    service: FuelCodeServices = Depends(),
) -> str:
    """Endpoint to save fuel codes"""
    return await service.save_fuel_codes(fuel_codes)



@router.get("/{fuel_code_id}", status_code=status.HTTP_200_OK)
@view_handler
async def get_fuel_code(
    request: Request,
    fuel_code_id: int,
    service: FuelCodeServices = Depends(),
) -> FuelCodeSchema:
    return await service.get_fuel_code(fuel_code_id)


@router.put("/{fuel_code_id}", status_code=status.HTTP_200_OK)
@view_handler
async def update_fuel_code(
    request: Request,
    fuel_code_id: int,
    fuel_code_data: FuelCodeCreateSchema,
    service: FuelCodeServices = Depends(),
):
    return await service.update_fuel_code(fuel_code_id, fuel_code_data)


@router.delete("/{fuel_code_id}", status_code=status.HTTP_200_OK)
@view_handler
async def delete_fuel_code(
    request: Request,
    fuel_code_id: int,
    service: FuelCodeServices = Depends()
):
    return await service.delete_fuel_code(fuel_code_id)

@router.get(
    "/energy-densities",
    response_model=List[EnergyDensitySchema],
    status_code=status.HTTP_200_OK,
)
@view_handler
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
@view_handler
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
@view_handler
async def get_use_of_a_carbon_intensities(
    request: Request,
    service: FuelCodeServices = Depends(),
):
    """Endpoint to get UCI's"""
    return await service.get_use_of_a_carbon_intensities()

