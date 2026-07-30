import re
import structlog
from math import ceil
from typing import List, Optional

from fastapi import Depends, Request, HTTPException
from sqlalchemy import func

from lcfs.web.core.decorators import service_handler
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.comment.InternalComment import InternalComment
from lcfs.db.models.comment.ComplianceReportInternalComment import (
    ComplianceReportInternalComment,
)
from .repo import InternalCommentRepository
from .schema import (
    AudienceScopeEnum,
    CommentVisibilityEnum,
    InternalCommentCreateSchema,
    InternalCommentUpdateSchema,
    InternalCommentResponseSchema,
    EntityTypeEnum,
    OrganizationCommentRecordSchema,
    OrganizationCommentsFilterSchema,
    OrganizationCommentsPaginationSchema,
    OrganizationCommentsResponseSchema,
)

logger = structlog.get_logger(__name__)


DEFAULT_CATEGORY_BY_ENTITY: dict[EntityTypeEnum, str] = {
    EntityTypeEnum.COMPLIANCE_REPORT: "Compliance notes",
    EntityTypeEnum.TRANSFER: "Transfer notes",
    EntityTypeEnum.INITIATIVE_AGREEMENT: "IA notes",
    EntityTypeEnum.ADMIN_ADJUSTMENT: "Penalty notes",
    EntityTypeEnum.CI_APPLICATION: "CI application notes",
    EntityTypeEnum.ORGANIZATION: "Company Overview",
}


_HTML_TAG_RE = re.compile(r"<[^>]*>")
_WHITESPACE_RE = re.compile(r"\s+")


