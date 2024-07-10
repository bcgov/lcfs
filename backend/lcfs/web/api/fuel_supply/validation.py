from typing import List
from fastapi import Depends, HTTPException, Request
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from starlette import status

from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.utils.constants import LCFS_Constants


class FuelSupplyValidation:
    def __init__(
        self,
        request: Request = None,
        fs_repo: FuelSupplyRepository = Depends(FuelSupplyRepository),
        report_repo: ComplianceReportRepository = Depends(ComplianceReportRepository),
    ):
        self.fse_repo = fs_repo
        self.request = request
        self.report_repo = report_repo

    