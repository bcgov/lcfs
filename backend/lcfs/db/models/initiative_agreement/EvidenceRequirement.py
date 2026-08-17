from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel, Versioning


class EvidenceRequirement(BaseModel, Auditable, Versioning):
    """
    Evidence requirement attached to a designated action (#4846).

    One designated action carries many requirements; agreement notes
    (e.g. "Note 1", "Note 2") are stored here too where applicable.
    Change orders follow the designated_action versioning contract
    (rows append per amendment, sharing group_uuid).
    """

    __tablename__ = "evidence_requirement"
    __table_args__ = (
        Index("ix_evidence_requirement_group_uuid", "group_uuid"),
        {
            "comment": (
                "Evidence requirements a proponent must satisfy for a "
                "designated action, including analyst review findings."
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
    analyst_review = Column(
        Text,
        nullable=True,
        comment="Long-form analyst review findings for this requirement",
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
            "This is the business deactivation flag; Versioning action_type "
            "records change-order lineage only."
        ),
    )

    designated_action = relationship(
        "DesignatedAction", back_populates="evidence_requirements"
    )