def sanitize_comment_text(html: Optional[str]) -> str:
    """Strip HTML tags and collapse whitespace. Matches the SQL backfill."""
    if not html:
        return ""
    text = _HTML_TAG_RE.sub(" ", html)
    text = _WHITESPACE_RE.sub(" ", text)
    return text.strip()


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

    async def _populate_comment_metadata(
        self,
        comment: InternalComment,
        entity_type: Optional[EntityTypeEnum],
        entity_id: Optional[int],
        category_display_name: Optional[str] = None,
    ) -> InternalComment:
        """
        Single source of truth for the Comment Log denormalized columns:
        ``organization_id``, ``compliance_year``, ``comment_category_id``,
        ``comment_search_text``, and ``comment_search_vector``.
        """
        if comment.comment is not None:
            search_text = sanitize_comment_text(comment.comment)
            comment.comment_search_text = search_text
            comment.comment_search_vector = func.to_tsvector("english", search_text)

        if entity_type is not None and entity_id is not None:
            org_id, year = await self.repo.get_entity_org_and_year(
                entity_type, entity_id
            )
            if org_id is not None:
                comment.organization_id = org_id
            if year is not None:
                comment.compliance_year = year

        category_name = category_display_name or (
            DEFAULT_CATEGORY_BY_ENTITY.get(entity_type) if entity_type else None
        )
        if category_name:
            category_id = await self.repo.get_category_id_by_name(category_name)
            if category_id is not None:
                comment.comment_category_id = category_id

        return comment

    def _get_audience_scope_for_user(self) -> Optional[AudienceScopeEnum]:
        role_names = self.request.user.role_names
        if RoleEnum.DIRECTOR in role_names:
            return AudienceScopeEnum.DIRECTOR
        if RoleEnum.ANALYST in role_names:
            return AudienceScopeEnum.ANALYST
        if RoleEnum.COMPLIANCE_MANAGER in role_names:
            return AudienceScopeEnum.COMPLIANCE_MANAGER
        if RoleEnum.GOVERNMENT in role_names:
            return AudienceScopeEnum.ANALYST
        return None

    @service_handler
    async def get_all_categories(self) -> List[str]:
        """Return all comment category display names from the DB, ordered by display_order."""
        return await self.repo.get_all_categories()

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
            if data.entity_type not in (
                EntityTypeEnum.COMPLIANCE_REPORT,
                EntityTypeEnum.CI_APPLICATION,
            ):
                raise HTTPException(status_code=403, detail="Forbidden resource")
            if data.visibility != CommentVisibilityEnum.PUBLIC:
                raise HTTPException(status_code=403, detail="Forbidden resource")
            data.audience_scope = None
        elif (
            data.visibility == CommentVisibilityEnum.INTERNAL
            and data.audience_scope is None
        ):
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
        await self._populate_comment_metadata(
            comment,
            entity_type=data.entity_type,
            entity_id=data.entity_id,
            category_display_name=data.comment_category,
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
            if entity_type not in (
                EntityTypeEnum.COMPLIANCE_REPORT,
                EntityTypeEnum.CI_APPLICATION,
            ):
                raise HTTPException(status_code=403, detail="Forbidden resource")
            visibility_filter = CommentVisibilityEnum.PUBLIC.value

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
        is_government_user = self._is_government_user()

        existing_comment = await self.repo.get_internal_comment_by_id(
            internal_comment_id
        )

        current_visibility = existing_comment.visibility
        if not isinstance(current_visibility, CommentVisibilityEnum):
            current_visibility = CommentVisibilityEnum(str(current_visibility))

        # Non-government users (BCeID) may only edit the text of their own
        # Public comment — they cannot flip a comment to Internal or set
        # an audience scope, regardless of what the payload contains. The
        # creator-ownership check is enforced upstream in the view.
        if not is_government_user:
            next_visibility = CommentVisibilityEnum.PUBLIC
            next_audience_scope = None
        else:
            next_visibility = (
                data.visibility if data.visibility is not None else current_visibility
            )

            if data.audience_scope is not None:
                next_audience_scope = data.audience_scope
            elif existing_comment.audience_scope is None:
                next_audience_scope = None
            elif isinstance(existing_comment.audience_scope, AudienceScopeEnum):
                next_audience_scope = existing_comment.audience_scope
            else:
                next_audience_scope = AudienceScopeEnum(
                    str(existing_comment.audience_scope)
                )

        if next_visibility == CommentVisibilityEnum.PUBLIC:
            next_audience_scope = None
        elif next_audience_scope is None:
            next_audience_scope = self._get_audience_scope_for_user()
            if next_audience_scope is None:
                raise HTTPException(
                    status_code=422,
                    detail="audience_scope is required for internal comments.",
                )

        refresh_text = (
            data.comment if data.comment is not None else existing_comment.comment
        )
        transient = InternalComment(comment=refresh_text)
        await self._populate_comment_metadata(
            transient,
            entity_type=None,
            entity_id=None,
            category_display_name=data.comment_category,
        )

        updated_comment = await self.repo.update_internal_comment(
            internal_comment_id=internal_comment_id,
            new_comment_text=data.comment,
            visibility=next_visibility.value,
            audience_scope=(
                next_audience_scope.value if next_audience_scope is not None else None
            ),
            comment_category_id=transient.comment_category_id,
            comment_search_text=transient.comment_search_text,
            comment_search_vector=transient.comment_search_vector,
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

    @service_handler
    async def get_organization_comments(
        self,
        organization_id: int,
        page: int = 1,
        size: int = 25,
        filters: Optional[OrganizationCommentsFilterSchema] = None,
    ) -> OrganizationCommentsResponseSchema:
        """
        Paginated organization-scoped Comment Log feed.

        IDIR sees Internal + Public and may narrow via ``filters.visibility``.
        BCeID may only access their own organization and always sees Public
        only — any caller-supplied ``filters.visibility`` is ignored.
        """
        if filters is None:
            filters = OrganizationCommentsFilterSchema()

        is_government_user = self._is_government_user()
        current_user = self.request.user

        if not is_government_user:
            user_org = getattr(current_user, "organization", None)
            user_org_id = (
                getattr(user_org, "organization_id", None)
                if user_org is not None
                else getattr(current_user, "organization_id", None)
            )
            if user_org_id is None or user_org_id != organization_id:
                raise HTTPException(status_code=403, detail="Forbidden resource")
            visibility_filter: Optional[str] = CommentVisibilityEnum.PUBLIC.value
        else:
            visibility_filter = (
                filters.visibility.value if filters.visibility is not None else None
            )

        page = page if page and page >= 1 else 1
        size = size if size and size >= 1 else 25
        if size > 100:
            size = 100

        rows, total = await self.repo.get_comments_for_organization(
            organization_id=organization_id,
            page=page,
            size=size,
            visibility_filter=visibility_filter,
            category=filters.category,
            compliance_year=filters.compliance_year,
            date_from=filters.date_from,
            date_to=filters.date_to,
            search=filters.search,
            sort_by=filters.sort_by.value,
            sort_order=filters.sort_order.value,
        )

        username = getattr(current_user, "keycloak_username", None)
        records = [
            OrganizationCommentRecordSchema(
                internal_comment_id=row["internal_comment_id"],
                comment=row["comment"],
                plain_text_comment=row["plain_text_comment"],
                entity_type=row["entity_type"],
                entity_id=row["entity_id"],
                category=row["category"],
                compliance_year=row["compliance_year"],
                organization_id=row["organization_id"],
                organization_name=row["organization_name"],
                visibility=row["visibility"],
                audience_scope=row["audience_scope"],
                create_user=row["create_user"],
                full_name=row["full_name"],
                create_date=row["create_date"],
                update_date=row["update_date"],
                can_edit=bool(username is not None and row["create_user"] == username),
            )
            for row in rows
        ]

        total_pages = ceil(total / size) if total and size else 0
        return OrganizationCommentsResponseSchema(
            comments=records,
            pagination=OrganizationCommentsPaginationSchema(
                page=page,
                size=size,
                total=total,
                total_pages=total_pages,
            ),
        )
