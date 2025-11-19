from typing import List
from fastapi import APIRouter, Request, status
from lcfs.utils.constants import FUEL_CATEGORIES
from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
from fastapi import Depends
from lcfs.web.api.calculator.schema import (
    CalculatorQueryParams,
    CalculatorQuantityQueryParams,
    CreditsResultSchema,
)
from lcfs.web.api.calculator.services import CalculatorService

router = APIRouter()


@router.get(
    "/compliance-periods",
    tags=["public"],
    response_model=List[CompliancePeriodBaseSchema],
    status_code=status.HTTP_200_OK,
)
async def get_calculator_compliance_periods(
    request: Request, service: CalculatorService = Depends()
) -> str:
    """
    Get list of compliance periods
    """
    return await service.get_compliance_periods()


@router.get(
    "/{compliance_period}/",
    tags=["public"],
    status_code=status.HTTP_200_OK,
)
async def get_calculator_fuel_types(
    request: Request,
    compliance_period: int,
    lcfs_only: bool = False,
    fuel_category: str = None,
    service: CalculatorService = Depends(),
):
    """
    Get list of fuel types
    """
    if fuel_category not in FUEL_CATEGORIES:
        return []
    return await service.get_fuel_types(compliance_period, lcfs_only, fuel_category)


@router.get(
    "/{compliance_period}/fuel-type-options/",
    tags=["public"],
    status_code=status.HTTP_200_OK,
)
async def get_calculator_fuel_type_options(
    request: Request,
    compliance_period: str,
    fuel_category_id: int,
    fuel_type_id: int,
    lcfs_only: bool = False,
    service: CalculatorService = Depends(),
):
    """
    Get list of fuel type options
    """
    return await service.get_fuel_type_options(
        compliance_period, fuel_type_id, fuel_category_id, lcfs_only
    )


@router.get(
    "/{compliance_period}/calculate/",
    tags=["public"],
    status_code=status.HTTP_200_OK,
)
async def get_calculated_data(
    request: Request,
    compliance_period: str,
    query: CalculatorQueryParams = Depends(),
    service: CalculatorService = Depends(),
) -> CreditsResultSchema:
    """
    Get calculated compliance units.
    """
    return await service.get_calculated_data(
        compliance_period,
        query.fuel_type_id,
        query.fuel_category_id,
        query.end_use_id,
        query.fuel_code_id,
        query.quantity,
    )


@router.get(
    "/{compliance_period}/calculate/quantity/",
    tags=["public"],
    status_code=status.HTTP_200_OK,
)
async def get_quantity_from_compliance_units(
    request: Request,
    compliance_period: str,
    query: CalculatorQuantityQueryParams = Depends(),
    service: CalculatorService = Depends(),
) -> CreditsResultSchema:
    """Get derived fuel quantity for a given number of compliance units."""

    return await service.get_quantity_from_compliance_units(
        compliance_period,
        query.fuel_type_id,
        query.fuel_category_id,
        query.end_use_id,
        query.fuel_code_id,
        query.compliance_units,
    )
