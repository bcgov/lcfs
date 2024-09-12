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


class AudienceScopeEnum(str, Enum):
    DIRECTOR = "Director"
    ANALYST = "Analyst"


class InternalCommentCreateSchema(BaseSchema):
    entity_type: EntityTypeEnum
    entity_id: int
    comment: str
    audience_scope: AudienceScopeEnum


class InternalCommentUpdateSchema(BaseSchema):
    comment: Optional[str] = None


class InternalCommentResponseSchema(BaseSchema):
    internal_comment_id: int
    comment: str
    audience_scope: AudienceScopeEnum
    create_user: Optional[str] = None
    create_date: Optional[datetime] = None
    update_date: Optional[datetime] = None
    full_name: Optional[str] = None
