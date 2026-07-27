from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from lcfs.db.base import BaseModel, Auditable


class ReleaseNoteOverride(BaseModel, Auditable):
    __tablename__ = "release_note_override"
    __table_args__ = {
        "comment": (
            "Stores System Admin edits layered on top of the auto-generated "
            "release notes for a given release version. The original "
            "auto-generated content always remains available; a null field "
            "here means the auto-generated value is still used."
        )
    }

    release_note_override_id = Column(Integer, primary_key=True, autoincrement=True)
    version = Column(
        String(20),
        nullable=False,
        unique=True,
        comment="Release version this override applies to, e.g. '1.3.6'",
    )
    summary = Column(
        Text,
        nullable=True,
        comment="Admin-edited summary. Null means use the auto-generated summary.",
    )
    sections = Column(
        JSONB,
        nullable=True,
        comment=(
            "Admin-edited release note sections (features, fixes, security, "
            "breaking, dependencies, other). Null means use the "
            "auto-generated sections."
        ),
    )
