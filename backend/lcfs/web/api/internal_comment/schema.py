from typing import Optional
from enum import Enum
from datetime import datetime
from lcfs.web.api.base import BaseSchema


# --------------------------------------
# Base Configuration
# --------------------------------------
class BaseConfig:
    from_attributes = True


# --------------------------------------
# Internal Comment
# --------------------------------------
class EntityTypeEnum(str, Enum):
    TRANSFER = "Transfer"
    INITIATIVE_AGREEMENT = "initiativeAgreement"
    ADMIN_ADJUSTMENT = "administrativeAdjustment"
    ASSESSMENT = "Assessment"
    COMPLIANCE_REPORT = "complianceReport"
    CI_APPLICATION = "ciApplication"


class AudienceScopeEnum(str, Enum):
    COMPLIANCE_MANAGER = "Compliance Manager"
    DIRECTOR = "Director"
    ANALYST = "Analyst"


class CommentVisibilityEnum(str, Enum):
    INTERNAL = "Internal"
    PUBLIC = "Public"


class InternalCommentCreateSchema(BaseSchema):
    entity_type: EntityTypeEnum
    entity_id: int
    comment: str
    audience_scope: Optional[AudienceScopeEnum] = None
    visibility: CommentVisibilityEnum = CommentVisibilityEnum.INTERNAL
    comment_category: Optional[str] = None


class InternalCommentUpdateSchema(BaseSchema):
    comment: Optional[str] = None
    audience_scope: Optional[AudienceScopeEnum] = None
    visibility: Optional[CommentVisibilityEnum] = None
    comment_category: Optional[str] = None


class InternalCommentResponseSchema(BaseSchema):
    internal_comment_id: int
    comment: str
    audience_scope: Optional[AudienceScopeEnum] = None
    visibility: CommentVisibilityEnum = CommentVisibilityEnum.INTERNAL
    create_user: Optional[str] = None
    create_date: Optional[datetime] = None
    update_date: Optional[datetime] = None
    full_name: Optional[str] = None


class OrganizationCommentRecordSchema(BaseSchema):
    internal_comment_id: int
    comment: Optional[str] = None
    plain_text_comment: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    category: Optional[str] = None
    compliance_year: Optional[int] = None
    organization_id: Optional[int] = None
    organization_name: Optional[str] = None
    visibility: Optional[CommentVisibilityEnum] = None
    audience_scope: Optional[AudienceScopeEnum] = None
    create_user: Optional[str] = None
    full_name: Optional[str] = None
    create_date: Optional[datetime] = None
    update_date: Optional[datetime] = None
    can_edit: bool = False


class OrganizationCommentsPaginationSchema(BaseSchema):
    page: int
    size: int
    total: int
    total_pages: int


class OrganizationCommentsResponseSchema(BaseSchema):
    comments: list[OrganizationCommentRecordSchema]
    pagination: OrganizationCommentsPaginationSchema
