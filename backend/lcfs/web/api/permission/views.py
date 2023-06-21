from logging import getLogger

from fastapi import APIRouter, status, FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from starlette.responses import Response

from lcfs.db import dependencies
from lcfs.web.api.base_schema import EntityResponse
from lcfs.web.api.permission.session import PermissionRepository

router = APIRouter()
logger = getLogger("permissions")
get_async_db = dependencies.get_async_db_session
# get_db = dependencies.get_db_session
app = FastAPI()


@router.get("", response_model=EntityResponse, status_code=status.HTTP_200_OK)
async def get_permissions(db: AsyncSession = Depends(get_async_db), response: Response = None) -> EntityResponse:
    try:
        permissions = await PermissionRepository(db).get_all_permissions()
        if len(permissions) == 0:
            logger.error("Error getting permissions")
            response.status_code = status.HTTP_404_NOT_FOUND
            return EntityResponse(status=status.HTTP_404_NOT_FOUND,
                                  message="Failed", success=False, data={},
                                  error={"message": "No permissions found"})
        return EntityResponse(status=status.HTTP_200_OK, data=permissions,
                              total=len(permissions), error={},
                              success=True, message="Success")
    except Exception as e:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        logger.error("Error getting permissions", str(e.args[0]))
        return EntityResponse(status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                              message="Failed", success=False, data={},
                              error={"message": f"Technical error: {e.args[0]}"})
