from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Table,
    Text,
    select,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel

da_eoc_submission_document_association = Table(
    "da_eoc_submission_document_association",
    BaseModel.metadata,
    Column(
        "da_eoc_submission_id",
        Integer,
        ForeignKey("da_eoc_submission.da_eoc_submission_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "document_id", Integer, ForeignKey("document.document_id"), primary_key=True
    ),
    Index(
        "ix_da_eoc_submission_document_association_document_id", "document_id"
    ),
)


class DaEocSubmission(BaseModel, Auditable):
    """A proponent submission against one concrete designated action version."""

    __tablename__ = "da_eoc_submission"
    __table_args__ = (
        CheckConstraint(
            "status IN ('Draft', 'Submitted', 'Recommended by analyst', 'Recommended by manager', 'Approved', 'Rejected')",
            name="status",
        ),
        {
            "comment": "Independent DA/EOC submissions; the IA is reached through the designated action."
        },
    )
    da_eoc_submission_id = Column(Integer, primary_key=True, autoincrement=True)
    designated_action_id = Column(
        Integer,
        ForeignKey("designated_action.designated_action_id"),
        nullable=False,
        index=True,
    )
    organization_id = Column(
        Integer, ForeignKey("organization.organization_id"), nullable=False, index=True
    )
    status = Column(String(50), nullable=False, server_default="Draft")
    evidence_responses = Column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=True,
        comment="Per-evidence-requirement applicant responses for this submission.",
    )
    summary_of_work_completed = Column(Text)
    how_evidence_meets_agreement_requirements = Column(Text)
    exceptions_limitations_and_context = Column(Text)

    designated_action = relationship(
        "DesignatedAction", back_populates="da_eoc_submissions"
    )
    organization = relationship("Organization")
    documents = relationship(
        "Document",
        secondary=da_eoc_submission_document_association,
        back_populates="da_eoc_submissions",
    )
    history = relationship("DaEocSubmissionHistory", back_populates="submission")


EVENT_SUB_STATUS_CHANGE = "SUB_STATUS_CHANGE"
SUB_STATUS_ASSIGNED = "Assigned"
SUB_STATUS_UNDER_REVIEW = "Under Review"
SUB_STATUS_INFORMATION_REQUESTED = "Information requested"


class DaEocSubmissionHistory(BaseModel, Auditable):
    """Events; a SUB_STATUS_CHANGE with NULL sub_status clears the state.

    Writers must lock the parent submission row when appending transitions, so
    history IDs represent their serialized order for each submission.
    """

    __tablename__ = "da_eoc_submission_history"
    __table_args__ = (
        CheckConstraint(
            "sub_status IS NULL OR (event = 'SUB_STATUS_CHANGE' AND "
            "sub_status IN ('Assigned', 'Under Review', 'Information requested'))",
            name="sub_status",
        ),
        Index("ix_da_eoc_submission_history_submission_id", "da_eoc_submission_id"),
        Index(
            "ix_da_eoc_submission_history_sub_status_event",
            "da_eoc_submission_id",
            "event",
            "da_eoc_submission_history_id",
        ),
    )
    da_eoc_submission_history_id = Column(Integer, primary_key=True, autoincrement=True)
    da_eoc_submission_id = Column(
        Integer, ForeignKey("da_eoc_submission.da_eoc_submission_id"), nullable=False
    )
    event = Column(String(100), nullable=False)
    status = Column(String(50))
    sub_status = Column(
        String(100),
        comment="For SUB_STATUS_CHANGE events: new internal state, or NULL to clear it",
    )
    user_profile_id = Column(Integer, ForeignKey("user_profile.user_profile_id"))
    snapshot = Column(JSONB, comment="Event details or submission content snapshot")
    submission = relationship("DaEocSubmission", back_populates="history")
    user_profile = relationship("UserProfile")


def current_sub_status_query(submission_id):
    """Select the latest state event, including a NULL clear, by serialized ID.

    A missing row and a clear both yield no current sub-status. Callers must
    not filter NULL values before ordering: doing so would resurrect old state.
    """
    return (
        select(DaEocSubmissionHistory.sub_status)
        .where(
            DaEocSubmissionHistory.da_eoc_submission_id == submission_id,
            DaEocSubmissionHistory.event == EVENT_SUB_STATUS_CHANGE,
        )
        .order_by(DaEocSubmissionHistory.da_eoc_submission_history_id.desc())
        .limit(1)
    )
