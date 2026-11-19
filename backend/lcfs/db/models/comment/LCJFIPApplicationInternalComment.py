from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel


class LCJFIPApplicationInternalComment(BaseModel):
    __tablename__ = "lcjfip_application_internal_comment"
    __table_args__ = {
        "comment": (
            "Associates comments with an LCJFIP application. Comment "
            "visibility (Internal or Public) is on internal_comment."
        )
    }

    lcjfip_application_id = Column(
        Integer,
        ForeignKey(
            "lcjfip_application.lcjfip_application_id",
            name="fk_lcjfip_application_internal_comment_lcjfip_application_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
        comment="Foreign key to lcjfip_application, part of the composite primary key.",
    )
    internal_comment_id = Column(
        Integer,
        ForeignKey(
            "internal_comment.internal_comment_id",
            name="fk_lcjfip_application_internal_comment_internal_comment_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
        comment="Foreign key to internal_comment, part of the composite primary key.",
    )

    lcjfip_application = relationship(
        "LCJFIPApplication", back_populates="lcjfip_application_internal_comments"
    )
    internal_comment = relationship(
        "InternalComment", back_populates="lcjfip_application_internal_comments"
    )
