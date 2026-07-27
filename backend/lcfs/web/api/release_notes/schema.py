from typing import List, Optional
from datetime import datetime
from pydantic import ConfigDict

from lcfs.web.api.base import BaseSchema


class ReleaseNoteSectionsSchema(BaseSchema):
    """Categorized release note entries, mirroring the auto-generated JSON shape."""

    model_config = ConfigDict(from_attributes=True)

    features: List[str] = []
    fixes: List[str] = []
    security: List[str] = []
    breaking: List[str] = []
    dependencies: List[str] = []
    other: List[str] = []


class ReleaseNoteOverrideSchema(BaseSchema):
    """Schema for a System Admin edit layered on top of an auto-generated release note."""

    model_config = ConfigDict(from_attributes=True)

    version: str
    summary: Optional[str] = None
    sections: Optional[ReleaseNoteSectionsSchema] = None
    update_date: Optional[datetime] = None
    update_user: Optional[str] = None


class ReleaseNoteUpdateSchema(BaseSchema):
    """Schema for creating/updating a System Admin edit of a release note."""

    model_config = ConfigDict(from_attributes=True)

    summary: Optional[str] = None
    sections: Optional[ReleaseNoteSectionsSchema] = None
