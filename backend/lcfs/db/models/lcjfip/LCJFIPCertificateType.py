from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel, DisplayOrder, EffectiveDates


class LCJFIPCertificateType(BaseModel, Auditable, DisplayOrder, EffectiveDates):
    __tablename__ = "lcjfip_certificate_type"
    __table_args__ = {
        "comment": "Lookup of air operator certificate types for LCJFIP applicants."
    }

    lcjfip_certificate_type_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the certificate type.",
    )
    name = Column(
        String(100),
        nullable=False,
        unique=True,
        comment="Option label shown in the select list, e.g. 'Domestic'.",
    )
    description = Column(
        String(500),
        nullable=True,
        comment="Description of the certificate type.",
    )

    applications = relationship("LCJFIPApplication", back_populates="certificate_type")

    def __repr__(self) -> str:
        return f"<LCJFIPCertificateType(id={self.lcjfip_certificate_type_id}, name={self.name})>"
