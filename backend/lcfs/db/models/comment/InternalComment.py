from sqlalchemy import (
    Column,
    ForeignKey,
    Index,
    Integer,
    Table,
    Text,
)
from sqlalchemy.dialects.postgresql import ENUM, TSVECTOR
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable

# Association table linking internal comments to their attached documents.
# Mirrors the per-parent document association pattern (e.g.
# compliance_report_document_association) so attachments reuse the shared
# DocumentService/S3 machinery keyed on parent_type "internal_comment".
internal_comment_document_association = Table(
    "internal_comment_document_association",
    BaseModel.metadata,
    Column(
        "internal_comment_id",
        Integer,
        ForeignKey("internal_comment.internal_comment_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "document_id",
        Integer,
        ForeignKey("document.document_id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

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
        Index(
            "idx_internal_comment_org_year_cat_vis",
            "organization_id",
            "compliance_year",
            "comment_category_id",
            "visibility",
            "create_date",
            postgresql_ops={"create_date": "DESC"},
        ),
        Index(
            "idx_internal_comment_search_vector",
            "comment_search_vector",
            postgresql_using="gin",
        ),
        Index("idx_internal_comment_create_date", "create_date"),
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

    # --- Comment Log denormalized metadata -------------------------------
    organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id"),
        nullable=True,
        comment="Denormalized org for fast org-scoped queries.",
    )
    compliance_year = Column(
        Integer,
        nullable=True,
        comment="Denormalized compliance year from source entity.",
    )
    comment_category_id = Column(
        Integer,
        ForeignKey("comment_category.comment_category_id"),
        nullable=True,
        comment="FK to comment_category.",
    )
    comment_search_text = Column(
        Text,
        nullable=True,
        comment="Sanitized plain text for full-text search.",
    )
    comment_search_vector = Column(
        TSVECTOR,
        nullable=True,
        comment="tsvector for PostgreSQL full-text search.",
    )

    # Relationships
    comment_category = relationship(
        "CommentCategory", back_populates="internal_comments"
    )
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
    ci_application_internal_comments = relationship(
        "CIApplicationInternalComment", back_populates="internal_comment"
    )
    documents = relationship(
        "Document",
        secondary=internal_comment_document_association,
        back_populates="internal_comments",
    )
