from datetime import datetime
from typing import Optional, Tuple

from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository


async def calculate_transaction_period_dates(
    compliance_year: int,
    organization_id: int,
    repo: ComplianceReportRepository,
    exclude_report_id: Optional[int] = None,
) -> Tuple[datetime, datetime]:
    """
    Calculate the transaction period date range for Lines 12 and 13 (and any other
    transfer/IA aggregations) based on whether a previous assessed report exists.

    Rules:
    - If a previous assessed report exists for compliance_year-1: Apr 1 of compliance_year to Mar 31 of compliance_year+1
    - Otherwise (first report): Jan 1 of compliance_year to Mar 31 of compliance_year+1
    """
    prev_assessed_report = await repo.get_assessed_compliance_report_by_period(
        organization_id, compliance_year - 1, exclude_report_id
    )

    transaction_end_date = datetime(compliance_year + 1, 3, 31, 23, 59, 59)
    if prev_assessed_report:
        transaction_start_date = datetime(compliance_year, 4, 1, 0, 0, 0)
    else:
        transaction_start_date = datetime(compliance_year, 1, 1, 0, 0, 0)

    return transaction_start_date, transaction_end_date
