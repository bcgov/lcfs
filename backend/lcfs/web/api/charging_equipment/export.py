import io
from typing import List

from fastapi import Depends
from openpyxl.worksheet.datavalidation import DataValidation
from starlette.responses import StreamingResponse

from lcfs.db.models import Organization, UserProfile
from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder, SpreadsheetColumn
from lcfs.web.api.charging_equipment.repo import ChargingEquipmentRepository
from lcfs.web.core.decorators import service_handler


CE_EXPORT_FILENAME = "ChargingEquipment"
CE_EXPORT_SHEETNAME = "ChargingEquipment"
VALIDATION_SHEETNAME = "VALUES"
CE_EXPORT_COLUMNS = [
    SpreadsheetColumn("Charging Site", "text"),
    SpreadsheetColumn("Allocating Organization", "text"),
    SpreadsheetColumn("Serial Number", "text"),
    SpreadsheetColumn("Manufacturer", "text"),
    SpreadsheetColumn("Model", "text"),
    SpreadsheetColumn("Level of Equipment", "text"),
    SpreadsheetColumn("Ports", "text"),
    SpreadsheetColumn("Intended Uses", "text"),
    SpreadsheetColumn("Notes", "text"),
]


class ChargingEquipmentExporter:
    def __init__(
        self,
        repo: ChargingEquipmentRepository = Depends(ChargingEquipmentRepository),
    ) -> None:
        self.repo = repo

    @service_handler
    async def export(
        self,
        organization_id: int,
        user: UserProfile,
        organization: Organization,
        include_data: bool = True,
    ) -> StreamingResponse:
        """
        Prepares a list of charging equipment in a downloadable spreadsheet.
        """
        export_format = "xlsx"

        builder = SpreadsheetBuilder(file_format=export_format)

        validators = await self._create_validators(organization, builder)

        data = []
        if include_data:
            data = await self.load_charging_equipment_data(organization_id)

        builder.add_sheet(
            sheet_name=CE_EXPORT_SHEETNAME,
            columns=CE_EXPORT_COLUMNS,
            rows=data,
            styles={"bold_headers": True},
            validators=validators,
        )
        file_content = builder.build_spreadsheet()

        filename = f"{CE_EXPORT_FILENAME}_{organization.name}.{export_format}"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=FILE_MEDIA_TYPE[export_format.upper()].value,
            headers=headers,
        )

    async def _create_validators(self, organization: Organization, builder):
        validators: List[DataValidation] = []

        # Options
        charging_sites = await self.repo.get_charging_sites_by_organization(
            organization.organization_id
        )
        organizations = await self.repo.get_organizations()
        levels = await self.repo.get_levels_of_equipment()
        end_use_types = await self.repo.get_end_use_types()

        ports_options = ["Single port", "Dual port"]

        site_names = [s.site_name for s in charging_sites]
        org_names = [o.name for o in organizations]
        level_names = [l.name for l in levels]
        end_use_names = [e.type for e in end_use_types]

        # Charging Site validator (Column A)
        site_validator = DataValidation(
            type="list",
            formula1="=VALUES!$A$2:$A$1000",
            showErrorMessage=True,
            error="Please select a valid charging site",
        )
        site_validator.add("A2:A10000")
        validators.append(site_validator)

        # Allocating Organization validator (Column B)
        org_validator = DataValidation(
            type="list",
            formula1="=VALUES!$B$2:$B$1000",
            showErrorMessage=True,
            error="Please select a valid organization",
        )
        org_validator.add("B2:B10000")
        validators.append(org_validator)

        # Level of Equipment validator (Column F)
        level_validator = DataValidation(
            type="list",
            formula1="=VALUES!$C$2:$C$1000",
            showErrorMessage=True,
            error="Please select a valid level of equipment",
        )
        level_validator.add("F2:F10000")
        validators.append(level_validator)

        # Ports validator (Column G)
        ports_validator = DataValidation(
            type="list",
            formula1="=VALUES!$D$2:$D$1000",
            showErrorMessage=True,
            error="Please select either 'Single port' or 'Dual port'",
        )
        ports_validator.add("G2:G10000")
        validators.append(ports_validator)

        # Build VALUES sheet data (A: Sites, B: Orgs, C: Levels, D: Ports, E: Intended Uses)
        data = [
            site_names,
            org_names,
            level_names,
            ports_options,
            end_use_names,
        ]

        # Determine the maximum length among all columns
        max_length = max((len(options) for options in data), default=0)

        # Build rows ensuring each row has an entry for each column
        rows = [
            [col[i] if i < len(col) else None for col in data]
            for i in range(max_length)
        ]

        builder.add_sheet(
            sheet_name=VALIDATION_SHEETNAME,
            columns=[
                SpreadsheetColumn("Charging Sites", "text"),
                SpreadsheetColumn("Organizations", "text"),
                SpreadsheetColumn("Levels", "text"),
                SpreadsheetColumn("Ports", "text"),
                SpreadsheetColumn("Intended Uses", "text"),
            ],
            rows=rows,
            styles={"bold_headers": True},
            validators=[],
            position=1,
        )

        return validators

    async def load_charging_equipment_data(self, organization_id: int):
        results = await self.repo.get_all_equipment_by_organization_id(organization_id)
        data = []
        for eq in results:
            data.append(
                [
                    eq.charging_site.site_name if eq.charging_site else "",
                    (
                        eq.allocating_organization.name
                        if eq.allocating_organization
                        else ""
                    ),
                    eq.serial_number or "",
                    eq.manufacturer or "",
                    eq.model or "",
                    eq.level_of_equipment.name if eq.level_of_equipment else "",
                    (eq.ports.value if getattr(eq, "ports", None) else ""),
                    ", ".join(use.type for use in getattr(eq, "intended_uses", [])),
                    eq.notes or "",
                ]
            )
        return data
