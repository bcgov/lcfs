from sqlalchemy import (
    TIMESTAMP,
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

# Outcome vocabulary for an analyst's assessment of one requirement.
# Held as a String and validated at the API layer, mirroring
# ``designated_action.determination`` — the workflow can grow without an
# enum migration. NULL means the requirement has not been reviewed yet.
REVIEW_OUTCOME_SATISFACTORY = "Satisfactory"
REVIEW_OUTCOME_INFORMATION_REQUESTED = "Information requested"
REVIEW_OUTCOMES = (
    REVIEW_OUTCOME_SATISFACTORY,
    REVIEW_OUTCOME_INFORMATION_REQUESTED,
)


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

    # --- Analyst assessment (#4846 analyst review field, #4899) ----------
    # The current round's assessment. Each completed round is preserved in
    # designated_action_history with the full review payload, so requesting
    # more information never destroys what the previous round concluded.
    analyst_review = Column(
        Text,
        nullable=True,
        comment="Analyst's long-form record of the evidence for this requirement",
    )
    review_outcome = Column(
        String(100),
        nullable=True,
        comment=(
            "Assessment result (Satisfactory | Information requested); "
            "NULL until the requirement has been reviewed"
        ),
    )
    review_notes = Column(
        Text,
        nullable=True,
        comment="Optional analyst notes accompanying the assessment",
    )
    reviewed_by_user_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        index=True,
        comment="User who recorded the current assessment",
    )
    reviewed_date = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When the current assessment was recorded",
    )

    designated_action = relationship(
        "DesignatedAction", back_populates="evidence_requirements"
    )
    reviewed_by = relationship("UserProfile", foreign_keys=[reviewed_by_user_id])
