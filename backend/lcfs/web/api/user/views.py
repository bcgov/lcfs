"""
User management endpoints
GET: /users/current
GET: /users/<user_id>
POST: /users/list (Includes ability to perform sort, filter and pagination)
POST: /users (Create a new user)
PUT: /users/<user_id> (Update the user)
DELETE: /users/<user_id> (Delete only if the user has never logged in/mapped)
GET: /users/<user_id>/roles {List of Roles with IDs}
GET: /users/<user_id>/history
"""
import io
import math
from logging import getLogger
from typing import List
from datetime import datetime

from fastapi import APIRouter, Body, HTTPException, status, Request
from fastapi_cache.decorator import cache
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi.responses import StreamingResponse
from starlette.responses import Response
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder

from lcfs.web.api.role.schema import RoleSchema
from lcfs.db import dependencies
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.user.session import UserRepository
from lcfs.web.api.user.schema import UserCreate, UserBase, UserHistories, Users
from lcfs.web.core.decorators import roles_required
from fastapi import Depends

router = APIRouter()
logger = getLogger("users")
get_async_db = dependencies.get_async_db_session
# Initialize the cache with Redis backend
FastAPICache.init(RedisBackend(dependencies.pool), prefix="fastapi-cache")


@router.get("/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK)
@roles_required("Government")
async def export_users(
    request: Request,
    user_repo: UserRepository = Depends(),
):
    """
    Endpoint to export information of all users

    This endpoint can support exporting data in different file formats (xls, xlsx, csv)
    as specified by the 'export_format' and 'media_type' variables.
    - 'export_format' specifies the file format: options are 'xls', 'xlsx', and 'csv'.
    - 'media_type' sets the appropriate MIME type based on 'export_format':
        'application/vnd.ms-excel' for 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' for 'xlsx',
        'text/csv' for 'csv'.

    The SpreadsheetBuilder class is used for building the spreadsheet.
    It allows adding multiple sheets with custom styling options and exports them as a byte stream.
    Also, an example of how to use the SpreadsheetBuilder is provided in its class documentation.

    Note: Only the first sheet data is used for the CSV format,
        as CSV files do not support multiple sheets.
    """
    export_format = "xls"
    media_type = "application/vnd.ms-excel"

    try:
        # Fetch all users from the database
        users = await user_repo.export_users()

        # Prepare data for the spreadsheet
        data = [
            [
                user.last_name,
                user.first_name,
                user.email,
                user.keycloak_username,
                user.title,
                user.phone,
                user.mobile_phone,
                "Active" if user.is_active else "Inactive",
                ", ".join(role.value for role in user.role_names),
                user.organization.name,
            ]
            for user in users
        ]

        # Create a spreadsheet
        builder = SpreadsheetBuilder(file_format=export_format)

        builder.add_sheet(
            sheet_name="BCeID Users",
            columns=[
                "Last name",
                "First name",
                "Email",
                "BCeID User ID",
                "Title",
                "Phone",
                "Mobile",
                "Status",
                "Role(s)",
                "Organization name",
            ],
            rows=data,
            styles={"bold_headers": True},
        )

        file_content = builder.build_spreadsheet()

        # Get the current date in YYYY-MM-DD format
        current_date = datetime.now().strftime("%Y-%m-%d")

        filename = f"BC-LCFS-bceid-{current_date}.{export_format}"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            io.BytesIO(file_content), media_type=media_type, headers=headers
        )

    except Exception as e:
        logger.error("Internal Server Error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error",
        ) from e


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


@router.get("/{user_id}", response_model=UserBase, status_code=status.HTTP_200_OK)
@roles_required("Government")
async def get_user_by_id(
    request: Request,
    user_id: int,
    response: Response = None,
    user_repo: UserRepository = Depends(),
) -> UserBase:
    try:
        user = await user_repo.get_user(user_id=user_id)
        if user is None:
            err_msg = f"User {user_id} not found"
            logger.error(err_msg)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        return UserBase.model_validate(user)
    except Exception as e:
        logger.error(f"Error getting user {user_id}", str(e))
        raise HTTPException(
            status_code=500, detail=f"Failed to get user {user_id}: {str(e)}"
        )


@router.post("/list", response_model=Users, status_code=status.HTTP_200_OK)
@roles_required("Government")
async def get_users(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    response: Response = None,
    user_repo: UserRepository = Depends(),
) -> Users:
    try:
        users, total_count = await user_repo.query_users(pagination=pagination)
        if len(users) == 0:
            logger.error("Error getting users")
            response.status_code = status.HTTP_404_NOT_FOUND
            return Users(
                pagination=PaginationResponseSchema(
                    total=0, page=0, size=0, total_pages=0
                ),
                users=users,
            )
        return Users(
            pagination=PaginationResponseSchema(
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
        raise HTTPException(
            status_code=500, detail=f"Technical Error: Failed to get users: {str(e)}"
        )


@router.post("", response_model=UserBase, status_code=status.HTTP_201_CREATED)
@roles_required("Government")
async def create_user(
    request: Request,
    response: Response = None,
    user_create: UserCreate = ...,
    user_repo: UserRepository = Depends(),
) -> UserBase:
    try:
        return await user_repo.create_user(user_create)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Technical Error: Failed to create user: {str(e)}"
        )


@router.put("/{user_id}", response_model=UserBase, status_code=status.HTTP_200_OK)
@roles_required("Government")
async def create_user(
    request: Request,
    response: Response = None,
    user_id: int = None,
    user_create: UserCreate = ...,
    user_repo: UserRepository = Depends(),
) -> UserBase:
    try:
        return await user_repo.update_user(user_create, user_profile_id=user_id)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Technical Error: Failed to create user: {str(e)}"
        )


@router.get(
    "/{user_id}/roles", response_model=List[RoleSchema], status_code=status.HTTP_200_OK
)
@roles_required("Government")
async def get_user_roles(
    request: Request,
    response: Response = None,
    user_id: int = None,
    user_repo: UserRepository = Depends(),
) -> List[RoleSchema]:
    try:
        user = await user_repo.get_user(user_id=user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )
        return [RoleSchema.model_validate(role.to_dict()) for role in user.user_roles]
        return []
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Technical Error: Failed to get user roles: {str(e)}",
        )


@router.get(
    "/{user_id}/history", response_model=UserHistories, status_code=status.HTTP_200_OK
)
@roles_required("Government")
async def get_user_history(
    request: Request,
    response: Response = None,
    user_id: int = None,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    user_repo: UserRepository = Depends(),
) -> UserHistories:
    try:
        user_histories, total_count = await user_repo.get_user_history(
            pagination=pagination
        )
        if len(user_histories) == 0:
            logger.error("Error getting user history")
            response.status_code = status.HTTP_404_NOT_FOUND
            return UserHistories(
                pagination=PaginationResponseSchema(
                    total=0, page=0, size=0, total_pages=0
                ),
                users=user_histories,
            )
        return UserHistories(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            history=user_histories,
        )
    except Exception as e:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        logger.error("Error getting user history", str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Technical Error: Failed to get user history: {str(e)}",
        )
