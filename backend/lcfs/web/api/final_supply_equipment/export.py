import io
from typing import List

from fastapi import Depends
from openpyxl.worksheet.datavalidation import DataValidation
from starlette.responses import StreamingResponse
from lcfs.web.exception.exceptions import DataNotFoundException

from lcfs.db.models import Organization, UserProfile
from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder, SpreadsheetColumn
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.final_supply_equipment.repo import FinalSupplyEquipmentRepository
from lcfs.web.core.decorators import service_handler

FSE_EXPORT_FILENAME = "FSE"
FSE_EXPORT_SHEETNAME = "FSE"
VALIDATION_SHEETNAME = "VALUES"
FSE_EXPORT_COLUMNS = [
    SpreadsheetColumn("Organization", "text"),
    SpreadsheetColumn("Supply from date", "date"),
    SpreadsheetColumn("Supply to date", "date"),
    SpreadsheetColumn("kWh usage", "int"),
    SpreadsheetColumn("Serial #", "text"),
    SpreadsheetColumn("Manufacturer", "text"),
    SpreadsheetColumn("Model", "text"),
    SpreadsheetColumn("Level of equipment", "text"),
    SpreadsheetColumn("Ports", "text"),
    SpreadsheetColumn("Intended use", "text"),
    SpreadsheetColumn("Intended users", "text"),
    SpreadsheetColumn("Street address", "text"),
    SpreadsheetColumn("City", "text"),
    SpreadsheetColumn("Postal code", "text"),
    SpreadsheetColumn("Latitude", "decimal6"),
    SpreadsheetColumn("Longitude", "decimal6"),
    SpreadsheetColumn("Notes", "text"),
]


