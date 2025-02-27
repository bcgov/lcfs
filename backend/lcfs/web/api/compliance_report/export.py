import io
from fastapi import Depends
from openpyxl import styles
from starlette.responses import StreamingResponse
from typing import List

from lcfs.db.models import ComplianceReportSummary
from lcfs.db.models.compliance import ComplianceReport
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.utils.spreadsheet_builder import (
    SpreadsheetBuilder,
    SpreadsheetColumn,
    RawSpreadsheet,
)
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.final_supply_equipment.export import (
    FSE_EXPORT_SHEETNAME,
    FSE_EXPORT_COLUMNS,
)
from lcfs.web.api.final_supply_equipment.repo import FinalSupplyEquipmentRepository
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.notional_transfer.repo import NotionalTransferRepository
from lcfs.web.api.other_uses.repo import OtherUsesRepository
from lcfs.web.api.other_uses.schema import OtherUsesSchema
from lcfs.web.core.decorators import service_handler

FS_EXPORT_NAME = "Supply of fuel"
FS_EXPORT_COLUMNS = [
    SpreadsheetColumn("Compliance Units", "int"),
    SpreadsheetColumn("Fuel Type", "text"),
    SpreadsheetColumn("Fuel type Other", "text"),
    SpreadsheetColumn("Fuel category", "text"),
    SpreadsheetColumn("End use", "text"),
    SpreadsheetColumn("Determining carbon intensity", "text"),
    SpreadsheetColumn("Fuel code", "text"),
    SpreadsheetColumn("Quantity supplied", "int"),
    SpreadsheetColumn("Units", "text"),
    SpreadsheetColumn("Target CI", "float"),
    SpreadsheetColumn("RCI", "float"),
    SpreadsheetColumn("UCI", "float"),
    SpreadsheetColumn("Energy density", "int"),
    SpreadsheetColumn("EER", "float"),
    SpreadsheetColumn("Energy content", "int"),
]

NT_EXPORT_NAME = "Notional transfer"
NT_EXPORT_COLUMNS = [
    SpreadsheetColumn("Legal name of trading partner", "int"),
    SpreadsheetColumn("Address for service", "text"),
    SpreadsheetColumn("Fuel category", "text"),
    SpreadsheetColumn("Received OR Transferred", "text"),
    SpreadsheetColumn("Quantity", "int"),
]

OU_EXPORT_NAME = "Fuel for other use"
OU_EXPORT_COLUMNS = [
    SpreadsheetColumn("Fuel Type", "text"),
    SpreadsheetColumn("Fuel category", "text"),
    SpreadsheetColumn("Determining carbon intensity", "text"),
    SpreadsheetColumn("Fuel code", "text"),
    SpreadsheetColumn("Quantity supplied", "int"),
    SpreadsheetColumn("Units", "text"),
    SpreadsheetColumn("RCI", "float"),
    SpreadsheetColumn("Expected use", "text"),
    SpreadsheetColumn("If other, enter expected use", "text"),
]

EF_EXPORT_NAME = "Export fuel"
EF_EXPORT_COLUMNS = [
    SpreadsheetColumn("Compliance units", "text"),
    SpreadsheetColumn("Export date", "date"),
    SpreadsheetColumn("Fuel type", "text"),
    SpreadsheetColumn("Fuel type other", "text"),
    SpreadsheetColumn("Fuel category", "text"),
    SpreadsheetColumn("End use", "text"),
    SpreadsheetColumn("Determining carbon intensity", "text"),
    SpreadsheetColumn("Fuel code", "text"),
    SpreadsheetColumn("Quantity supplied", "int"),
    SpreadsheetColumn("Units", "text"),
    SpreadsheetColumn("Target CI", "float"),
    SpreadsheetColumn("RCI", "float"),
    SpreadsheetColumn("UCI", "float"),
    SpreadsheetColumn("Energy density", "text"),
    SpreadsheetColumn("EER", "float"),
    SpreadsheetColumn("Energy content", "int"),
]

