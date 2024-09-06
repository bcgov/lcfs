from sqlalchemy import Column, Integer
from lcfs.db.base import BaseModel

class OrgComplianceReportCountView(BaseModel):
    __tablename__ = 'mv_org_compliance_report_count'
    __table_args__ = {
        'extend_existing': True,
        'comment': 'Materialized view for counting organization compliance reports for the OrgComplianceReports card on the dashboard'
    }

    organization_id = Column(Integer, primary_key=True, comment="Organization ID")
    count_in_progress = Column(Integer, comment="Count of in-progress compliance reports")
    count_awaiting_gov_review = Column(Integer, comment="Count of compliance reports awaiting government review")
