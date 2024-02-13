"""
User management endpoints
GET: /users/export?format=xls/xlsx/csv
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

from fastapi import (
    APIRouter,
    Body,
    HTTPException,
    status,
    Request,
    Response,
    Depends,
    Query,
)
from fastapi.responses import StreamingResponse

from lcfs.web.api.role.schema import RoleSchema
from lcfs.db import dependencies
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    lcfs_cache_key_builder,
)
from lcfs.web.api.user.repo import UserRepository
from lcfs.web.api.user.schema import UserCreate, UserBase, UserHistories, Users

from lcfs.web.core.decorators import roles_required, view_handler
from lcfs.web.api.user.services import UserServices

router = APIRouter()
logger = getLogger("users")
get_async_db = dependencies.get_async_db_session


@router.get("/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK)
@roles_required("Government")
@view_handler
async def export_users(
    request: Request,
    format: str = Query(default="xls", description="File export format"),
    service: UserServices = Depends(),
):
    """
    Endpoint to export information of all users

    This endpoint can support exporting data in different file formats (xls, xlsx, csv)
    as specified by the 'format' and 'media_type' variables.
    - 'format' specifies the file format: options are 'xls', 'xlsx', and 'csv'.
    - 'media_type' sets the appropriate MIME type based on 'format':
        'application/vnd.ms-excel' for 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' for 'xlsx',
        'text/csv' for 'csv'.

    The SpreadsheetBuilder class is used for building the spreadsheet.
    It allows adding multiple sheets with custom styling options and exports them as a byte stream.
    Also, an example of how to use the SpreadsheetBuilder is provided in its class documentation.

    Note: Only the first sheet data is used for the CSV format,
        as CSV files do not support multiple sheets.
    """
    return await service.export_users(format)


@router.post("/list", response_model=Users, status_code=status.HTTP_200_OK)
@roles_required("Government")
@view_handler
async def get_users(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    response: Response = None,
    service: UserServices = Depends(),
) -> Users:
    """
    Enpoint to get information of all users for ag-grid in the UI

    Pagination Request Schema:
    - page: offset/ page indicates the pagination of rows for the users list
    - size: size indicates the number of rows per page for the users list
    - sortOrders: sortOrders is an array of objects that specify the sorting criteria for the users list.
        Each object has the following properties:
        - field: the name of the field to sort by
        - direction: the sorting direction ('asc' or 'desc')
    - filterModel: filterModel is an array of objects that specifies the filtering criteria for the users list.
        It has the following properties:
        - filterType: the type of filtering to perform ('text', 'number', 'date', 'boolean')
        - type: the type of filter to apply ('equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith')
        - filter: the actual filter value
        - field: Database Field that needs filtering.
    """
    return await service.get_all_users(pagination)


@router.get("/current", response_model=UserBase, status_code=status.HTTP_200_OK)
@view_handler
async def get_current_user(request: Request, response: Response = None) -> UserBase:
    """
    Endpoint to get information of the current user

    This endpoint returns the information of the current user, including their roles and organization.
    """
    return UserBase.model_validate(request.user)


@router.get("/{user_id}", response_model=UserBase, status_code=status.HTTP_200_OK)
@roles_required("Government")
@view_handler
async def get_user_by_id(
    request: Request,
    user_id: int,
    service: UserServices = Depends(),
) -> UserBase:
    """
    Endpoint to get information of a user by ID
    This endpoint returns the information of a user by ID, including their roles and organization.
    """
    return await service.get_user_by_id(user_id)


@router.post("", response_model=UserBase, status_code=status.HTTP_201_CREATED)
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
