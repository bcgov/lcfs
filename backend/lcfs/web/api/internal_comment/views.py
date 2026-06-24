import structlog
from typing import List, Optional
from datetime import date

from fastapi import APIRouter, Body, Depends, Query, status, Request, HTTPException

from lcfs.db import dependencies
from lcfs.web.core.decorators import view_handler
from .services import InternalCommentService

from .schema import (
    CommentSortFieldEnum,
    CommentSortOrderEnum,
    CommentVisibilityEnum,
    InternalCommentCreateSchema,
    InternalCommentUpdateSchema,
    InternalCommentResponseSchema,
    OrganizationCommentsFilterSchema,
    OrganizationCommentsResponseSchema,
)
from typing import List
from lcfs.db.models.user.Role import RoleEnum

logger = structlog.get_logger(__name__)
router = APIRouter()
org_comments_router = APIRouter()
get_async_db = dependencies.get_async_db_session


@org_comments_router.get(
    "/{organization_id}/comments",
    response_model=OrganizationCommentsResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.SUPPLIER])
async def get_organization_comments(
    request: Request,
    organization_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
    category: Optional[str] = Query(None, description="Exact category display name."),
    compliance_year: Optional[int] = Query(None, description="Compliance year."),
    date_from: Optional[date] = Query(
        None, description="Inclusive create_date lower bound."
    ),
    date_to: Optional[date] = Query(
        None, description="Inclusive create_date upper bound."
    ),
    visibility: Optional[CommentVisibilityEnum] = Query(
        None,
        description="IDIR only; ignored for BCeID (always Public).",
    ),
    search: Optional[str] = Query(
        None,
        max_length=500,
        description=(
            "Full-text keyword search. Expanded to organization "
            "name/operating_name when category='Organization details', or "
            "to the author's name/email when category='Person'."
        ),
    ),
    sort_by: CommentSortFieldEnum = Query(
        CommentSortFieldEnum.CREATE_DATE, description="create_date | update_date"
    ),
    sort_order: CommentSortOrderEnum = Query(
        CommentSortOrderEnum.DESC, description="asc | desc"
    ),
    service: InternalCommentService = Depends(),
):
    """
    Organization-scoped Comment Log feed. IDIR sees Internal + Public and may
    filter via ``visibility``; BCeID sees Public only and only for their own
    organization (otherwise ``403``).
    """
    filters = OrganizationCommentsFilterSchema(
        category=category,
        compliance_year=compliance_year,
        date_from=date_from,
        date_to=date_to,
        visibility=visibility,
        search=(search.strip() if isinstance(search, str) else search) or None,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return await service.get_organization_comments(
        organization_id=organization_id,
        page=page,
        size=size,
        filters=filters,
    )


@router.get(
    "/categories",
    response_model=List[str],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.SUPPLIER])
async def get_comment_categories(
    request: Request,
    service: InternalCommentService = Depends(),
):
    """Return all comment category display names ordered by display_order."""
    return await service.get_all_categories()


@router.post(
    "/",
    response_model=InternalCommentResponseSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.CI_APPLICANT, RoleEnum.SUPPLIER])
async def create_comment(
    request: Request,
    comment_data: InternalCommentCreateSchema,
    service: InternalCommentService = Depends(),
):
    """
    API endpoint to create a new internal comment. Requires the user to have the 'Government' role.

    Args:
        request (Request): The request object.
        comment_data (InternalCommentCreateSchema): The schema containing the data for the new comment.
        service (InternalCommentService, optional): The service handling the internal comment logic.

    Returns:
        InternalCommentResponseSchema: The created internal comment.
    """
    return await service.create_internal_comment(comment_data)


@router.get(
    "/{entity_type}/{entity_id}",
    response_model=List[InternalCommentResponseSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.CI_APPLICANT, RoleEnum.SUPPLIER])
async def get_comments(
    request: Request,
    entity_type: str,
    entity_id: int,
    service: InternalCommentService = Depends(),
):
    """
    Retrieves all internal comments associated with a specified entity type and ID. Requires 'Government' role.

    Args:
        request (Request): The request object.
        entity_type (str): The type of the entity.
        entity_id (int): The ID of the entity.
        service (InternalCommentService, optional): The service handling the internal comment logic.

    Returns:
        List[InternalCommentResponseSchema]: A list of internal comments associated with the entity.
    """
    return await service.get_internal_comments(entity_type, entity_id)


@router.put("/{internal_comment_id}", response_model=InternalCommentResponseSchema)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.CI_APPLICANT, RoleEnum.SUPPLIER])
async def update_comment(
    request: Request,
    internal_comment_id: int,
    comment_data: InternalCommentUpdateSchema = Body(...),
    service: InternalCommentService = Depends(),
):
    """
    Updates the text of an existing internal comment. Requires the user to have the 'Government' role.

    Args:
        request (Request): The request object.
        internal_comment_id (int): The ID of the internal comment to be updated.
        comment_data (InternalCommentUpdateSchema): The schema with the new comment text.
        service (InternalCommentService, optional): The service handling the internal comment logic.

    Returns:
        InternalCommentResponseSchema: The updated internal comment.
    """
    # Fetch the existing comment to check the creator
    existing_comment = await service.get_internal_comment_by_id(internal_comment_id)

    if not existing_comment:
        raise HTTPException(status_code=404, detail="Internal comment not found.")

    current_username = request.user.keycloak_username
    if existing_comment.create_user != current_username:
        raise HTTPException(
            status_code=403, detail="User is not the creator of the comment."
        )

    return await service.update_internal_comment(internal_comment_id, comment_data)
