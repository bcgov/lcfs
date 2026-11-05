import enum

from sqlalchemy import TIMESTAMP, Column, Enum, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable
from lcfs.db.models.admin_adjustment.AdminAdjustment import (
    admin_adjustment_document_association,
)
from lcfs.db.models.compliance.ComplianceReport import (
    compliance_report_document_association,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    initiative_agreement_document_association,
)
from lcfs.db.models.initiative_agreement.DesignatedAction import (
    designated_action_document_association,
)
from lcfs.db.models.compliance.ChargingSite import (
    charging_site_document_association,
)
from lcfs.db.models.ci_application.CIApplication import (
    ci_application_document_association,
)
from lcfs.db.models.comment.InternalComment import (
    internal_comment_document_association,
)


class DocumentScanStatusEnum(enum.Enum):
    # Uploaded before macro checks existed
    legacy = "legacy"
    clean = "clean"
    # Macro-enabled workbook waiting for an IDIR Administrator
    pending_approval = "pending_approval"
    approved = "approved"
    rejected = "rejected"


class Document(BaseModel, Auditable):
    __tablename__ = "document"
    __table_args__ = (
        {"comment": "Main document table for storing base document information"},
    )

    document_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the document",
    )

    file_key = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String, nullable=False)
    display_name = Column(String, nullable=True)

    # --- Macro review ---------------------------------------------------
    scan_status = Column(
        Enum(
            DocumentScanStatusEnum,
            name="document_scan_status_enum",
            values_callable=lambda members: [m.value for m in members],
        ),
        nullable=False,
        default=DocumentScanStatusEnum.clean,
        server_default=DocumentScanStatusEnum.legacy.value,
        comment=(
            "Macro review state; pending_approval and rejected files can't be "
            "downloaded"
        ),
    )
    scan_findings = Column(
        JSONB,
        nullable=True,
        comment="Plain-language macro analysis findings shown to staff",
    )
    scan_reviewed_by = Column(
        String(500),
        nullable=True,
        comment="Username of the administrator who approved or rejected the file",
    )
    scan_reviewed_date = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When the file was approved or rejected",
    )

    # --- Soft deletion (nothing is ever purged) ------------------------
    # Only folder-enabled parents have a route that sets these; for every
    # other surface they stay NULL and the read filter is inert.
    deleted_date = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment=(
            "When the document was removed from its parent's tree; NULL " "means live"
        ),
    )
    deleted_by = Column(
        String(500),
        nullable=True,
        comment="Username of whoever removed it, matching create_user",
    )
    deleted_group_uuid = Column(
        String(36),
        nullable=True,
        index=True,
        comment=(
            "Set when the document went to the bin as part of a folder "
            "delete; NULL when it was deleted on its own."
        ),
    )

    compliance_reports = relationship(
        "ComplianceReport",
        secondary=compliance_report_document_association,
        back_populates="documents",
    )

    initiative_agreements = relationship(
        "InitiativeAgreement",
        secondary=initiative_agreement_document_association,
        back_populates="documents",
    )

    designated_actions = relationship(
        "DesignatedAction",
        secondary=designated_action_document_association,
        back_populates="documents",
    )
    admin_adjustments = relationship(
        "AdminAdjustment",
        secondary=admin_adjustment_document_association,
        back_populates="documents",
    )

    charging_sites = relationship(
        "ChargingSite",
        secondary=charging_site_document_association,
        back_populates="documents",
    )
    ci_applications = relationship(
        "CIApplication",
        secondary=ci_application_document_association,
        back_populates="documents",
    )
    internal_comments = relationship(
        "InternalComment",
        secondary=internal_comment_document_association,
        back_populates="documents",
    )
