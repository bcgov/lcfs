from sqlalchemy import Column, Integer, Text
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable

# ENUM for audience scope
audience_scope_enum = ENUM(
    "Director",
    "Analyst",
    "Compliance Manager",
    name="audience_scope",
    create_type=False,
)

# ENUM for comment visibility
comment_visibility_enum = ENUM(
    "Internal",
    "Public",
    name="comment_visibility",
    create_type=False,
)


class InternalComment(BaseModel, Auditable):
    __tablename__ = "internal_comment"
    __table_args__ = (
        {"comment": "Stores internal comments with scope and related metadata."},
    )

    # Columns
    internal_comment_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Primary key, unique identifier for each internal comment.",
    )
    comment = Column(Text, nullable=True, comment="Text of the comment.")
    audience_scope = Column(
        audience_scope_enum,
        nullable=True,
        comment="Defines the audience scope for the comment, e.g., Director, Analyst, Compliance Manager",
    )
    visibility = Column(
        comment_visibility_enum,
        nullable=False,
        server_default="Internal",
        comment="Visibility scope: Internal (gov-only) or Public (visible to org users)",
    )

    # Relationships
    transfer_internal_comments = relationship(
        "TransferInternalComment", back_populates="internal_comment"
    )
    initiative_agreement_internal_comments = relationship(
        "InitiativeAgreementInternalComment", back_populates="internal_comment"
    )
    admin_adjustment_internal_comments = relationship(
        "AdminAdjustmentInternalComment", back_populates="internal_comment"
    )
    compliance_report_internal_comments = relationship(
        "ComplianceReportInternalComment", back_populates="internal_comment"
    )
