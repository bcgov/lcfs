from logging import getLogger

from fastapi import (
    APIRouter,
    Body,
    status,
    Request,
    Response,
    Depends,
    Query,
)

from lcfs.db import dependencies
from lcfs.web.api.final_supply_equipment.schema import FSEOptionsSchema
from lcfs.web.api.final_supply_equipment.services import FinalSupplyEquipmentServices
from lcfs.web.core.decorators import view_handler

router = APIRouter()
logger = getLogger("fse_view")
get_async_db = dependencies.get_async_db_session

@router.get("/table-options", response_model=FSEOptionsSchema, status_code=status.HTTP_200_OK)
@view_handler
async def get_fse_options(service: FinalSupplyEquipmentServices = Depends()) -> FSEOptionsSchema:
    return await service.get_fse_options()
