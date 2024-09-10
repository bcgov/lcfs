from fastapi import Depends, Request

from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import FuelSupplyCreateUpdateSchema


class FuelSupplyValidation:
    def __init__(
        self,
        request: Request = None,
        fs_repo: FuelSupplyRepository = Depends(FuelSupplyRepository),
        report_repo: ComplianceReportRepository = Depends(ComplianceReportRepository),
    ):
        self.fs_repo = fs_repo
        self.request = request
        self.report_repo = report_repo

    async def check_duplicate(self, fuel_supply: FuelSupplyCreateUpdateSchema):
        return await self.fs_repo.check_duplicate(fuel_supply)
