from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Date,
    Enum,
    ForeignKey,
    Table,
    TIMESTAMP,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, Versioning
from lcfs.db.models.fuel.FuelType import QuantityUnitsEnum

# Association table linking CI applications to uploaded documents
ci_application_document_association = Table(
    "ci_application_document_association",
    BaseModel.metadata,
    Column(
        "ci_application_id",
        Integer,
        ForeignKey("ci_application.ci_application_id"),
        primary_key=True,
        comment="Foreign key to ci_application",
    ),
    Column(
        "document_id",
        Integer,
        ForeignKey("document.document_id"),
        primary_key=True,
        comment="Foreign key to document",
    ),
    Column(
        "document_category",
        String(50),
        nullable=False,
        comment=(
            "Step 3 categorisation: 'technical_report', 'ghgenius_model', "
            "or 'supporting'."
        ),
    ),
)


# Document category values for CI application uploads (Step 3).
CI_DOC_CATEGORY_TECHNICAL_REPORT = "technical_report"
CI_DOC_CATEGORY_GHGENIUS_MODEL = "ghgenius_model"
CI_DOC_CATEGORY_SUPPORTING = "supporting"
CI_DOC_CATEGORIES = {
    CI_DOC_CATEGORY_TECHNICAL_REPORT,
    CI_DOC_CATEGORY_GHGENIUS_MODEL,
    CI_DOC_CATEGORY_SUPPORTING,
}


