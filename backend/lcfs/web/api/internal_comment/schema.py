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
class EntityType(str, Enum):
    transfer = "transfer"
    initiative_agreement = "initiative_agreement"

class AudienceScope(str, Enum):
    director = "Director"
    analyst = "Analyst"

class InternalCommentCreateSchema(BaseSchema):
    entity_type: EntityType
    entity_id: int
    comment: str
    audience_scope: AudienceScope

class InternalCommentUpdateSchema(BaseSchema):
    comment: Optional[str] = None

class InternalCommentResponseSchema(BaseSchema):
    internal_comment_id: int
    comment: str
    audience_scope: AudienceScope
    create_user: Optional[str]
    create_date: Optional[datetime]
    update_date: Optional[datetime]
    full_name: Optional[str] = None

    class Config(BaseConfig):
        pass
