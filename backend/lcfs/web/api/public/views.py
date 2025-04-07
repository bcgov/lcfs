from typing import List
from fastapi import APIRouter, Request, status
from lcfs.utils.constants import FUEL_CATEGORIES
from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
from fastapi import Depends
from lcfs.web.api.public.services import PublicService

router = APIRouter()


@router.get(
    "/calculator/compliance-periods",
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
    "/calculator/{compliance_period}/",
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
