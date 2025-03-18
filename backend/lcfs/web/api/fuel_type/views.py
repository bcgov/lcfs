import structlog
from typing import List

from fastapi import (
    APIRouter,
    status,
    Request,
    Depends,
)

from lcfs.db import dependencies
from lcfs.web.core.decorators import view_handler
from lcfs.web.api.fuel_type.services import FuelTypeServices

router = APIRouter()
logger = structlog.get_logger("fuel_type_view")
get_async_db = dependencies.get_async_db_session


@router.get("/others/list", response_model=List[str], status_code=status.HTTP_200_OK)
@view_handler(["*"])
async def get_fuel_type_others(
    request: Request,
    service: FuelTypeServices = Depends(),
):
    """Endpoint to get list of fuel type others"""
    return await service.get_fuel_type_others()
