from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel


class CIApplicationInternalComment(BaseModel):
    __tablename__ = "ci_application_internal_comment"
    __table_args__ = {
        "comment": "Associates internal comments with a CI application."
    }

    ci_application_id = Column(
        Integer,
        ForeignKey("ci_application.ci_application_id"),
        primary_key=True,
        comment="Foreign key to ci_application, part of the composite primary key.",
    )
    internal_comment_id = Column(
        Integer,
        ForeignKey("internal_comment.internal_comment_id"),
        primary_key=True,
        comment="Foreign key to internal_comment, part of the composite primary key.",
    )

    ci_application = relationship(
        "CIApplication", back_populates="ci_application_internal_comments"
    )
    internal_comment = relationship(
        "InternalComment", back_populates="ci_application_internal_comments"
    )