AA_EXPORT_NAME = "Allocation agreements"
AA_EXPORT_COLUMNS = [
    SpreadsheetColumn("Responsibility", "text"),
    SpreadsheetColumn("Legal name of transaction partner", "text"),
    SpreadsheetColumn("Address for service", "text"),
    SpreadsheetColumn("Email", "text"),
    SpreadsheetColumn("Phone", "text"),
    SpreadsheetColumn("Fuel type", "text"),
    SpreadsheetColumn("Fuel type other", "text"),
    SpreadsheetColumn("Determining carbon intensity", "text"),
    SpreadsheetColumn("Fuel code", "text"),
    SpreadsheetColumn("RCI", "float"),
    SpreadsheetColumn("Quantity", "int"),
    SpreadsheetColumn("Units", "text"),
]


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

    @service_handler
    async def export(self, compliance_report_id: int) -> StreamingResponse:
        export_format = "xlsx"  # Use modern Excel format
        compliance_report: ComplianceReport = (
            await self.cr_repo.get_compliance_report_by_id(
                report_id=compliance_report_id, is_model=True
            )
        )

        builder = SpreadsheetBuilder(file_format=export_format)

        # Include draft data if report status is Draft
        is_draft = (
            compliance_report.current_status.status
            == ComplianceReportStatusEnum.Draft.value
        )

        # Add sheets (in reverse desired order)
        await self.add_summary_sheet(builder, compliance_report.summary)
        await self.add_allocation_agreement_sheet(
            builder, compliance_report.compliance_report_id
        )
        await self.add_fse_sheet(builder, compliance_report_id)
        await self.add_export_fuel_sheet(
            builder, compliance_report.compliance_report_group_uuid, is_draft
        )
        await self.add_fuels_for_other_use_sheet(
            builder, compliance_report.compliance_report_group_uuid, is_draft
        )
        await self.add_notional_transfer_sheet(
            builder, compliance_report.compliance_report_group_uuid, is_draft
        )
        await self.add_fuel_supply_sheet(
            builder, compliance_report.compliance_report_group_uuid, is_draft
        )

        compliance_period = compliance_report.compliance_period.description
        filename = f"CR-{compliance_report.organization.name}-{compliance_period}-{compliance_report.current_status.status.value}.{export_format}"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        file_content = builder.build_spreadsheet()
        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=FILE_MEDIA_TYPE[export_format.upper()].value,
            headers=headers,
        )

    async def add_fse_sheet(
        self, builder: SpreadsheetBuilder, compliance_report_id: int
    ) -> SpreadsheetBuilder:
        data = await self.load_fse_data(compliance_report_id)
        builder.add_sheet(
            sheet_name=FSE_EXPORT_SHEETNAME,
            columns=FSE_EXPORT_COLUMNS,
            rows=data,
            styles={"bold_headers": True},
        )
        return builder

    async def load_fse_data(self, compliance_report_id: int) -> List[List]:
        results = await self.fse_repo.get_fse_paginated(
            compliance_report_id=compliance_report_id,
            pagination=PaginationRequestSchema(
                page=1, size=1000, filters=[], sort_orders=[]
            ),
        )
        return [
            [
                fse.organization_name,
                fse.supply_from_date,
                fse.supply_to_date,
                fse.kwh_usage,
                fse.serial_nbr,
                fse.manufacturer,
                fse.model,
                fse.level_of_equipment.name,
                fse.ports,
                ", ".join(ut.type for ut in fse.intended_use_types),
                ", ".join(uut.type_name for uut in fse.intended_user_types),
                fse.street_address,
                fse.city,
                fse.postal_code,
                fse.latitude,
                fse.longitude,
                fse.notes,
            ]
            for fse in results[0]
        ]

    async def add_fuel_supply_sheet(
        self,
        builder: SpreadsheetBuilder,
        compliance_report_group_uuid: str,
        is_draft: bool,
    ) -> SpreadsheetBuilder:
        data = await self.load_fuel_supply_data(compliance_report_group_uuid, is_draft)
        builder.add_sheet(
            sheet_name=FS_EXPORT_NAME,
            columns=FS_EXPORT_COLUMNS,
            rows=data,
            styles={"bold_headers": True},
        )
        return builder

    async def load_fuel_supply_data(
        self, compliance_report_group_uuid: str, is_draft: bool
    ) -> List[List]:
        results = await self.fs_repo.get_effective_fuel_supplies(
            compliance_report_group_uuid, not is_draft
        )
        return [
            [
                round(fs.compliance_units),
                fs.fuel_type.fuel_type,
                fs.fuel_type_other,
                fs.fuel_category.category,
                fs.end_use_type.type,
                fs.provision_of_the_act.name,
                fs.fuel_code.fuel_code if fs.fuel_code else None,
                fs.quantity,
                fs.units.value,
                fs.target_ci,
                fs.ci_of_fuel,
                fs.uci,
                fs.energy_density,
                fs.eer,
                fs.energy,
            ]
            for fs in results
        ]

    async def add_notional_transfer_sheet(
        self,
        builder: SpreadsheetBuilder,
        compliance_report_group_uuid: str,
        is_draft: bool,
    ) -> SpreadsheetBuilder:
        data = await self.load_notional_transfer_data(
            compliance_report_group_uuid, is_draft
        )
        builder.add_sheet(
            sheet_name=NT_EXPORT_NAME,
            columns=NT_EXPORT_COLUMNS,
            rows=data,
            styles={"bold_headers": True},
        )
        return builder

    async def load_notional_transfer_data(
        self, compliance_report_group_uuid: str, is_draft: bool
    ) -> List[List]:
        results = await self.nt_repo.get_effective_notional_transfers(
            compliance_report_group_uuid, not is_draft
        )
        return [
            [
                nt.legal_name,
                nt.address_for_service,
                nt.fuel_category,
                nt.received_or_transferred.value,
                nt.quantity,
            ]
            for nt in results
        ]

    async def add_fuels_for_other_use_sheet(
        self,
        builder: SpreadsheetBuilder,
        compliance_report_group_uuid: str,
        is_draft: bool,
    ) -> SpreadsheetBuilder:
        data = await self.load_fuels_for_other_use_data(
            compliance_report_group_uuid, is_draft
        )
        builder.add_sheet(
            sheet_name=OU_EXPORT_NAME,
            columns=OU_EXPORT_COLUMNS,
            rows=data,
            styles={"bold_headers": True},
        )
        return builder

    async def load_fuels_for_other_use_data(
        self, compliance_report_group_uuid: str, is_draft: bool
    ) -> List[List]:
        results: List[OtherUsesSchema] = await self.ou_repo.get_effective_other_uses(
            compliance_report_group_uuid, False, not is_draft
        )
        return [
            [
                ou.fuel_type,
                ou.fuel_category,
                ou.provision_of_the_act,
                ou.fuel_code,
                ou.quantity_supplied,
                ou.units,
                ou.ci_of_fuel,
                ou.expected_use,
                ou.rationale,
            ]
            for ou in results
        ]

    async def add_export_fuel_sheet(
        self,
        builder: SpreadsheetBuilder,
        compliance_report_group_uuid: str,
        is_draft: bool,
    ) -> SpreadsheetBuilder:
        data = await self.load_export_fuel_data(compliance_report_group_uuid, is_draft)
        builder.add_sheet(
            sheet_name=EF_EXPORT_NAME,
            columns=EF_EXPORT_COLUMNS,
            rows=data,
            styles={"bold_headers": True},
        )
        return builder

    async def load_export_fuel_data(
        self, compliance_report_group_uuid: str, is_draft: bool
    ) -> List[List]:
        results = await self.ef_repo.get_effective_fuel_exports(
            compliance_report_group_uuid, not is_draft
        )
        return [
            [
                round(ef.compliance_units),
                ef.export_date,
                ef.fuel_type.fuel_type,
                ef.fuel_type_other,
                ef.fuel_category.category,
                ef.end_use_type.type,
                ef.provision_of_the_act.name,
                ef.fuel_code.fuel_code if ef.fuel_code else None,
                ef.quantity,
                ef.units.value,
                ef.target_ci,
                ef.ci_of_fuel,
                ef.uci,
                ef.energy_density,
                ef.eer,
                ef.energy,
            ]
            for ef in results
        ]

    async def add_allocation_agreement_sheet(
        self, builder: SpreadsheetBuilder, compliance_report_id: int
    ) -> SpreadsheetBuilder:
        data = await self.load_allocation_agreement_data(compliance_report_id)
        builder.add_sheet(
            sheet_name=AA_EXPORT_NAME,
            columns=AA_EXPORT_COLUMNS,
            rows=data,
            styles={"bold_headers": True},
        )
        return builder

    async def load_allocation_agreement_data(
        self, compliance_report_id: int
    ) -> List[List]:
        results = await self.aa_repo.get_allocation_agreements(compliance_report_id)
        return [
            [
                aa.allocation_transaction_type,
                aa.transaction_partner,
                aa.postal_address,
                aa.transaction_partner_email,
                aa.transaction_partner_phone,
                aa.fuel_type,
                aa.fuel_type_other,
                aa.provision_of_the_act,
                aa.fuel_code,
                aa.ci_of_fuel,
                aa.quantity,
                aa.units,
            ]
            for aa in results
        ]

    async def add_summary_sheet(
        self, builder: SpreadsheetBuilder, summary: ComplianceReportSummary
    ) -> SpreadsheetBuilder:
        summary_model = self.summary_service.convert_summary_to_dict(summary)

        data = (
            [
                ["Renewable Requirement", "", "", "", ""],
                ["Line", "Description", "Gasoline", "Diesel", "Jet"],
            ]
            + [
                [line.line, line.description, line.gasoline, line.diesel, line.jet_fuel]
                for line in summary_model.renewable_fuel_target_summary
            ]
            + [
                ["", "", "", "", ""],
                ["Low carbon fuel target summary", "", "", "", ""],
                ["Line", "Description", "Value", "", ""],
            ]
            + [
                [line.line, line.description, line.value, "", ""]
                for line in summary_model.low_carbon_fuel_target_summary
            ]
            + [
                ["", "", "", "", ""],
                ["Non-compliance penalty payable summary", "", "", "", ""],
                ["", "Description", "Total Value", "", ""],
            ]
            + [
                ["", line.description, line.total_value]
                for line in summary_model.non_compliance_penalty_summary
            ]
        )

        bold_font = styles.Font(bold=True)
        my_styles = [
            [{"font": bold_font}, {}, {}, {}, {}],
            [
                {"font": bold_font},
                {"font": bold_font},
                {"font": bold_font},
                {"font": bold_font},
                {"font": bold_font},
            ],
            [
                {},
                {},
                {"type": "int"},
                {"type": "int"},
                {"type": "int"},
            ],  # Start Renewable Table
            [{}, {}, {"type": "int"}, {"type": "int"}, {"type": "int"}],
            [{}, {}, {"type": "int"}, {"type": "int"}, {"type": "int"}],
            [{}, {}, {"type": "int"}, {"type": "int"}, {"type": "int"}],
            [{}, {}, {"type": "int"}, {"type": "int"}, {"type": "int"}],
            [{}, {}, {"type": "int"}, {"type": "int"}, {"type": "int"}],
            [{}, {}, {"type": "int"}, {"type": "int"}, {"type": "int"}],
            [{}, {}, {"type": "int"}, {"type": "int"}, {"type": "int"}],
            [{}, {}, {"type": "int"}, {"type": "int"}, {"type": "int"}],
            [{}, {}, {"type": "int"}, {"type": "int"}, {"type": "int"}],
            [
                {},
                {},
                {"type": "float"},
                {"type": "float"},
                {"type": "float"},
            ],  # End Renewable Table
            [{}, {}, {}, {}, {}],
            [{"font": bold_font}, {}, {}, {}, {}],  # Start Low Carbon Table
            [
                {"font": bold_font},
                {"font": bold_font},
                {"font": bold_font},
                {"font": bold_font},
                {"font": bold_font},
            ],
            [{}, {}, {"type": "int"}, {}, {}],
            [{}, {}, {"type": "int"}, {}, {}],
            [{}, {}, {"type": "int"}, {}, {}],
            [{}, {}, {"type": "int"}, {}, {}],
            [{}, {}, {"type": "int"}, {}, {}],
            [{}, {}, {"type": "int"}, {}, {}],
            [{}, {}, {"type": "int"}, {}, {}],
            [{}, {}, {"type": "int"}, {}, {}],
            [{}, {}, {"type": "int"}, {}, {}],
            [{}, {}, {"type": "int"}, {}, {}],
            [{}, {}, {"type": "int"}, {}, {}],
            [{}, {}, {}, {}, {}],
            [{"font": bold_font}, {}, {}, {}, {}],  # Start Summary Table
            [{}, {"font": bold_font}, {"font": bold_font}, {}, {}],
            [{}, {}, {"type": "float"}, {}, {}],
            [{}, {}, {"type": "float"}, {}, {}],
            [{}, {}, {"type": "float"}, {}, {}],
        ]

        raw_sheet = RawSpreadsheet(data=data, label="Summary", styles=my_styles)
        builder.add_raw_sheet(raw_sheet)
        return builder
