import io
from fastapi import Depends
from openpyxl import Workbook
from starlette.responses import StreamingResponse

from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    FUEL_SUPPLY_SHEET,
    NOTIONAL_TRANSFER_SHEET,
    OTHER_USES_SHEET,
    EXPORT_FUEL_SHEET,
    ALLOCATION_AGREEMENTS_SHEET,
    FSE_EXPORT_SHEET,
)
from lcfs.web.api.compliance_report.sheet_exporters import (
    AllocationAgreementSheetExporter,
    FSESheetExporter,
    FuelExportSheetExporter,
    FuelSupplySheetExporter,
    NotionalTransferSheetExporter,
    OtherUsesSheetExporter,
    SummarySheetExporter,
)
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.final_supply_equipment.repo import FinalSupplyEquipmentRepository
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.notional_transfer.repo import NotionalTransferRepository
from lcfs.web.api.other_uses.repo import OtherUsesRepository
from lcfs.web.core.decorators import service_handler


class ComplianceReportExporter:
    def __init__(
        self,
        fse_repo: FinalSupplyEquipmentRepository = Depends(
            FinalSupplyEquipmentRepository
        ),
        fs_repo: FuelSupplyRepository = Depends(FuelSupplyRepository),
        cr_repo: ComplianceReportRepository = Depends(ComplianceReportRepository),
        nt_repo: NotionalTransferRepository = Depends(NotionalTransferRepository),
        ou_repo: OtherUsesRepository = Depends(OtherUsesRepository),
        ef_repo: FuelExportRepository = Depends(FuelExportRepository),
        aa_repo: AllocationAgreementRepository = Depends(AllocationAgreementRepository),
        summary_service: ComplianceReportSummaryService = Depends(
            ComplianceReportSummaryService
        ),
    ) -> None:
        self.summary_service = summary_service
        self.aa_repo = aa_repo
        self.ef_repo = ef_repo
        self.ou_repo = ou_repo
        self.nt_repo = nt_repo
        self.fs_repo = fs_repo
        self.cr_repo = cr_repo
        self.fse_repo = fse_repo

        self.summary_exporter = SummarySheetExporter()
        self.sheet_exporters_by_name = {
            FUEL_SUPPLY_SHEET: FuelSupplySheetExporter(
                fs_repo=self.fs_repo,
                cr_repo=self.cr_repo,
                summary_service=self.summary_service,
            ),
            NOTIONAL_TRANSFER_SHEET: NotionalTransferSheetExporter(
                nt_repo=self.nt_repo
            ),
            OTHER_USES_SHEET: OtherUsesSheetExporter(
                ou_repo=self.ou_repo,
                cr_repo=self.cr_repo,
            ),
            EXPORT_FUEL_SHEET: FuelExportSheetExporter(
                ef_repo=self.ef_repo,
                cr_repo=self.cr_repo,
                summary_service=self.summary_service,
            ),
            ALLOCATION_AGREEMENTS_SHEET: AllocationAgreementSheetExporter(
                aa_repo=self.aa_repo
            ),
            FSE_EXPORT_SHEET: FSESheetExporter(
                fse_repo=self.fse_repo,
                cr_repo=self.cr_repo,
            ),
        }
        self.sheet_exporters = list(self.sheet_exporters_by_name.values())

        self.data_loaders = {
            FUEL_SUPPLY_SHEET: self._load_fuel_supply_data,
            NOTIONAL_TRANSFER_SHEET: self._load_notional_transfer_data,
            OTHER_USES_SHEET: self._load_fuels_for_other_use_data,
            EXPORT_FUEL_SHEET: self._load_export_fuel_data,
            ALLOCATION_AGREEMENTS_SHEET: self._load_allocation_agreement_data,
            FSE_EXPORT_SHEET: self._load_fse_data,
        }
        self.annual_column_definitions = {
            sheet_name: exporter.annual_columns
            for sheet_name, exporter in self.sheet_exporters_by_name.items()
        }
        self.quarterly_column_definitions = {
            sheet_name: exporter.quarterly_columns
            for sheet_name, exporter in self.sheet_exporters_by_name.items()
        }

    @service_handler
    async def export(
        self, compliance_report_id: int, is_government: bool = True
    ) -> StreamingResponse:
        wb = Workbook()
        wb.remove(wb.active)

        # Get report data
        report = await self.cr_repo.get_compliance_report_by_id(
            report_id=compliance_report_id
        )
        is_quarterly = report.reporting_frequency == ReportingFrequency.QUARTERLY

        # Recalculate summary to ensure latest data and add summary sheet
        summary_schema = await self.summary_service.calculate_compliance_report_summary(
            compliance_report_id
        )
        await self.summary_exporter.export_to_workbook(
            wb,
            report,
            is_government=is_government,
            summary=summary_schema,
        )

        compliance_year = int(report.compliance_period.description)

        for exporter in self.sheet_exporters:
            if not exporter.supports(compliance_year):
                continue
            await exporter.export_to_workbook(
                wb,
                report,
                is_government=is_government,
            )

        # Export to stream
        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)

        # Generate filename - use EIR for early issuance reports, CR for annual reports
        prefix = "EIR" if is_quarterly else "CR"
        filename = f"{prefix}-{report.organization.name}-{report.compliance_period.description}-{report.current_status.status.value}.xlsx"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            stream, media_type=FILE_MEDIA_TYPE["XLSX"].value, headers=headers
        )

    async def _load_fuel_supply_data(self, uuid, cid, version, is_quarterly):
        return await self.sheet_exporters_by_name[FUEL_SUPPLY_SHEET].load_legacy(
            uuid, cid, version, is_quarterly
        )

    async def _load_notional_transfer_data(self, uuid, cid, version, is_quarterly):
        return await self.sheet_exporters_by_name[
            NOTIONAL_TRANSFER_SHEET
        ].load_legacy(uuid, cid, version, is_quarterly)

    async def _load_fuels_for_other_use_data(self, uuid, cid, version, is_quarterly):
        return await self.sheet_exporters_by_name[OTHER_USES_SHEET].load_legacy(
            uuid, cid, version, is_quarterly
        )

    async def _load_export_fuel_data(self, uuid, cid, version, is_quarterly):
        return await self.sheet_exporters_by_name[EXPORT_FUEL_SHEET].load_legacy(
            uuid, cid, version, is_quarterly
        )

    async def _load_allocation_agreement_data(self, cid, is_quarterly):
        return await self.sheet_exporters_by_name[
            ALLOCATION_AGREEMENTS_SHEET
        ].load_legacy(cid, is_quarterly)

    async def _load_fse_data(self, cid, is_quarterly, is_government: bool = True):
        return await self.sheet_exporters_by_name[FSE_EXPORT_SHEET].load_legacy(
            cid, is_quarterly, is_government
        )
