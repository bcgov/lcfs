"""
Roles endpoints
GET: /roles?government_roles_only=true
"""

import structlog

from fastapi import APIRouter, Request, status, FastAPI, Depends
from typing import List
from lcfs.web.api.role.services import RoleServices
from starlette.responses import Response
from fastapi_cache.decorator import cache

from lcfs.db import dependencies
from lcfs.web.api.role.schema import RoleSchema
from lcfs.web.core.decorators import view_handler
from lcfs.db.models.user.Role import RoleEnum

router = APIRouter()
logger = structlog.get_logger(__name__)
get_async_db = dependencies.get_async_db_session
app = FastAPI()


@router.get("/", response_model=List[RoleSchema], status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.SUPPLIER])
@cache(expire=60 * 60 * 24)  # cache for 24 hours
async def get_roles(
    request: Request,
    government_roles_only: bool = None,
    service: RoleServices = Depends(),
    response: Response = None,
) -> List[RoleSchema]:
    logger.info(
        "Retrieving roles: government_roles_only",
        government_roles_only=government_roles_only
    )
    return await service.get_roles(government_roles_only)
