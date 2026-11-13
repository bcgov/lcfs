from sqlalchemy import Column, ForeignKey, Integer

from lcfs.db.base import BaseModel


class PenaltyLogInternalComment(BaseModel):
    """A thread on the organization's penalty log, stable across reassessments."""

    __tablename__ = "penalty_log_internal_comment"
    __table_args__ = ({"comment": "Organization penalty log comment thread."},)

    organization_id = Column(
        Integer, ForeignKey("organization.organization_id"), primary_key=True
    )
    internal_comment_id = Column(
        Integer,
        ForeignKey("internal_comment.internal_comment_id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
