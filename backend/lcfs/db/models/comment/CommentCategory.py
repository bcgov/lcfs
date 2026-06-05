from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel


class CommentCategory(BaseModel):
    """
    Lookup table for Comment Log categories.
    """

    __tablename__ = "comment_category"
    __table_args__ = {"comment": "Lookup table for Comment Log categories."}

    comment_category_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Primary key.",
    )
    display_name = Column(
        String(length=100),
        nullable=False,
        unique=True,
        comment="Display label for Comment Log UI.",
    )
    display_order = Column(
        Integer,
        nullable=False,
        server_default="0",
        comment="Display sort order.",
    )

    internal_comments = relationship(
        "InternalComment", back_populates="comment_category"
    )

    def __repr__(self) -> str:
        return f"<CommentCategory(id={self.comment_category_id}, name={self.display_name})>"
