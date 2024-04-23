from logging import getLogger
from typing import List

from fastapi import Depends, Request

from lcfs.web.core.decorators import service_handler
from lcfs.db.models.InternalComment import InternalComment
from .repo import InternalCommentRepository
from .schema import (
    InternalCommentCreateSchema,
    InternalCommentResponseSchema
)


logger = getLogger("internal_comment_service")


class InternalCommentService:
    """
    Service class for handling internal comment-related operations.
    """
    def __init__(
        self,
        request: Request = None,
        repo: InternalCommentRepository = Depends(InternalCommentRepository)
    ) -> None:
        """
        Initializes the InternalCommentService with a request object and an
        instance of InternalCommentRepository.

        Args:
            request (Request, optional): The current HTTP request. Defaults to None.
            repo (InternalCommentRepository): The repository instance for internal comment operations.
        """
        self.request = request
        self.repo = repo

    @service_handler
    async def create_internal_comment(
        self, data: InternalCommentCreateSchema
    ) -> InternalCommentResponseSchema:
        """
        Creates a new internal comment based on the provided data schema.

        Args:
            data (InternalCommentCreateSchema): The input data for creating a new internal comment.

        Returns:
            InternalCommentResponseSchema: The created internal comment as a data transfer object.
        """
        username = self.request.user.keycloak_username
        comment = InternalComment(
            comment=data.comment, 
            audience_scope=data.audience_scope, 
            create_user=username
        )
        created_comment = await self.repo.create_internal_comment(
            comment, data.entity_type, data.entity_id
        )
        return InternalCommentResponseSchema.from_orm(created_comment)

    @service_handler
    async def get_internal_comments(
        self, entity_type: str, entity_id: int
    ) -> List[InternalCommentResponseSchema]:
        """
        Retrieves internal comments associated with a specific entity, identified by
        its type and ID.

        Args:
            entity_type (str): The type of the associated entity.
            entity_id (int): The ID of the associated entity.

        Returns:
            List[InternalCommentResponseSchema]: A list of internal comments as data transfer objects.
        """
        comments = await self.repo.get_internal_comments(entity_type, entity_id)
        return [InternalCommentResponseSchema.from_orm(comment) for comment in comments]

    @service_handler
    async def get_internal_comment_by_id(
        self, internal_comment_id: int
    ) -> InternalCommentResponseSchema:
        """
        Retrieves a single internal comment by its ID.

        Args:
            internal_comment_id (int): The ID of the internal comment to be retrieved.

        Returns:
            InternalCommentResponseSchema: The internal comment as a data transfer object.
        """
        comment = await self.repo.get_internal_comment_by_id(internal_comment_id)
        return InternalCommentResponseSchema.from_orm(comment)

    @service_handler
    async def update_internal_comment(self, internal_comment_id: int, new_comment_text: str) -> InternalCommentResponseSchema:
        """
        Updates the text of an existing internal comment, identified by its ID and the
        username of the comment creator.

        Args:
            internal_comment_id (int): The ID of the internal comment to be updated.
            new_comment_text (str): The new text to update the comment with.

        Returns:
            InternalCommentResponseSchema: The updated internal comment as a data transfer object.
        """
        updated_comment = await self.repo.update_internal_comment(internal_comment_id, new_comment_text)
        return InternalCommentResponseSchema.model_validate(updated_comment)
