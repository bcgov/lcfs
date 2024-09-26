from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable


class Document(BaseModel, Auditable):
    __tablename__ = "document"
    __table_args__ = (
        UniqueConstraint("document_id"),
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

    compliance_report_id = Column(
        Integer, ForeignKey("compliance_report.compliance_report_id")
    )
    compliance_report = relationship("ComplianceReport", back_populates="documents")
