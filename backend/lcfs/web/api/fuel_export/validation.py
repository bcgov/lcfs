from fastapi import Depends, Request
from lcfs.web.api.fuel_export.repo import FuelExportRepository

from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.fuel_export.schema import FuelExportSchema, FuelTypeOptionsResponse


class FuelExportValidation:
    def __init__(
        self,
        request: Request = None,
        fs_repo: FuelExportRepository = Depends(FuelExportRepository),
        report_repo: ComplianceReportRepository = Depends(ComplianceReportRepository),
    ):
        self.fse_repo = fs_repo
        self.request = request
        self.report_repo = report_repo

