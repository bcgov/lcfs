from typing import List, Optional
from urllib.parse import urlencode
from fastapi import APIRouter, Query, Request, status
from fastapi.responses import JSONResponse
from lcfs.utils.constants import FUEL_CATEGORIES
from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
from fastapi import Depends
from lcfs.web.api.calculator.schema import CalculatorQueryParams, CreditsResultSchema
from lcfs.web.api.calculator.services import PublicService

router = APIRouter()


@router.get(
    "/compliance-periods",
    tags=["public"],
    response_model=List[CompliancePeriodBaseSchema],
    status_code=status.HTTP_200_OK,
)
async def get_compliance_periods(
    request: Request, service: PublicService = Depends()
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
async def get_fuel_types(
    request: Request,
    compliance_period: int,
    lcfs_only: bool = False,
    fuel_category: str = None,
    service: PublicService = Depends(),
):
    """
    Get list of fuel types
    """
    if fuel_category not in FUEL_CATEGORIES:
        return []
    return await service.get_fuel_types(compliance_period, lcfs_only, fuel_category)


@router.get(
    "/{compliance_period}/fuel-type-options",
    tags=["public"],
    status_code=status.HTTP_200_OK,
)
async def get_fuel_type_options(
    request: Request,
    compliance_period: str,
    fuel_category_id: int,
    fuel_type_id: int,
    lcfs_only: bool = False,
    service: PublicService = Depends(),
):
    """
    Get list of fuel type options
    """
    return await service.get_fuel_type_options(
        compliance_period, fuel_type_id, fuel_category_id, lcfs_only
    )


@router.get(
    "/{compliance_period}/calculate",
    tags=["public"],
    status_code=status.HTTP_200_OK,
)
async def get_calculated_data(
    request: Request,
    compliance_period: str,
    query: CalculatorQueryParams = Depends(),
    service: PublicService = Depends(),
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
