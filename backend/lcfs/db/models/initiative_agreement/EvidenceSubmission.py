from sqlalchemy import (
    Boolean,
    Column,
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class EvidenceSubmission(BaseModel, Auditable):
    """
    Evidence package submitted by a proponent against a designated action
    (#4806).

    Submissions are immutable event records: multiple rows per designated
    action form the complete submission history (no versioning mixin).
    Future phases link uploaded files and review records here.
    """

    __tablename__ = "evidence_submission"
    __table_args__ = (
        {
            "comment": (
                "Evidence packages submitted by proponents in support of a "
                "designated action; append-only submission history."
            )
        },
    )

    evidence_submission_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the evidence submission",
    )
    designated_action_id = Column(
        Integer,
        ForeignKey("designated_action.designated_action_id"),
        nullable=False,
        index=True,
        comment="Designated action the evidence was submitted against",
    )
    submission_date = Column(
        Date, nullable=True, comment="Date the evidence was submitted"
    )
    current_status_id = Column(
        Integer,
        ForeignKey("evidence_submission_status.evidence_submission_status_id"),
        nullable=False,
        index=True,
        comment="Current review status of the submission",
    )
    submission_method = Column(
        String(100),
        nullable=True,
        comment="How the evidence was submitted (e.g. email, portal)",
    )
    cover_letter_received = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Whether a signed cover letter was received with the submission",
    )
    comments = Column(
        Text, nullable=True, comment="Comments recorded against the submission"
    )
    submitted_by_user_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="Submitting user when submitted through the application",
    )
    submitted_by = Column(
        String(500),
        nullable=True,
        comment=(
            "Display name of the submitter when not a system user "
            "(legacy/email submissions)"
        ),
    )

    designated_action = relationship(
        "DesignatedAction", back_populates="evidence_submissions"
    )
    current_status = relationship(
        "EvidenceSubmissionStatus", back_populates="evidence_submissions"
    )
    submitted_by_user = relationship(
        "UserProfile", foreign_keys=[submitted_by_user_id]
    )
