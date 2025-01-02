from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable
from lcfs.db.models.compliance.ComplianceReport import (
    compliance_report_document_association,
)


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

    compliance_reports = relationship(
        "ComplianceReport",
        secondary=compliance_report_document_association,
        back_populates="documents",
    )
