import structlog
from typing import List, Optional

from fastapi import Depends, Request, HTTPException

from lcfs.web.core.decorators import service_handler
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.comment.InternalComment import InternalComment
from lcfs.db.models.comment.ComplianceReportInternalComment import (
    ComplianceReportInternalComment,
)
from .repo import InternalCommentRepository
from .schema import (
    InternalCommentCreateSchema,
    InternalCommentUpdateSchema,
    InternalCommentResponseSchema,
    EntityTypeEnum,
)


logger = structlog.get_logger(__name__)


class InternalCommentService:
    """
    Service class for handling internal comment-related operations.
    """

    def __init__(
        self,
        request: Request = None,
        repo: InternalCommentRepository = Depends(InternalCommentRepository),
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

    def _is_government_user(self) -> bool:
        return RoleEnum.GOVERNMENT in self.request.user.role_names

    def _get_audience_scope_for_user(self) -> Optional[str]:
        role_names = self.request.user.role_names
        if RoleEnum.DIRECTOR in role_names:
            return "Director"
        if RoleEnum.ANALYST in role_names:
            return "Analyst"
        if RoleEnum.COMPLIANCE_MANAGER in role_names:
            return "Compliance Manager"
        if RoleEnum.GOVERNMENT in role_names:
            return "Analyst"
        return None

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
        is_government_user = self._is_government_user()

        # Keep legacy behavior for existing entities and enforce CI-specific visibility rules.
        if not is_government_user:
            if data.entity_type != EntityTypeEnum.COMPLIANCE_REPORT:
                raise HTTPException(status_code=403, detail="Forbidden resource")
            if data.visibility.value != "Public":
                raise HTTPException(status_code=403, detail="Forbidden resource")
            data.audience_scope = None
        elif data.visibility.value == "Internal" and data.audience_scope is None:
            data.audience_scope = self._get_audience_scope_for_user()
            if data.audience_scope is None:
                raise HTTPException(
                    status_code=422,
                    detail="audience_scope is required for internal comments.",
                )

        username = self.request.user.keycloak_username
        comment = InternalComment(
            comment=data.comment,
            audience_scope=data.audience_scope,
            visibility=data.visibility,
            create_user=username,
        )
        created_comment = await self.repo.create_internal_comment(
            comment, data.entity_type, data.entity_id
        )
        return InternalCommentResponseSchema.from_orm(created_comment)

    @service_handler
    async def get_internal_comments(
        self, entity_type: str, entity_id: int, visibility_filter: Optional[str] = None
    ) -> List[InternalCommentResponseSchema]:
        """
        Retrieves internal comments associated with a specific entity, identified by
        its type and ID.

        Args:
            entity_type (str): The type of the associated entity.
            entity_id (int): The ID of the associated entity.
            visibility_filter (str, optional): Filter by visibility (e.g., "Public" for BCeID users).

        Returns:
            List[InternalCommentResponseSchema]: A list of internal comments as data transfer objects.
        """
        is_government_user = self._is_government_user()
        if not is_government_user:
            if entity_type != EntityTypeEnum.COMPLIANCE_REPORT:
                raise HTTPException(status_code=403, detail="Forbidden resource")
            visibility_filter = "Public"

        comments = await self.repo.get_internal_comments(
            entity_type, entity_id, visibility_filter
        )
        return [
            InternalCommentResponseSchema.model_validate(comment)
            for comment in comments
        ]

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
    async def update_internal_comment(
        self, internal_comment_id: int, data: InternalCommentUpdateSchema
    ) -> InternalCommentResponseSchema:
        """
        Updates the text of an existing internal comment, identified by its ID and the
        username of the comment creator.

        Args:
            internal_comment_id (int): The ID of the internal comment to be updated.
            data (InternalCommentUpdateSchema): Partial update payload.

        Returns:
            InternalCommentResponseSchema: The updated internal comment as a data transfer object.
        """
        existing_comment = await self.repo.get_internal_comment_by_id(internal_comment_id)

        current_visibility = existing_comment.visibility
        current_visibility = (
            current_visibility.value
            if hasattr(current_visibility, "value")
            else str(current_visibility)
        )
        next_visibility = (
            data.visibility.value if data.visibility is not None else current_visibility
        )

        next_audience_scope = (
            data.audience_scope.value
            if data.audience_scope is not None
            else existing_comment.audience_scope
        )
        if next_visibility == "Public":
            next_audience_scope = None
        elif next_audience_scope is None:
            next_audience_scope = self._get_audience_scope_for_user()
            if next_audience_scope is None:
                raise HTTPException(
                    status_code=422,
                    detail="audience_scope is required for internal comments.",
                )

        updated_comment = await self.repo.update_internal_comment(
            internal_comment_id=internal_comment_id,
            new_comment_text=data.comment,
            visibility=next_visibility,
            audience_scope=next_audience_scope,
        )
        return InternalCommentResponseSchema.model_validate(updated_comment)

    @service_handler
    async def copy_internal_comments(
        self, source_report_id: int, target_report_id: int
    ) -> None:
        """
        Copy internal comments from one compliance report to another.

        Args:
            source_report_id (int): ID of the source report.
            target_report_id (int): ID of the target report.

        Returns:
            None
        """
        try:
            comment_ids = await self.repo.get_internal_comment_ids_for_entity(
                EntityTypeEnum.COMPLIANCE_REPORT, source_report_id
            )

            if not comment_ids:
                return

            associations = [
                ComplianceReportInternalComment(
                    compliance_report_id=target_report_id,
                    internal_comment_id=comment_id,
                )
                for comment_id in comment_ids
            ]
            self.repo.db.add_all(associations)
            await self.repo.db.flush()
        except Exception as e:
            logger.error(
                "Failed to copy internal comments",
                source_report_id=source_report_id,
                target_report_id=target_report_id,
                error=str(e),
            )
            raise
