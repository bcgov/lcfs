"""
Fuel codes endpoints
"""

from logging import getLogger

from fastapi import APIRouter, Request, status, FastAPI, Depends
from lcfs.web.api.fuel_code.services import FuelCodeServices
from fastapi_cache.decorator import cache

from lcfs.db import dependencies
from lcfs.web.core.decorators import roles_required, view_handler
from lcfs.web.api.fuel_code.schema import TableOptionsSchema

router = APIRouter()
logger = getLogger("fuel_code_view")
get_async_db = dependencies.get_async_db_session
app = FastAPI()


@router.get("/table-options", response_model=TableOptionsSchema, status_code=status.HTTP_200_OK)
@roles_required("Government")
@view_handler
@cache(expire=60 * 60 * 24)  # cache for 24 hours
async def get_table_options(
    request: Request,
    service: FuelCodeServices = Depends(),
):
    """Endpoint to retrieve table options related to fuel codes"""
    return await service.get_table_options()
