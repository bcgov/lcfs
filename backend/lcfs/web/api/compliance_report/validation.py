from fastapi import Depends, HTTPException, Request
from lcfs.web.api.other_uses.schema import OtherUsesSchema
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository


class ComplianceReportValidation:
    def __init__(
            self,
            request: Request = None,
            service: ComplianceReportServices = Depends(
                ComplianceReportServices),
            repo: ComplianceReportRepository = Depends(
                ComplianceReportRepository)
    ) -> None:
        self.request = request
        self.service = service
        self.repo = repo

    async def validate_fuel_for_other_uses_create(self, request, fuel_for_other_uses: OtherUsesSchema):
        fuel_type = await self.repo.get_fuel_type(fuel_for_other_uses.fuel_type_id)

        if not fuel_type:
            raise HTTPException(
                status_code=422,
                detail="Invalid fuel type. Please select a valid fuel type from the available options."
            )

        fuel_category = await self.repo.get_fuel_category(fuel_for_other_uses.fuel_category_id)

        if not fuel_category:
            raise HTTPException(
                status_code=422,
                detail="Invalid fuel category. Please select a valid fuel category from the available options."
            )

        expected_use = await self.repo.get_expected_use(fuel_for_other_uses.expected_use_id)

        if not expected_use:
            raise HTTPException(
                status_code=422,
                detail="Invalid expected use. Please select a valid expected use from the available options."
            )

        return

    async def validate_fuel_for_other_uses_update(self, request, fuel_for_other_uses: OtherUsesSchema):
        pass
