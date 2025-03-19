from typing import List

import structlog
from fastapi import APIRouter, Body, status, Request, Response, Depends, Query
from fastapi.responses import StreamingResponse

from lcfs.db import dependencies
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema, FilterModel
from lcfs.web.api.role.schema import RoleSchema
from lcfs.web.api.user.schema import (
    UserCreateSchema,
    UserBaseSchema,
    UserLoginHistoryResponseSchema,
    UsersSchema,
    UserActivitiesResponseSchema,
    UpdateEmailSchema,
)
from lcfs.web.api.user.services import UserServices
from lcfs.web.core.decorators import view_handler

router = APIRouter()
logger = structlog.get_logger(__name__)
get_async_db = dependencies.get_async_db_session


@router.get("/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.GOVERNMENT])
async def export_users(
    request: Request,
    format: str = Query(default="xlsx", description="File export format"),
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


@router.post("/list", response_model=UsersSchema, status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.GOVERNMENT])
async def get_users(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    response: Response = None,
    service: UserServices = Depends(),
) -> UsersSchema:
    """
    Endpoint to get information of all users for ag-grid in the UI

    Pagination Request Schema:
    - page: offset/ page indicates the pagination of rows for the users list
    - size: size indicates the number of rows per page for the users list
    - sortOrders: sortOrders is an array of objects that specify the sorting criteria for the users list.
        Each object has the following properties:
        - field: the name of the field to sort by
        - direction: the sorting direction ('asc' or 'desc')
    - filterModel: filterModel is an array of objects that specifies the filtering criteria for the users list.
        It has the following properties:
        - filter_type: the type of filtering to perform ('text', 'number', 'date', 'boolean')
        - type: the type of filter to apply ('equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith')
        - filter: the actual filter value
        - field: Database Field that needs filtering.
    """
    pagination.filters = [
        *pagination.filters,
        FilterModel(
            filter_type="text", type="blank", field="organizationId", filter=""
        ),
    ]

    return await service.get_all_users(pagination)


@router.post("/logged-in", status_code=status.HTTP_200_OK)
@view_handler(["*"])
async def track_logged_in(
    request: Request, response: Response = None, service: UserServices = Depends()
) -> str:
    """
    Endpoint to track when a user logs in

    This endpoint returns the information of the current user, including their roles and organization.
    """

    await service.track_user_login(request.user)
    return "Tracked"


@router.get("/current", response_model=UserBaseSchema, status_code=status.HTTP_200_OK)
@view_handler(["*"])
async def get_current_user(
    request: Request, response: Response = None
) -> UserBaseSchema:
    """
    Endpoint to get information of the current user

    This endpoint returns the information of the current user, including their roles and organization.
    """
    return UserBaseSchema.model_validate(request.user)


@router.get("/{user_id}", response_model=UserBaseSchema, status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.GOVERNMENT])
async def get_user_by_id(
    request: Request,
    user_id: int,
    service: UserServices = Depends(),
) -> UserBaseSchema:
    """
    Endpoint to get information of a user by ID
    This endpoint returns the information of a user by ID, including their roles and organization.
    """
    return await service.get_user_by_id(user_id)


@router.post("", response_model=None, status_code=status.HTTP_201_CREATED)
@view_handler([RoleEnum.ADMINISTRATOR])
async def create_user(
    request: Request,
    response: Response = None,
    user_create: UserCreateSchema = ...,
    service: UserServices = Depends(),
) -> None:
    """
    Endpoint to create a new user
    This endpoint creates a new user and returns the information of the created user.
    """
    return await service.create_user(user_create)


@router.put("/{user_id}", response_model=UserBaseSchema, status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.ADMINISTRATOR])
async def update_user(
    request: Request,
    response: Response = None,
    user_id: int = None,
    user_create: UserCreateSchema = ...,
    service: UserServices = Depends(),
) -> UserBaseSchema:
    """
    Endpoint to update a user
    This endpoint updates a user and returns the information of the updated user.
    """
    await service.update_user(user_create, user_id)
    return await service.get_user_by_id(user_id)


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
@view_handler([RoleEnum.ADMINISTRATOR])
async def delete_user(
    request: Request,
    response: Response = None,
    user_id: int = None,
    service: UserServices = Depends(),
) -> None:
    """
    Endpoint to delete a user
    This endpoint deletes a user, if the user is safe to remove.
    """
    return await service.remove_user(user_id)


@router.get(
    "/{user_id}/roles", response_model=List[RoleSchema], status_code=status.HTTP_200_OK
)
@view_handler([RoleEnum.GOVERNMENT])
async def get_user_roles(
    request: Request,
    response: Response = None,
    user_id: int = None,
    service: UserServices = Depends(),
) -> List[RoleSchema]:
    """
    Endpoint to get the roles of a user
    """
    return await service.get_user_roles(user_id)


@router.post(
    "/{user_id}/activity",
    response_model=UserActivitiesResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ADMINISTRATOR, RoleEnum.MANAGE_USERS])
async def get_user_activities(
    request: Request,
    user_id: int,
    pagination: PaginationRequestSchema = Body(...),
    service: UserServices = Depends(),
) -> UserActivitiesResponseSchema:
    """
    Get activities of a specific user.

    Permissions:
    - Government users with 'ADMINISTRATOR' role can access any user's activities.
    - Supplier users with 'MANAGE_USERS' role can access activities of users within
        their own organization.
    """
    current_user = request.user
    return await service.get_user_activities(user_id, current_user, pagination)


@router.post(
    "/activities/all",
    response_model=UserActivitiesResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ADMINISTRATOR])
async def get_all_user_activities(
    request: Request,
    pagination: PaginationRequestSchema = Body(...),
    service: UserServices = Depends(),
) -> UserActivitiesResponseSchema:
    """
    Get activities of all users.
    """
    current_user = request.user
    return await service.get_all_user_activities(current_user, pagination)


@router.post(
    "/login-history",
    response_model=UserLoginHistoryResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ADMINISTRATOR])
async def get_all_user_login_history(
    request: Request,
    pagination: PaginationRequestSchema = Body(...),
    service: UserServices = Depends(),
) -> UserLoginHistoryResponseSchema:
    """
    Get users login history.
    """
    current_user = request.user
    return await service.get_all_user_login_history(current_user, pagination)


@router.post(
    "/update-email",
    response_model=UpdateEmailSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def update_email(
    request: Request,
    email_data: UpdateEmailSchema = Body(...),
    service: UserServices = Depends(),
):
    user_id = request.user.user_profile_id
    email = email_data.email

    user = await service.update_email(user_id, email)
    return UpdateEmailSchema(email=user.email)
