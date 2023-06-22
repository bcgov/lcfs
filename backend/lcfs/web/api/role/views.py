from logging import getLogger

from fastapi import APIRouter, status, FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from lcfs.db import dependencies
from lcfs.web.api.base_schema import EntityResponse
from lcfs.web.api.role.session import RoleRepository

router = APIRouter()
logger = getLogger("role")
get_async_db = dependencies.get_async_db_session
# get_db = dependencies.get_db_session
app = FastAPI()


@router.get("", response_model=EntityResponse, status_code=status.HTTP_200_OK)
async def get_roles(government_roles_only: bool = False, db: AsyncSession = Depends(get_async_db), response: Response = None) -> EntityResponse:
    try:
        roles = await RoleRepository(db).get_all_roles(government_roles_only=government_roles_only)
        if len(roles) == 0:
            logger.error("Error getting roles")
            response.status_code = status.HTTP_404_NOT_FOUND
            return EntityResponse(status=status.HTTP_404_NOT_FOUND,
                                  message="Failed", success=False, data={},
                                  error={"message": "No roles found"})
        return EntityResponse(status=status.HTTP_200_OK, data=roles,
                              total=len(roles), error={},
                              success=True, message="Success")
    except Exception as e:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        logger.error("Error getting roles", str(e.args[0]))
        return EntityResponse(status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                              message="Failed", success=False, data={},
                              error={"message": f"Technical error: {e.args[0]}"})
