import string
import random
import secrets
from sqlalchemy import (
    Column,
    BigInteger,
    Integer,
    String,
    ForeignKey,
    event,
    select,
    Boolean,
    text,
)
from sqlalchemy.orm import relationship, Session
from lcfs.db.base import BaseModel, Auditable, EffectiveDates


def generate_unique_code(session):
    """Generates a unique 4-character alphanumeric code."""
    characters = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choices(characters, k=4))
        result = session.execute(
            select(Organization).filter_by(organization_code=code).limit(1)
        )
        if not result.scalar():
            return code


def generate_secure_link_key():
    """Generates a cryptographically secure 64-character URL-safe link key."""
    return secrets.token_urlsafe(48)


class Organization(BaseModel, Auditable, EffectiveDates):
    __tablename__ = "organization"
    __table_args__ = {
        "comment": "Contains a list of all of the recognized Part 3 "
        "fuel suppliers, both past and present, as well as "
        "an entry for the government which is also "
        "considered an organization."
    }

    organization_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the organization",
    )
    organization_code = Column(
        String(4),
        unique=True,
        nullable=False,
        comment="Unique 4-character alphanumeric ID",
    )
    name = Column(String(500), comment="Organization's legal name")
    operating_name = Column(String(500), comment="Organization's Operating name")
    email = Column(String(255), comment="Organization's email address")
    phone = Column(String(50), comment="Organization's phone number")
    edrms_record = Column(String(100), comment="Organization's EDRMS record number")
    total_balance = Column(
        BigInteger,
        server_default="0",
        nullable=False,
        comment="The total balance of compliance units for the specified organization.",
    )
    reserved_balance = Column(
        BigInteger,
        server_default="0",
        nullable=False,
        comment="The reserved balance of compliance units for the specified organization.",
    )
    count_transfers_in_progress = Column(
        Integer,
        server_default="0",
        nullable=False,
        comment="The count of transfers in progress for the specified organization.",
    )
    organization_status_id = Column(
        Integer, ForeignKey("organization_status.organization_status_id")
    )
    organization_type_id = Column(
        Integer,
        ForeignKey("organization_type.organization_type_id"),
        comment="Organization's type",
    )
    organization_address_id = Column(
        Integer, ForeignKey("organization_address.organization_address_id")
    )
    organization_attorney_address_id = Column(
        Integer,
        ForeignKey("organization_attorney_address.organization_attorney_address_id"),
    )
    records_address = Column(
        String(2000),
        comment="Organization's address in BC where records are maintained",
    )
    credit_trading_enabled = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Whether the organization is enabled for credit trading market participation",
    )
    credit_market_contact_name = Column(
        String(500),
        nullable=True,
        comment="Contact name for credit trading market (if different from organization)",
    )
    credit_market_contact_email = Column(
        String(255),
        nullable=True,
        comment="Contact email for credit trading market (if different from organization)",
    )
    credit_market_contact_phone = Column(
        String(50),
        nullable=True,
        comment="Contact phone for credit trading market (if different from organization)",
    )
    credit_market_is_seller = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Whether the organization is interested in selling credits",
    )
    credit_market_is_buyer = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Whether the organization is interested in buying credits",
    )
    credits_to_sell = Column(
        Integer,
        nullable=False,
        server_default=text("0"),
        comment="Number of credits the organization wants to sell",
    )
    display_in_credit_market = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Whether the organization should be displayed in the credit trading market",
    )
    company_details = Column(
        String,
        nullable=True,
        comment="Free-form text field for company details",
    )
    company_representation_agreements = Column(
        String,
        nullable=True,
        comment="Free-form text field for company representation agreements or affiliated organizations",
    )
    company_acting_as_aggregator = Column(
        String,
        nullable=True,
        comment="Free-form text field for acting as an aggregator information",
    )
    company_additional_notes = Column(
        String,
        nullable=True,
        comment="Free-form text field for additional company notes",
    )

    org_type = relationship(
        "OrganizationType", back_populates="organizations", lazy="joined"
    )
    org_status = relationship(
        "OrganizationStatus", back_populates="organizations", lazy="joined"
    )
    org_address = relationship(
        "OrganizationAddress", back_populates="organization", uselist=False
    )
    org_attorney_address = relationship(
        "OrganizationAttorneyAddress",
        back_populates="organization",
        uselist=False,
    )
    user_profiles = relationship("UserProfile", back_populates="organization")
    transactions = relationship("Transaction", back_populates="organization")

    admin_adjustments = relationship(
        "AdminAdjustment", back_populates="to_organization"
    )
    initiative_agreements = relationship(
        "InitiativeAgreement", back_populates="to_organization"
    )
    transfers_sent = relationship(
        "Transfer",
        foreign_keys="[Transfer.from_organization_id]",
        back_populates="from_organization",
    )
    transfers_received = relationship(
        "Transfer",
        foreign_keys="[Transfer.to_organization_id]",
        back_populates="to_organization",
    )
    compliance_reports = relationship("ComplianceReport", back_populates="organization")
    notification_messages = relationship(
        "NotificationMessage", back_populates="related_organization"
    )
    early_issuance_by_years = relationship(
        "OrganizationEarlyIssuanceByYear", back_populates="organization"
    )
    link_keys = relationship(
        "OrganizationLinkKey",
        back_populates="organization",
        cascade="all, delete-orphan",
    )

    charging_sites = relationship(
        "ChargingSite",
        foreign_keys="[ChargingSite.organization_id]",
        back_populates="organization",
    )
    charging_equipment_compliance_associations = relationship(
        "ComplianceReportChargingEquipment", back_populates="organization"
    )


@event.listens_for(Organization, "before_insert")
def receive_before_insert(mapper, connection, target):
    session = Session(bind=connection)
    target.organization_code = generate_unique_code(session)
    session.close()
