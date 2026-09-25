from sqlalchemy import Column, Index, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel


class DesignatedActionInternalComment(BaseModel):
    __tablename__ = "designated_action_internal_comment"
    __table_args__ = (
        Index(
            "idx_designated_action_internal_comment_group_uuid",
            "designated_action_group_uuid",
        ),
        {"comment": "Associates internal comments with a designated action."},
    )

    # Columns
    designated_action_id = Column(
        Integer,
        ForeignKey("designated_action.designated_action_id"),
        primary_key=True,
        comment="Foreign key to designated_action, part of the composite primary key.",
    )
    internal_comment_id = Column(
        Integer,
        ForeignKey("internal_comment.internal_comment_id"),
        primary_key=True,
        comment="Foreign key to internal_comment, part of the composite primary key.",
    )
    designated_action_group_uuid = Column(
        String(length=36),
        nullable=True,
        comment=(
            "Denormalized designated_action.group_uuid so comments stay "
            "grouped across change-order versions."
        ),
    )

    # Relationships
    designated_action = relationship(
        "DesignatedAction", back_populates="designated_action_internal_comments"
    )
    internal_comment = relationship(
        "InternalComment", back_populates="designated_action_internal_comments"
    )
