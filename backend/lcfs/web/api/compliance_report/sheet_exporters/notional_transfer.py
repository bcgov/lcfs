from typing import Any, List

from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.web.api.compliance_report.schema import (
    NOTIONAL_TRANSFER_COLUMNS,
    NOTIONAL_TRANSFER_QUARTERLY_COLUMNS,
    NOTIONAL_TRANSFER_SHEET,
)
from lcfs.web.api.notional_transfer.repo import NotionalTransferRepository

from .base import TabularSheetExporter


class NotionalTransferSheetExporter(TabularSheetExporter):
    sheet_name = NOTIONAL_TRANSFER_SHEET
    annual_columns = NOTIONAL_TRANSFER_COLUMNS
    quarterly_columns = NOTIONAL_TRANSFER_QUARTERLY_COLUMNS

    def __init__(self, nt_repo: NotionalTransferRepository) -> None:
        self.nt_repo = nt_repo

    async def load_data(self, report, is_government: bool = True) -> List[List[Any]]:
        return await self.load_legacy(
            report.compliance_report_group_uuid,
            report.compliance_report_id,
            report.version,
            report.reporting_frequency == ReportingFrequency.QUARTERLY,
        )

    async def load_legacy(self, uuid, cid, version, is_quarterly) -> List[List[Any]]:
        data = await self.nt_repo.get_effective_notional_transfers(uuid, cid)
        headers = [col.label for col in self.get_columns(is_quarterly)]

        rows = []
        for nt in data:
            if is_quarterly:
                total_quantity = (
                    (nt.q1_quantity or 0)
                    + (nt.q2_quantity or 0)
                    + (nt.q3_quantity or 0)
                    + (nt.q4_quantity or 0)
                )
                rows.append(
                    [
                        nt.legal_name,
                        nt.address_for_service,
                        nt.fuel_category,
                        (
                            nt.received_or_transferred.value
                            if nt.received_or_transferred
                            else None
                        ),
                        nt.q1_quantity,
                        nt.q2_quantity,
                        nt.q3_quantity,
                        nt.q4_quantity,
                        total_quantity if total_quantity > 0 else None,
                    ]
                )
            else:
                rows.append(
                    [
                        nt.legal_name,
                        nt.address_for_service,
                        nt.fuel_category,
                        (
                            nt.received_or_transferred.value
                            if nt.received_or_transferred
                            else None
                        ),
                        nt.quantity,
                    ]
                )

        return [headers] + rows
