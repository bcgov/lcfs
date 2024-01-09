from logging import getLogger

from fastapi import APIRouter, status, FastAPI, Depends
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response
from fastapi_cache.decorator import cache
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend

from lcfs.db import dependencies
from lcfs.web.api.role.session import RoleRepository
from lcfs.web.api.role.schema import RoleSchema

router = APIRouter()
logger = getLogger("role")
get_async_db = dependencies.get_async_db_session
app = FastAPI()
# Initialize the cache with Redis backend
FastAPICache.init(RedisBackend(dependencies.pool), prefix="fastapi-cache")

@router.get("/list", response_model=List[RoleSchema], status_code=status.HTTP_200_OK)
@cache(expire=60 * 60 * 24)  # cache for 24 hours
async def get_roles(
    government_roles_only: bool = None,
    db: AsyncSession = Depends(get_async_db),
    response: Response = None,
) -> List[RoleSchema]:
    try:
        roles = await RoleRepository(db).get_all_roles(
            government_roles_only=government_roles_only
        )
        if len(roles) == 0:
            logger.error("Error getting roles")
            response.status_code = status.HTTP_404_NOT_FOUND
            return []
        return roles
    except Exception as e:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        logger.error("Error getting roles", str(e))
        return []
