from sqlalchemy import Column, Index, Integer, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel


class OrganizationInternalComment(BaseModel):
    __tablename__ = "organization_internal_comment"
    __table_args__ = (
        Index(
            "idx_organization_internal_comment_org_id",
            "organization_id",
        ),
        {
            "comment": (
                "Associates internal comments with an organization "
                "(e.g. Company Overview notes on the org dashboard)."
            )
        },
    )

    # Columns
    organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id"),
        primary_key=True,
        comment="Foreign key to organization, part of the composite primary key.",
    )
    internal_comment_id = Column(
        Integer,
        ForeignKey("internal_comment.internal_comment_id"),
        primary_key=True,
        comment="Foreign key to internal_comment, part of the composite primary key.",
    )

    # Relationships
    organization = relationship(
        "Organization", back_populates="organization_internal_comments"
    )
    internal_comment = relationship(
        "InternalComment", back_populates="organization_internal_comments"
    )
