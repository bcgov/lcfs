from typing import Any, List

from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository
from lcfs.web.api.compliance_report.schema import (
    ALLOCATION_AGREEMENTS_SHEET,
    ALLOCATION_AGREEMENT_COLUMNS,
    ALLOCATION_AGREEMENT_QUARTERLY_COLUMNS,
)

from .base import TabularSheetExporter


class AllocationAgreementSheetExporter(TabularSheetExporter):
    sheet_name = ALLOCATION_AGREEMENTS_SHEET
    annual_columns = ALLOCATION_AGREEMENT_COLUMNS
    quarterly_columns = ALLOCATION_AGREEMENT_QUARTERLY_COLUMNS

    def __init__(self, aa_repo: AllocationAgreementRepository) -> None:
        self.aa_repo = aa_repo

    async def load_data(self, report, is_government: bool = True) -> List[List[Any]]:
        return await self.load_legacy(
            report.compliance_report_id,
            report.reporting_frequency == ReportingFrequency.QUARTERLY,
        )

    async def load_legacy(self, cid, is_quarterly) -> List[List[Any]]:
        data = await self.aa_repo.get_allocation_agreements(cid)
        headers = [col.label for col in self.get_columns(is_quarterly)]
        rows = []

        for aa in data:
            if is_quarterly:
                total_quantity = (
                    (aa.q1_quantity or 0)
                    + (aa.q2_quantity or 0)
                    + (aa.q3_quantity or 0)
                    + (aa.q4_quantity or 0)
                )
                rows.append(
                    [
                        self._extract_display_value(
                            aa.allocation_transaction_type, "type"
                        ),
                        aa.transaction_partner,
                        aa.postal_address,
                        aa.transaction_partner_email,
                        aa.transaction_partner_phone,
                        self._extract_display_value(aa.fuel_type, "fuel_type"),
                        aa.fuel_type_other,
                        self._extract_display_value(aa.fuel_category, "category"),
                        self._extract_display_value(aa.provision_of_the_act, "name"),
                        self._extract_display_value(aa.fuel_code, "fuel_code"),
                        aa.ci_of_fuel,
                        aa.q1_quantity,
                        aa.q2_quantity,
                        aa.q3_quantity,
                        aa.q4_quantity,
                        total_quantity if total_quantity > 0 else None,
                        self._extract_display_value(aa.units, "value"),
                    ]
                )
            else:
                rows.append(
                    [
                        self._extract_display_value(
                            aa.allocation_transaction_type, "type"
                        ),
                        aa.transaction_partner,
                        aa.postal_address,
                        aa.transaction_partner_email,
                        aa.transaction_partner_phone,
                        self._extract_display_value(aa.fuel_type, "fuel_type"),
                        aa.fuel_type_other,
                        self._extract_display_value(aa.fuel_category, "category"),
                        self._extract_display_value(aa.provision_of_the_act, "name"),
                        self._extract_display_value(aa.fuel_code, "fuel_code"),
                        aa.ci_of_fuel,
                        aa.quantity,
                        self._extract_display_value(aa.units, "value"),
                    ]
                )

        return [headers] + rows
