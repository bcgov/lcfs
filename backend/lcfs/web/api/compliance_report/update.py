from fastapi import Depends, Request
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import ComplianceReportUpdateSchema
from lcfs.web.exception.exceptions import DataNotFoundException, ServiceException

class ComplianceReportUpdateService:
    def __init__(self, repo: ComplianceReportRepository = Depends(), request: Request = None):
        self.repo = repo
        self.request = request

    async def update_compliance_report(self, report_id: int, report_data: ComplianceReportUpdateSchema) -> ComplianceReport:
        """Updates an existing compliance report."""
        report = await self.repo.get_compliance_report(report_id)
        if not report:
            raise DataNotFoundException(f"Compliance report with ID {report_id} not found")

        new_status = await self.repo.get_compliance_report_status_by_desc(report_data.status)
        status_has_changed = report.status != new_status

        # Update fields
        report.status = new_status
        report.supplemental_note = report_data.supplemental_note

        if status_has_changed:
            await self.handle_status_change(report, new_status.status)

            await self.repo.add_compliance_report_history(report, self.request.user)

        updated_report = await self.repo.update_compliance_report(report)
        return updated_report

    async def handle_status_change(self, report: ComplianceReport, new_status: ComplianceReportStatusEnum):
        """Handle status-specific actions based on the new status."""
        status_handlers = {
            ComplianceReportStatusEnum.Draft: self.handle_draft_status,
            ComplianceReportStatusEnum.Submitted: self.handle_submitted_status,
            ComplianceReportStatusEnum.Recommended_by_analyst: self.handle_recommended_by_analyst_status,
            ComplianceReportStatusEnum.Recommended_by_manager: self.handle_recommended_by_manager_status,
            ComplianceReportStatusEnum.Assessed: self.handle_assessed_status,
            ComplianceReportStatusEnum.ReAssessed: self.handle_reassessed_status,
        }
        
        handler = status_handlers.get(new_status)
        if handler:
            await handler(report)
        else:
            raise ServiceException(f"Unsupported status change to {new_status}")

    async def handle_draft_status(self, report: ComplianceReport):
        """Handle actions when a report is set to Draft status."""
        # Implement logic for Draft status
        pass

    async def handle_submitted_status(self, report: ComplianceReport):
        """Handle actions when a report is Submitted."""
        # Implement logic for Submitted status
        pass

    async def handle_recommended_by_analyst_status(self, report: ComplianceReport):
        """Handle actions when a report is Recommended by analyst."""
        # Implement logic for Recommended by analyst status
        pass

    async def handle_recommended_by_manager_status(self, report: ComplianceReport):
        """Handle actions when a report is Recommended by manager."""
        # Implement logic for Recommended by manager status
        pass

    async def handle_assessed_status(self, report: ComplianceReport):
        """Handle actions when a report is Assessed."""
        # Implement logic for Assessed status
        pass

    async def handle_reassessed_status(self, report: ComplianceReport):
        """Handle actions when a report is ReAssessed."""
        # Implement logic for ReAssessed status
        pass