class CIApplication(BaseModel, Auditable, Versioning):
    __tablename__ = "ci_application"
    __table_args__ = {
        "comment": (
            "Carbon Intensity application submitted by an organization, "
            "containing facility details, consultant contact, and signature."
        )
    }

    ci_application_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the CI application",
    )

    # ---------- Status ----------
    status_id = Column(
        Integer,
        ForeignKey("ci_application_status.ci_application_status_id"),
        nullable=False,
        comment="Current workflow status of the CI application",
    )

    # ---------- Organization ----------
    organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id"),
        nullable=False,
        comment="Organization submitting the CI application",
    )

    # ---------- Assigned IDIR analyst ----------
    assigned_analyst_id = Column(
        Integer,
        ForeignKey(
            "user_profile.user_profile_id",
            name="fk_ci_application_assigned_analyst_id_user_profile",
        ),
        nullable=True,
        index=True,
        comment="IDIR Analyst assigned to review this CI application.",
    )

    # ---------- Facility location ----------
    facility_city = Column(
        String(500),
        nullable=True,
        comment="City of the fuel production facility",
    )
    facility_province_state = Column(
        String(500),
        nullable=True,
        comment="Province or state of the fuel production facility",
    )
    facility_country = Column(
        String(500),
        nullable=False,
        comment="Country of the fuel production facility",
    )
    facility_iso = Column(
        String(10),
        nullable=True,
        comment="ISO country or region code for the facility location",
    )

    # ---------- Nameplate capacity ----------
    facility_nameplate_capacity = Column(
        Integer,
        nullable=False,
        comment="Annual nameplate capacity of the fuel production facility",
    )
    facility_nameplate_capacity_unit = Column(
        Enum(QuantityUnitsEnum),
        nullable=True,
        comment="Unit of measure for the facility nameplate capacity",
    )

    # ---------- Analyst triage (IDIR-only display) ----------
    priority_score = Column(
        Integer,
        nullable=True,
        comment="Analyst-facing triage score for the IDIR CI applications inbox.",
    )
    verification_level = Column(
        String(50),
        nullable=True,
        comment="Verification level label (e.g. 'VX1 - Low', 'VX2 - High').",
    )

    # ---------- Fuel code / pathway ----------
    proposed_fuel_code_effective_date = Column(
        Date,
        nullable=True,
        comment="Proposed date from which the fuel code becomes effective",
    )
    pathway_description = Column(
        Text,
        nullable=True,
        comment="Free-text description of the CI pathway",
    )
    pathway_changes_requested_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="UTC date and time supplemental pathway editing was enabled.",
    )
    pathway_changes_requested_by = Column(
        String(500),
        nullable=True,
        comment="Username of the IDIR user who requested pathway changes.",
    )
    generated_fuel_codes = Column(
        JSONB,
        nullable=True,
        comment="Draft fuel code rows generated from CI pathways for internal review.",
    )
    supporting_document_other = Column(
        String(1000),
        nullable=True,
        comment="Description of any other supporting documents provided",
    )

    # ---------- Consultant contact (all optional) ----------
    consultant_name = Column(
        String(500),
        nullable=True,
        comment="Full name of the third-party consultant (if applicable)",
    )
    consultant_company = Column(
        String(500),
        nullable=True,
        comment="Company of the third-party consultant (if applicable)",
    )
    consultant_email = Column(
        String(500),
        nullable=True,
        comment="Email address of the third-party consultant (if applicable)",
    )

    # ---------- Electronic signature ----------
    signature_user = Column(
        String(500),
        nullable=True,
        comment="Username or full name of the signatory",
    )
    signature_date_time = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="UTC date and time at which the application was electronically signed",
    )

    # ---------- Internal workflow tracking ----------
    assigned_analyst_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="Optional analyst assignment for internal queue display",
    )
    preliminary_risk_assessment = Column(
        String(20),
        nullable=True,
        comment="Preliminary risk assessment: Low, Medium, or High",
    )
    priority_score = Column(
        Integer,
        nullable=True,
        comment="Internal workflow priority score assigned during verification",
    )
    verification_1_user_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="User who completed Verification 1",
    )
    verification_1_date = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="UTC date and time Verification 1 was completed",
    )
    verification_2_user_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="User who completed Verification 2",
    )
    verification_2_date = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="UTC date and time Verification 2 was completed",
    )
    verification_2_risk_assessment = Column(
        String(20),
        nullable=True,
        comment="Risk assessment recorded during Verification 2",
    )
    verification_2_priority_score = Column(
        Integer,
        nullable=True,
        comment="Priority score recorded during Verification 2",
    )
    recommendation_user_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="User who recommended the application to the director",
    )
    recommendation_date = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="UTC date and time the application was recommended to director",
    )
    approval_user_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="User who approved the application",
    )
    approval_date = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="UTC date and time the application was approved",
    )

    # ---------- Relationships ----------
    ci_application_status = relationship(
        "CIApplicationStatus",
        back_populates="ci_applications",
        lazy="selectin",
    )
    organization = relationship(
        "Organization",
        back_populates="ci_applications",
        lazy="selectin",
    )
    assigned_analyst = relationship(
        "UserProfile",
        foreign_keys=[assigned_analyst_id],
        lazy="selectin",
    )
    assigned_analyst = relationship(
        "UserProfile",
        foreign_keys=[assigned_analyst_id],
        lazy="selectin",
    )
    verification_1_user = relationship(
        "UserProfile",
        foreign_keys=[verification_1_user_id],
        lazy="selectin",
    )
    verification_2_user = relationship(
        "UserProfile",
        foreign_keys=[verification_2_user_id],
        lazy="selectin",
    )
    recommendation_user = relationship(
        "UserProfile",
        foreign_keys=[recommendation_user_id],
        lazy="selectin",
    )
    approval_user = relationship(
        "UserProfile",
        foreign_keys=[approval_user_id],
        lazy="selectin",
    )
    pathways = relationship(
        "Pathway",
        back_populates="ci_application",
        cascade="all, delete, delete-orphan",
        lazy="selectin",
    )
    documents = relationship(
        "Document",
        secondary=ci_application_document_association,
        back_populates="ci_applications",
        lazy="selectin",
    )
    history_records = relationship(
        "CIApplicationHistory",
        back_populates="ci_application",
        cascade="all, delete, delete-orphan",
        lazy="selectin",
    )
    ci_application_internal_comments = relationship(
        "CIApplicationInternalComment",
        back_populates="ci_application",
        cascade="all, delete, delete-orphan",
    )
