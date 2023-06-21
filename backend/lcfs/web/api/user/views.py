"""
User management endpoints
GET: /users/current
GET: /users/<user_id>
GET: /users
GET: /users/search?username=...&organization=...&surname=...&include_inactive=false
POST: /users/create
PATCH: /users/<user_id>
DELETE: /users/<user_id> (Delete only if the user has never logged in/mapped)
GET: /users/<user_id>/roles {List of Roles with IDs}
GET: /users/<user_id>/history
"""
from logging import getLogger

from fastapi import APIRouter, status, FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from lcfs.db import dependencies
from lcfs.web.api.base_schema import EntityResponse
from lcfs.web.api.user.session import UserRepository

router = APIRouter()
logger = getLogger("role")
get_async_db = dependencies.get_async_db_session
# get_db = dependencies.get_db_session
app = FastAPI()


@router.get("", response_model=EntityResponse, status_code=status.HTTP_200_OK)
async def get_users(db: AsyncSession = Depends(get_async_db),
                    response: Response = None) -> EntityResponse:
    try:
        users = await UserRepository(db).get_all_users()
        if users.__len__() == 0:
            logger.error("Error getting users")
            response.status_code = status.HTTP_404_NOT_FOUND
            return EntityResponse(status=status.HTTP_404_NOT_FOUND,
                                  message="Not Found", success=False, data={},
                                  error={"message": "No users found"})
        return EntityResponse(status=status.HTTP_200_OK, data=users,
                              total=len(users), error={},
                              success=True, message="Success")
    except Exception as e:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        logger.error("Error getting users", str(e.args[0]))
        return EntityResponse(status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                              message="Failed", success=False, data={},
                              error={"message": f"Technical error: {e.args[0]}"})


@router.get("/{user_id}", response_model=EntityResponse, status_code=status.HTTP_200_OK)
async def get_user_by_id(user_id: int, db: AsyncSession = Depends(get_async_db),
                         response: Response = None) -> EntityResponse:
    try:
        user = await UserRepository(db).get_user(user_id)
        if user is None:
            logger.error("Error getting users")
            response.status_code = status.HTTP_404_NOT_FOUND
            return EntityResponse(status=status.HTTP_404_NOT_FOUND,
                                  message="Not Found", success=False, data={},
                                  error={"message": f"User {user_id} not found"})
        return EntityResponse(status=status.HTTP_200_OK, data=user,
                              total=1, error={},
                              success=True, message="Success")
    except Exception as e:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        logger.error("Error getting users", str(e.args[0]))
        return EntityResponse(status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                              message="Failed", success=False, data={},
                              error={"message": f"Technical error: {e.args[0]}"})