class FinalSupplyEquipmentExporter:
    def __init__(
        self,
        repo: FinalSupplyEquipmentRepository = Depends(FinalSupplyEquipmentRepository),
        compliance_report_repo: ComplianceReportRepository = Depends(),
    ) -> None:
        self.compliance_report_repo = compliance_report_repo
        self.repo = repo

    @service_handler
    async def export(
        self,
        compliance_report_id: int,
        organization: Organization,
        include_data=True,
    ) -> StreamingResponse:
        """
        Prepares a list of users in a file that is downloadable
        """
        export_format = (
            "xlsx"  # Uses Advanced Excel features, so only use modern format
        )
        compliance_report = (
            await self.compliance_report_repo.get_compliance_report_by_id(
                compliance_report_id
            )
        )
        if not compliance_report:
            raise DataNotFoundException("Compliance report not found.")

        builder = SpreadsheetBuilder(file_format=export_format)

        validators = await self._create_validators(
            compliance_report, organization, builder
        )

        data = []
        if include_data:
            data = await self.load_fse_data(compliance_report_id)

        builder.add_sheet(
            sheet_name=FSE_EXPORT_SHEETNAME,
            columns=FSE_EXPORT_COLUMNS,
            rows=data,
            styles={"bold_headers": True},
            validators=validators,
        )
        file_content = builder.build_spreadsheet()

        compliance_period = compliance_report.compliance_period.description
        filename = f"{FSE_EXPORT_FILENAME}_{organization.name}-{compliance_period}.{export_format}"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=FILE_MEDIA_TYPE[export_format.upper()].value,
            headers=headers,
        )

    async def _create_validators(self, compliance_report, organization, builder):
        validators: List[DataValidation] = []
        table_options = await self.repo.get_fse_options(organization)

        # Select Validators
        org_options = [obj for obj in table_options[4]]
        org_validator = DataValidation(
            type="list",
            formula1="=VALUES!$A$2:$A$10",
        )
        org_validator.add("A2:A10000")
        validators.append(org_validator)

        level_of_equipment_options = [
            obj.name for obj in table_options[1]  # Escape Commas
        ]
        level_of_equipment_validator = DataValidation(
            type="list",
            formula1="=VALUES!$H$2:$H$10",
            error="Please select a valid option from the list",
            showDropDown=False,
            showErrorMessage=True,
        )
        level_of_equipment_validator.add("H2:H10000")
        validators.append(level_of_equipment_validator)

        port_options = [obj for obj in table_options[3]]
        port_validator = DataValidation(
            type="list",
            formula1="=VALUES!$I$2:$I$10",
            error="Please select a valid option from the list",
            showDropDown=False,
            showErrorMessage=True,
        )
        port_validator.add("I2:I10000")
        validators.append(port_validator)

        intended_use_options = [obj.type for obj in table_options[0]]
        intended_use_validator = DataValidation(
            type="list",
            formula1="=VALUES!$J$2:$J$10",
            showDropDown=False,
        )
        intended_use_validator.add("J2:J10000")
        validators.append(intended_use_validator)

        intended_user_options = [obj.type_name for obj in table_options[2]]
        intended_user_validator = DataValidation(
            type="list",
            formula1="=VALUES!$K$2:$K$10",
            showDropDown=False,
        )
        intended_user_validator.add("K2:K10000")
        validators.append(intended_user_validator)

        # Date Validators
        effective_date = compliance_report.compliance_period.effective_date
        expiration_date = compliance_report.compliance_period.expiration_date
        date_validator = DataValidation(
            type="date",
            operator="between",
            # Lower bound of the date range
            formula1=f"DATE({effective_date.year}, {effective_date.month}, {effective_date.day})",
            # Upper bound of the date range
            formula2=f"DATE({expiration_date.year}, {expiration_date.month}, {expiration_date.day})",
            allow_blank=False,
            showErrorMessage=True,
            errorTitle="Invalid Date",
            error=f"Please enter a date that falls within the {compliance_report.compliance_period.description} calendar year.",
        )
        date_validator.add("B2:B10000")
        date_validator.add("C2:C10000")
        validators.append(date_validator)

        # Number Validators
        decimal_validator = DataValidation(
            type="decimal",
            showErrorMessage=True,
            error="Please enter a valid decimal.",
        )
        decimal_validator.add("O2:O10000")
        decimal_validator.add("P2:P10000")
        validators.append(decimal_validator)
        integer_validator = DataValidation(
            type="whole",
            showErrorMessage=True,
            error="Please enter a valid integer.",
        )
        integer_validator.add("D2:D10000")
        validators.append(integer_validator)
        # Postal code validator (Canadian format A1A 1A1)
        postal_code_validator = DataValidation(
            type="custom",
            formula1='=AND(LEN(N2)=7,OR(CODE(MID(N2,1,1))>=65,CODE(MID(N2,1,1))<=90),ISNUMBER(--MID(N2,2,1)),OR(CODE(MID(N2,3,1))>=65,CODE(MID(N2,3,1))<=90),MID(N2,4,1)=" ",ISNUMBER(--MID(N2,5,1)),OR(CODE(MID(N2,6,1))>=65,CODE(MID(N2,6,1))<=90),ISNUMBER(--MID(N2,7,1)))',
            showErrorMessage=True,
            errorTitle="Invalid Postal Code",
            error="Please enter a valid Canadian postal code in the format 'A1A 1A1'",
        )
        postal_code_validator.add("N2:N10000")  # Column N is the postal code column
        validators.append(postal_code_validator)

        # We use a second sheet containing validation values, this allows no character restrictions however it needs to be square
        data = [
            org_options,
            [],
            [],
            [],
            [],
            [],
            [],
            level_of_equipment_options,
            port_options,
            intended_use_options,
            intended_user_options,
            [],
            [],
            [],
            [],
            [],
            [],
        ]

        # Determine the maximum length among all columns
        max_length = max(len(options) for options in data)

        # Build rows ensuring each row has an entry for each column (defaulting to None if missing)
        rows = [
            [col[i] if i < len(col) else None for col in data]
            for i in range(max_length)
        ]

        builder.add_sheet(
            sheet_name=VALIDATION_SHEETNAME,
            columns=FSE_EXPORT_COLUMNS,
            rows=rows,
            styles={"bold_headers": True},
            validators=[],
            position=1,
        )

        return validators

    async def load_fse_data(self, compliance_report_id):
        results = await self.repo.get_fse_paginated(
            compliance_report_id=compliance_report_id,
            pagination=PaginationRequestSchema(
                page=1, size=1000, filters=[], sort_orders=[]
            ),
        )
        data = []
        for final_supply_equipment in results[0]:
            data.append(
                [
                    final_supply_equipment.organization_name,
                    final_supply_equipment.supply_from_date,
                    final_supply_equipment.supply_to_date,
                    final_supply_equipment.kwh_usage,
                    final_supply_equipment.serial_nbr,
                    final_supply_equipment.manufacturer,
                    final_supply_equipment.model,
                    final_supply_equipment.level_of_equipment.name,
                    final_supply_equipment.ports,
                    ", ".join(
                        type.type for type in final_supply_equipment.intended_use_types
                    ),
                    ", ".join(
                        type.type_name
                        for type in final_supply_equipment.intended_user_types
                    ),
                    final_supply_equipment.street_address,
                    final_supply_equipment.city,
                    final_supply_equipment.postal_code,
                    final_supply_equipment.latitude,
                    final_supply_equipment.longitude,
                    final_supply_equipment.notes,
                ]
            )
        return data
