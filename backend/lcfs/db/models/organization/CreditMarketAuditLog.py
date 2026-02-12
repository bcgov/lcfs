from sqlalchemy import Boolean, Column, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel


class CreditMarketAuditLog(BaseModel):
    __tablename__ = "credit_market_audit_log"
    __table_args__ = (
        Index(
            "idx_credit_market_audit_log_create_date",
            "create_date",
        ),
        Index(
            "idx_credit_market_audit_log_changed_by",
            "changed_by",
        ),
        {
            "comment": "Captures historical snapshots of credit trading market listings after each change.",
        },
    )

    credit_market_audit_log_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for each credit market audit log entry.",
    )
    organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id"),
        nullable=False,
        comment="Organization associated with the credit market listing change.",
    )
    credits_to_sell = Column(
        Integer,
        nullable=False,
        server_default=text("0"),
        comment="Credits to sell at the time of the change.",
    )
    credit_market_is_seller = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Whether the organization was marked as seller.",
    )
    credit_market_is_buyer = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Whether the organization was marked as buyer.",
    )
    contact_person = Column(
        String(500),
        nullable=True,
        comment="Credit market contact person name.",
    )
    phone = Column(
        String(50),
        nullable=True,
        comment="Credit market contact phone.",
    )
    email = Column(
        String(255),
        nullable=True,
        comment="Credit market contact email.",
    )
    changed_by = Column(
        String(255),
        nullable=True,
        comment="BCeID/IDIR username that performed the listing change.",
    )

    organization = relationship("Organization", back_populates="credit_market_audit_logs")
