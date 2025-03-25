from sqlalchemy import Column, Integer, String, DateTime, Enum
from sqlalchemy.orm import declarative_base

from lcfs.db.models.compliance.ComplianceReport import SupplementalInitiatorType
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum

Base = declarative_base()


class ComplianceReportListView(Base):
    __tablename__ = "v_compliance_report"
    __table_args__ = {
        "extend_existing": True,
        "info": {"is_view": True},
        "comment": "View to list latest compliance reports",
    }

    compliance_report_id = Column(Integer, primary_key=True)
    compliance_report_group_uuid = Column(String)
    version = Column(Integer)
    supplemental_initiator = Column(Enum(SupplementalInitiatorType))
    compliance_period_id = Column(Integer)
    compliance_period = Column(String)
    organization_id = Column(Integer)
    organization_name = Column(String)
    report_type = Column(String)
    report_status_id = Column(Integer)
    report_status = Column(Enum(ComplianceReportStatusEnum))
    update_date = Column(DateTime)
