from typing import List, Optional
from fastapi import Depends, HTTPException, Request
from lcfs.db.models.compliance import FinalSupplyEquipment
from lcfs.web.api.compliance_report.schema import FinalSupplyEquipmentSchema
from lcfs.web.api.final_supply_equipment.repo import FinalSupplyEquipmentRepository
from lcfs.web.api.final_supply_equipment.schema import FinalSupplyEquipmentCreateSchema
from starlette import status

from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.utils.constants import LCFS_Constants


class FinalSupplyEquipmentValidation:
    def __init__(
        self,
        request: Request = None,
        fse_repo: FinalSupplyEquipmentRepository = Depends(
            FinalSupplyEquipmentRepository
        ),
        report_repo: ComplianceReportRepository = Depends(ComplianceReportRepository),
    ):
        self.fse_repo = fse_repo
        self.request = request
        self.report_repo = report_repo

    async def validate_fse_record(
        self,
        compliance_report_id: int,
        final_supply_equipments: List[FinalSupplyEquipmentCreateSchema],
    ):
        for final_supply_equipment in final_supply_equipments:
            if final_supply_equipment.compliance_report_id != compliance_report_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Mismatch compliance_report_id in final supply equipment: {final_supply_equipment}",
                )
            # TODO: validate each field from the UI

    async def check_equipment_uniqueness_and_overlap(self, data: FinalSupplyEquipmentCreateSchema):
        # Check for exact duplicates
        is_duplicate = await self.fse_repo.check_uniques_of_fse_row(data)
        if is_duplicate:
            raise ValueError(
                "Duplicate equipment found. Each equipment must be unique based on serial number, supply date range and location."
            )

        # Check for date range overlap
        is_overlapping = await self.fse_repo.check_overlap_of_fse_row(data)
        if is_overlapping:
            raise ValueError(
                f"Date range overlap found for equipment with serial number {data.serial_nbr} at the same or different location."
            )

        return True  # If no duplicates or overlaps found
