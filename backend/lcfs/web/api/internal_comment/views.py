from logging import getLogger
from typing import List

from fastapi import APIRouter, Body, Depends, status, Request
from starlette import status

from lcfs.db import dependencies
from lcfs.web.core.decorators import roles_required, view_handler
from .services import InternalCommentService

from .schema import (
    InternalCommentCreateSchema,
    InternalCommentUpdateSchema,
    InternalCommentResponseSchema
)


logger = getLogger("internal_comment_view")
router = APIRouter()
get_async_db = dependencies.get_async_db_session


@router.post("/", response_model=InternalCommentResponseSchema, status_code=status.HTTP_201_CREATED)
@roles_required("Government")
@view_handler
async def create_comment(
    request: Request,
    comment_data: InternalCommentCreateSchema,
    service: InternalCommentService = Depends()
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

@router.get("/{entity_type}/{entity_id}", response_model=List[InternalCommentResponseSchema], status_code=status.HTTP_200_OK)
@roles_required("Government")
@view_handler
async def get_comments(
    request: Request,
    entity_type: str,
    entity_id: int,
    service: InternalCommentService = Depends()
):
    """
    Retrieves all internal comments associated with a specified entity type and ID. Requires 'Government' role.

    Args:
        request (Request): The request object.
        entity_type (str): The type of the entity ('transfer' or 'initiative_agreement').
        entity_id (int): The ID of the entity.
        service (InternalCommentService, optional): The service handling the internal comment logic.
        
    Returns:
        List[InternalCommentResponseSchema]: A list of internal comments associated with the entity.
    """
    return await service.get_internal_comments(entity_type, entity_id)


@router.put("/{internal_comment_id}", response_model=InternalCommentResponseSchema)
@roles_required("Government")
@view_handler
async def update_comment(
    request: Request,
    internal_comment_id: int,
    comment_data: InternalCommentUpdateSchema = Body(...),
    service: InternalCommentService = Depends()
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
    current_username = request.user.keycloak_username
    return await service.update_internal_comment(current_username, internal_comment_id, comment_data.comment)
