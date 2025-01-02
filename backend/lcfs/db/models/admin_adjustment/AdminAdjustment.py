from sqlalchemy import Column, Integer, BigInteger, ForeignKey, DateTime, String
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, EffectiveDates


class AdminAdjustment(BaseModel, Auditable, EffectiveDates):
    __tablename__ = "admin_adjustment"
    __table_args__ = (
        {"comment": "Goverment to organization compliance units admin_adjustment"},
    )

    admin_adjustment_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the admin_adjustment",
    )
    compliance_units = Column(BigInteger, comment="Compliance Units")
    transaction_effective_date = Column(
        DateTime, nullable=True, comment="Transaction effective date"
    )
    gov_comment = Column(
        String(1500), comment="Comment from the government to organization"
    )
    to_organization_id = Column(Integer, ForeignKey("organization.organization_id"))
    transaction_id = Column(Integer, ForeignKey("transaction.transaction_id"))
    current_status_id = Column(
        Integer, ForeignKey("admin_adjustment_status.admin_adjustment_status_id")
    )

    to_organization = relationship("Organization", back_populates="admin_adjustments")
    transaction = relationship("Transaction")
    history = relationship("AdminAdjustmentHistory", back_populates="admin_adjustment")
    current_status = relationship("AdminAdjustmentStatus")
    admin_adjustment_internal_comments = relationship(
        "AdminAdjustmentInternalComment", back_populates="admin_adjustment"
    )

    def __repr__(self):
        return self.compliance_units
