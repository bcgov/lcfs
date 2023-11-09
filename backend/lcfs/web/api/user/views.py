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
import math
from logging import getLogger
from typing import List

from fastapi import APIRouter, status, FastAPI, Depends, HTTPException, Request
from starlette.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.db import dependencies
from lcfs.web.api.base import EntityResponse
from lcfs.web.api.user.session import UserRepository
from lcfs.web.api.user.schema import UserCreate, UserBase

router = APIRouter()
logger = getLogger("users")
get_async_db = dependencies.get_async_db_session
user_repo = None  # Define user_repo at the global level

@router.on_event("startup")
async def startup_event():
    global user_repo
    async for db in get_async_db():  # Iterate over the async_generator
        user_repo = UserRepository(db)
        break  # Break after obtaining the database connection


@router.get("/current", response_model=UserBase, status_code=status.HTTP_200_OK)
async def get_current_user(request: Request, response: Response = None) -> UserBase:
    try:
        current_user = request.user
        if not current_user:
            err_msg = "Current user not found"
            logger.error(err_msg)
            response.status_code = status.HTTP_404_NOT_FOUND
            return UserBase(status=status.HTTP_404_NOT_FOUND,
                                  message="Not Found", success=False, data={},
                                  error={"message": err_msg})
        return UserBase.from_orm(current_user)
    except Exception as e:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        logger.error("Error getting current user", str(e.args[0]))
        return UserBase(status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                              message="Failed", success=False, data={},
                              error={"message": f"Technical error: {e.args[0]}"})



@router.get("/", response_model=List[UserBase], status_code=status.HTTP_200_OK)
async def get_users(limit: int = 10, offset: int = 0, response: Response = None) -> List[UserBase]:
    current_page = math.ceil(offset / limit) + 1
    try:
        users = await user_repo.query_users(
            pagination={
                "per_page": limit, 
                "page": offset, 
                "sort_field": "username", 
                "sort_direction": "asc"
            }
        )
        if len(users) == 0:
            logger.error("Error getting users")
            response.status_code = status.HTTP_404_NOT_FOUND
            return []
        
        # Convert the users to a list of UserBase objects
        user_bases = [UserBase.from_orm(user) for user in users]
        return user_bases  # Return the list of UserBase objects
    except Exception as e:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        logger.error("Error getting users", str(e.args[0]))
        return []  # Return an empty list if there's an error
    

@router.get("/search", response_model=EntityResponse, status_code=status.HTTP_200_OK)
async def get_user_search(username: str = None, organization: str = None,
                          surname: str = None, include_inactive: bool = False,
                          response: Response = None) -> EntityResponse:
    # TODO: add sorting and pagination
    try:
        users = await user_repo.search_users(username, organization,
                                                      surname, include_inactive)
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
async def get_user_by_id(user_id: int, response: Response = None) -> EntityResponse:
    try:
        user = await user_repo.get_user(user_id=user_id)
        if user is None:
            err_msg = f"User {user_id} not found"
            logger.error(err_msg)
            response.status_code = status.HTTP_404_NOT_FOUND
            return EntityResponse(status=status.HTTP_404_NOT_FOUND,
                                  message="Not Found", success=False, data={},
                                  error={"message": err_msg})
        return EntityResponse(status=status.HTTP_200_OK, data=user,
                              total=1, error={}, total_pages=1, limit=1,
                              success=True, message="Success")
    except Exception as e:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        logger.error(f"Error finding user {user_id}", str(e.args[0]))
        return EntityResponse(status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                              message="Failed", success=False, data={},
                              error={"message": f"Technical error: {e.args[0]}"})


@router.post("/create", response_model=EntityResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user_data: UserCreate, db: AsyncSession = Depends(get_async_db)) -> EntityResponse:
    try:
        user_repo = UserRepository(db)
        created_user = await user_repo.create_user(user_data)
        return EntityResponse(status=status.HTTP_201_CREATED, data=created_user, error={}, success=True, message="User created successfully")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")


