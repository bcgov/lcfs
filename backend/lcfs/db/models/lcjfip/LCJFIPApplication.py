from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    CheckConstraint,
    Column,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
)
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel

# An application can hold more than one CAR operation type. The form offers a
# single selection today; the association keeps multi-select a UI change.
lcjfip_application_car_type = Table(
    "lcjfip_application_car_type",
    BaseModel.metadata,
    Column(
        "lcjfip_application_id",
        Integer,
        ForeignKey(
            "lcjfip_application.lcjfip_application_id",
            name="fk_lcjfip_application_car_type_lcjfip_application_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
        comment="LCJFIP application holding the CAR type.",
    ),
    Column(
        "car_type_id",
        Integer,
        ForeignKey("lcjfip_car_type.lcjfip_car_type_id"),
        primary_key=True,
        comment="CAR type selected on the application.",
    ),
    comment="CAR operation types selected on an LCJFIP application.",
)

lcjfip_application_document_association = Table(
    "lcjfip_application_document_association",
    BaseModel.metadata,
    Column(
        "lcjfip_application_id",
        Integer,
        ForeignKey(
            "lcjfip_application.lcjfip_application_id",
            name="fk_lcjfip_application_document_lcjfip_application_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
        comment="LCJFIP application the document belongs to.",
    ),
    Column(
        "document_id",
        Integer,
        ForeignKey(
            "document.document_id",
            name="fk_lcjfip_application_document_document_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
        comment="Uploaded or generated document.",
    ),
    comment="Documents attached to an LCJFIP application.",
)


class LCJFIPApplication(BaseModel, Auditable):
    """
    An application to the Low Carbon Jet Fuel Incentive Program.

    Completeness is enforced when the application is submitted, not by the
    database: a Draft can be saved with any field empty. The database only
    enforces rules that hold in every status (ranges, references, and the
    paired signature fields).

    Values that are derived and therefore not stored:
    - total estimated volume for support = SUM(purchase_details.estimated_volume)
    - application number shown to users = 'JF-' || lcjfip_application_id
    - submitted date = signed_date (submission is the signing act)
    - incentive unit = incentive_option.incentive_type (CAD or credits)
    - fuel supplier legal name, when linked = fuel_supplier_organization.name
    """

    __tablename__ = "lcjfip_application"
    __table_args__ = (
        CheckConstraint(
            "requested_incentive_volume IS NULL OR requested_incentive_volume >= 0",
            name="requested_volume_non_negative",
        ),
        CheckConstraint(
            "estimated_incentive_amount IS NULL OR estimated_incentive_amount >= 0",
            name="incentive_amount_non_negative",
        ),
        CheckConstraint(
            "fuel_supplier_organization_id IS NULL OR fuel_supplier_legal_name IS NULL",
            name="fuel_supplier_org_or_name",
        ),
        CheckConstraint(
            "(signed_by_user_profile_id IS NULL) = (signed_date IS NULL)",
            name="signature_complete",
        ),
        {
            "comment": (
                "Low Carbon Jet Fuel Incentive Program (LCJFIP) application "
                "submitted by an organization: applicant details, preferred "
                "incentive, requested incentive and signing authority."
            )
        },
    )

    lcjfip_application_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the LCJFIP application. Displayed as JF-<id>.",
    )

    # ---------- Applicant ----------
    organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id"),
        nullable=False,
        index=True,
        comment="Applicant organization (the logged-in BCeID user's organization).",
    )
    contact_user_profile_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=False,
        comment="Applicant contact shown on the form and in letters. Defaults to the user who created the application.",
    )
    certificate_type_id = Column(
        Integer,
        ForeignKey(
            "lcjfip_certificate_type.lcjfip_certificate_type_id",
            name="fk_lcjfip_application_certificate_type_id",
        ),
        nullable=True,
        comment="Air operator certificate type held by the applicant.",
    )

    # ---------- Workflow ----------
    status_id = Column(
        Integer,
        ForeignKey("lcjfip_application_status.lcjfip_application_status_id"),
        nullable=False,
        index=True,
        comment="Current workflow status of the application.",
    )
    application_period_id = Column(
        Integer,
        ForeignKey(
            "lcjfip_application_period.lcjfip_application_period_id",
            name="fk_lcjfip_application_application_period_id",
        ),
        nullable=True,
        index=True,
        comment="Intake period the application was submitted into. Set on submission; NULL while Draft.",
    )

    # ---------- Incentive ----------
    incentive_option_id = Column(
        Integer,
        ForeignKey(
            "lcjfip_incentive_option.lcjfip_incentive_option_id",
            name="fk_lcjfip_application_incentive_option_id",
        ),
        nullable=True,
        comment="Preferred incentive option. Its incentive_type sets the unit of estimated_incentive_amount.",
    )
    estimated_carbon_intensity = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Estimated carbon intensity of the LCJF in gCO2e/MJ. Selects the incentive rate band.",
    )
    fuel_code_id = Column(
        Integer,
        ForeignKey("fuel_code.fuel_code_id", ondelete="SET NULL"),
        nullable=True,
        comment="BC-LCFS fuel code of the LCJF, if known.",
    )
    requested_incentive_volume = Column(
        BigInteger,
        nullable=True,
        comment="Total volume of LCJF incentive requested, in litres.",
    )
    estimated_incentive_amount = Column(
        Numeric(15, 2),
        nullable=True,
        comment="Estimated incentive amount requested: CAD for Cash options, LCFS credits for Credit options.",
    )

    # ---------- Fuel supplier incentive transfer ----------
    # Required on submission only when incentive_option.requires_fuel_supplier.
    fuel_supplier_organization_id = Column(
        Integer,
        ForeignKey(
            "organization.organization_id",
            name="fk_lcjfip_application_fuel_supplier_organization_id",
        ),
        nullable=True,
        comment="LCFS-registered fuel supplier that receives the incentive. Credits can only be transferred to a registered organization.",
    )
    fuel_supplier_legal_name = Column(
        String(500),
        nullable=True,
        comment="Fuel supplier legal name as entered, only when the supplier is not linked to an LCFS organization.",
    )
    fuel_supplier_contact_first_name = Column(
        String(100),
        nullable=True,
        comment="First name of the fuel supplier contact.",
    )
    fuel_supplier_contact_last_name = Column(
        String(100),
        nullable=True,
        comment="Last name of the fuel supplier contact.",
    )
    fuel_supplier_contact_email = Column(
        String(255),
        nullable=True,
        comment="Email address of the fuel supplier contact.",
    )

    # ---------- Signing authority declaration ----------
    signed_by_user_profile_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="User who accepted the signing authority declarations and submitted the application.",
    )
    signed_date = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="UTC date and time the declarations were accepted and the application submitted.",
    )

    # ---------- Relationships ----------
    organization = relationship(
        "Organization",
        foreign_keys=[organization_id],
        back_populates="lcjfip_applications",
        lazy="selectin",
    )
    contact_user = relationship(
        "UserProfile", foreign_keys=[contact_user_profile_id], lazy="selectin"
    )
    certificate_type = relationship(
        "LCJFIPCertificateType", back_populates="applications", lazy="selectin"
    )
    car_types = relationship(
        "LCJFIPCarType",
        secondary=lcjfip_application_car_type,
        order_by="LCJFIPCarType.display_order",
        lazy="selectin",
    )
    status = relationship(
        "LCJFIPApplicationStatus", back_populates="applications", lazy="selectin"
    )
    application_period = relationship(
        "LCJFIPApplicationPeriod", back_populates="applications", lazy="selectin"
    )
    incentive_option = relationship(
        "LCJFIPIncentiveOption", back_populates="applications", lazy="selectin"
    )
    fuel_code = relationship("FuelCode", lazy="selectin")
    fuel_supplier_organization = relationship(
        "Organization", foreign_keys=[fuel_supplier_organization_id], lazy="selectin"
    )
    signed_by_user = relationship(
        "UserProfile", foreign_keys=[signed_by_user_profile_id], lazy="selectin"
    )
    purchase_details = relationship(
        "LCJFIPPurchaseDetail",
        back_populates="application",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="LCJFIPPurchaseDetail.lcjfip_purchase_detail_id",
        lazy="selectin",
    )
    history_records = relationship(
        "LCJFIPApplicationHistory",
        back_populates="application",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="LCJFIPApplicationHistory.create_date",
    )
    documents = relationship(
        "Document",
        secondary=lcjfip_application_document_association,
        back_populates="lcjfip_applications",
        passive_deletes=True,
    )
    lcjfip_application_internal_comments = relationship(
        "LCJFIPApplicationInternalComment",
        back_populates="lcjfip_application",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<LCJFIPApplication(id={self.lcjfip_application_id}, organization_id={self.organization_id})>"
