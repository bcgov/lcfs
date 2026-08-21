from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class EvidenceRequirement(BaseModel, Auditable):
    """
    Evidence requirement attached to a designated action (#4846).

    One designated action carries many requirements; agreement notes
    (e.g. "Note 1", "Note 2") are stored here too where applicable.

    Amendments append a new row and deactivate the old one via ``is_active``
    rather than carrying the ``Versioning`` mixin: requirement-level versions
    would add a third axis of cross-version resolution (designated action
    versions, then requirement versions, then per-round reviews) that nothing
    resolves, and would let two versions of one requirement each hold a
    review for the same submission round.
    """

    __tablename__ = "evidence_requirement"
    __table_args__ = (
        {
            "comment": (
                "Evidence requirements a proponent must satisfy for a "
                "designated action."
            )
        },
    )

    evidence_requirement_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the evidence requirement",
    )
    designated_action_id = Column(
        Integer,
        ForeignKey("designated_action.designated_action_id"),
        nullable=False,
        index=True,
        comment="Parent designated action",
    )
    requirement_number = Column(
        Integer,
        nullable=False,
        comment="Business number of the requirement; also the display order",
    )
    description = Column(
        Text, nullable=False, comment="Description of the evidence requirement"
    )
    evidence_type = Column(
        String(100),
        nullable=True,
        comment="Type of evidence expected (vocabulary defined by the business)",
    )
    is_active = Column(
        Boolean,
        nullable=False,
        server_default=text("true"),
        comment=(
            "Soft-delete flag: inactive requirements are hidden but retained. "
            "Also the amendment mechanism — a change order deactivates the "
            "old requirement and inserts a replacement."
        ),
    )

    designated_action = relationship(
        "DesignatedAction", back_populates="evidence_requirements"
    )
