from sqlalchemy import event
from sqlalchemy.exc import InvalidRequestError
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary


@event.listens_for(ComplianceReportSummary, "before_update")
def prevent_update_if_locked(mapper, connection, target):
    if target.is_locked:
        raise InvalidRequestError("Cannot update a locked ComplianceReportSummary")


