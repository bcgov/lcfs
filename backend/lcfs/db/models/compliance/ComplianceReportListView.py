from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base

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
    compliance_period_id = Column(Integer)
    compliance_period = Column(String)
    organization_id = Column(Integer)
    organization_name = Column(String)
    report_type = Column(String)
    report_status_id = Column(Integer)
    report_status = Column(String)
    update_date = Column(DateTime)
