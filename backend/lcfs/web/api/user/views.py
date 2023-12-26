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

from fastapi import APIRouter, Body, status, Request
from starlette.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.db import dependencies
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseScehema
from lcfs.web.api.user.session import UserRepository
from lcfs.web.api.user.schema import UserCreate, UserBase, Users
from lcfs.web.core.decorators import roles_required

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
            return UserBase(
                status=status.HTTP_404_NOT_FOUND,
                message="Not Found",
                success=False,
                data={},
                error={"message": err_msg},
            )
        return UserBase.model_validate(current_user)
    except Exception as e:
        logger.error("Error getting current user", str(e))
        return UserBase(
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="Failed",
            success=False,
            data={},
            error={"message": f"Technical error: {e.args[0]}"},
        )


@router.post("/list", response_model=Users, status_code=status.HTTP_200_OK)
@roles_required("Government")
async def get_users(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    response: Response = None,
) -> Users:
    try:
        users, total_count = await user_repo.query_users(pagination=pagination)
        if len(users) == 0:
            logger.error("Error getting users")
            response.status_code = status.HTTP_404_NOT_FOUND
            return Users(
                pagination=PaginationResponseScehema(
                    total=0, page=0, size=0, total_pages=0
                ),
                users=users,
            )
        return Users(
            pagination=PaginationResponseScehema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            users=users,
        )
    except Exception as e:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        logger.error("Error getting users", str(e))
        return Users(
            pagination=PaginationResponseScehema(
                total=0, page=0, size=0, total_pages=0
            ),
            users=[],
        )


# @router.get("/search", response_model=EntityResponse, status_code=status.HTTP_200_OK)
# async def get_user_search(
#     username: str = None,
#     organization: str = None,
#     surname: str = None,
#     include_inactive: bool = False,
#     response: Response = None,
# ) -> EntityResponse:
#     # TODO: add sorting and pagination
#     try:
#         users = await user_repo.search_users(
#             username, organization, surname, include_inactive
#         )
#         if users.__len__() == 0:
#             logger.error("Error getting users")
#             response.status_code = status.HTTP_404_NOT_FOUND
#             return EntityResponse(
#                 status=status.HTTP_404_NOT_FOUND,
#                 message="Not Found",
#                 success=False,
#                 data={},
#                 error={"message": "No users found"},
#             )
#         return EntityResponse(
#             status=status.HTTP_200_OK,
#             data=users,
#             total=len(users),
#             error={},
#             success=True,
#             message="Success",
#         )
#     except Exception as e:
#         response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
#         logger.error("Error getting users", str(e))
#         return EntityResponse(
#             status=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             message="Failed",
#             success=False,
#             data={},
#             error={"message": f"Technical error: {e.args[0]}"},
#         )


# TODO: yet to redefine and test endpoints for below.
# @router.get("/{user_id}", response_model=EntityResponse, status_code=status.HTTP_200_OK)
# async def get_user_by_id(user_id: int, response: Response = None) -> EntityResponse:
#     try:
#         user = await user_repo.get_user(user_id=user_id)
#         if user is None:
#             err_msg = f"User {user_id} not found"
#             logger.error(err_msg)
#             response.status_code = status.HTTP_404_NOT_FOUND
#             return EntityResponse(
#                 status=status.HTTP_404_NOT_FOUND,
#                 message="Not Found",
#                 success=False,
#                 data={},
#                 error={"message": err_msg},
#             )
#         return EntityResponse(
#             status=status.HTTP_200_OK,
#             data=user,
#             total=1,
#             error={},
#             total_pages=1,
#             size=10,
#             success=True,
#             message="Success",
#         )
#     except Exception as e:
#         response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
#         logger.error(f"Error finding user {user_id}", str(e.args[0]))
#         return EntityResponse(
#             status=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             message="Failed",
#             success=False,
#             data={},
#             error={"message": f"Technical error: {e.args[0]}"},
#         )


# @router.post(
#     "/create", response_model=EntityResponse, status_code=status.HTTP_201_CREATED
# )
# async def create_user(
#     user_data: UserCreate, db: AsyncSession = Depends(get_async_db)
# ) -> EntityResponse:
#     try:
#         user_repo = UserRepository(db)
#         created_user = await user_repo.create_user(user_data)
#         return EntityResponse(
#             status=status.HTTP_201_CREATED,
#             data=created_user,
#             error={},
#             success=True,
#             message="User created successfully",
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")
