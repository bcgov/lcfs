import io
from typing import List

from fastapi import Depends
from openpyxl.worksheet.datavalidation import DataValidation
from starlette.responses import StreamingResponse

from lcfs.db.models import Organization, UserProfile
from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder, SpreadsheetColumn
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository
from lcfs.web.core.decorators import service_handler

ALLOCATION_EXPORT_FILENAME = "AllocationAgreements"
ALLOCATION_SHEETNAME = "Allocation Agreements"
VALIDATION_SHEETNAME = "VALUES"
ALLOCATION_EXPORT_COLUMNS = [
    SpreadsheetColumn("Responsibility", "text"),
    SpreadsheetColumn("Legal name of transaction partner", "text"),
    SpreadsheetColumn("Address for service", "text"),
    SpreadsheetColumn("Email", "text"),
    SpreadsheetColumn("Phone", "text"),
    SpreadsheetColumn("Fuel type", "text"),
    SpreadsheetColumn("Fuel type other", "text"),
    SpreadsheetColumn("Fuel category", "text"),
    SpreadsheetColumn("Determining Carbon Intensity", "text"),
    SpreadsheetColumn("Fuel code", "text"),
    SpreadsheetColumn("Quantity", "int"),
]


class AllocationAgreementExporter:
    def __init__(
        self,
        repo: AllocationAgreementRepository = Depends(AllocationAgreementRepository),
        compliance_report_services: ComplianceReportServices = Depends(
            ComplianceReportServices
        ),
    ) -> None:
        self.compliance_report_services = compliance_report_services
        self.repo = repo

    @service_handler
    async def export(
        self,
        compliance_report_id: int,
        user: UserProfile,
        organization: Organization,
        include_data: bool = True,
    ) -> StreamingResponse:
        """
        Exports an Excel file containing Allocation Agreement rows for a given report.
        If include_data=False, we only provide column headers (a blank template).
        """
        export_format = (
            "xlsx"  # Uses Advanced Excel features, so only use modern format
        )
        compliance_report = (
            await self.compliance_report_services.get_compliance_report_by_id(
                report_id=compliance_report_id,
                user=user,
            )
        )

        # Create a spreadsheet
        builder = SpreadsheetBuilder(file_format=export_format)

        validators = await self._create_validators(
            compliance_report, organization, builder
        )

        data = []
        if include_data:
            data = await self.load_allocation_data(compliance_report_id)

        builder.add_sheet(
            sheet_name=ALLOCATION_SHEETNAME,
            columns=ALLOCATION_EXPORT_COLUMNS,
            rows=data,
            styles={"bold_headers": True},
            validators=validators,
        )
        file_content = builder.build_spreadsheet()

        compliance_period = compliance_report.compliance_period.description
        filename = f"{ALLOCATION_EXPORT_FILENAME}_{organization.name}-{compliance_period}.{export_format}"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=FILE_MEDIA_TYPE[export_format.upper()].value,
            headers=headers,
        )

    async def _create_validators(self, compliance_report, organization, builder):
        validators: List[DataValidation] = []

        # Fetch table options
        table_options = await self.repo.get_table_options(
            compliance_report.compliance_period.description
        )

        # Prepare enumerated column lists
        allocation_transaction_types = table_options.get(
            "allocation_transaction_types", []
        )
        allocation_transaction_type_options = [
            obj.type for obj in allocation_transaction_types
        ]

        fuel_types = table_options.get("fuel_types", [])
        fuel_type_options = [obj["fuel_type"] for obj in fuel_types]

        fuel_categories = table_options.get("fuel_categories", [])
        fuel_category_options = [obj.category for obj in fuel_categories]

        provisions_of_the_act = table_options.get("provisions_of_the_act", [])
        provisions_of_the_act_options = [obj.name for obj in provisions_of_the_act]

        # Prepare data for the "VALUES" sheet:
        data = [
            allocation_transaction_type_options,  # Responsibility
            [],
            [],
            [],
            [],
            fuel_type_options,  # Fuel type
            [],
            fuel_category_options,  # Fuel category
            provisions_of_the_act_options,  # Determining Carbon Intensity
            [],
            [],
        ]

        # Determine the maximum length among all columns
        max_length = max(len(options) for options in data) if data else 0

        # Build rows with default None for missing entries
        rows = [
            [col[i] if i < len(col) else None for col in data]
            for i in range(max_length)
        ]

        builder.add_sheet(
            sheet_name=VALIDATION_SHEETNAME,
            columns=ALLOCATION_EXPORT_COLUMNS,
            rows=rows,
            styles={"bold_headers": True},
            validators=[],
            position=1,
        )

        # Determines range end based on max_length.
        def range_end(idx):
            return len(idx) + 1 if idx else 10

        # Add select validator to the columns
        def add_select_validator(
            column_letter,
            options_list,
            error_msg,
            row_start=2,
            row_end=1048576,
        ):
            dv = DataValidation(
                type="list",
                formula1=f"={VALIDATION_SHEETNAME}!${column_letter}$2:${column_letter}${range_end(options_list)}",
                error=error_msg,
                showDropDown=False,
                showErrorMessage=True,
            )
            dv.add(f"{column_letter}{row_start}:{column_letter}{row_end}")
            validators.append(dv)
            return dv

        # Add select validation to the columns
        add_select_validator(
            "A",
            allocation_transaction_type_options,
            "Please select a valid responsibility",
        )
        add_select_validator("F", fuel_type_options, "Please select a valid fuel type")
        add_select_validator(
            "H", fuel_category_options, "Please select a valid fuel category"
        )
        add_select_validator(
            "I",
            provisions_of_the_act_options,
            "Please select a valid derminging carbon intensity",
        )

        # Add an integer validator for Quantity
        dv_int_quantity = DataValidation(
            type="whole",
            showErrorMessage=True,
            error="Please enter a valid integer for Quantity",
        )
        dv_int_quantity.add("K2:K1048576")
        validators.append(dv_int_quantity)

        # 8) Add a custom email validator for Email
        email_validator = DataValidation(
            type="custom",
            formula1='=AND(ISNUMBER(SEARCH("@",D2)),ISNUMBER(SEARCH(".",D2,SEARCH("@",D2)+2)))',
            showErrorMessage=True,
            errorTitle="Invalid Email",
            error="Please enter a valid email address",
        )
        email_validator.add("D2:D1048576")
        validators.append(email_validator)

        return validators

    async def load_allocation_data(self, compliance_report_id: int):
        allocation_rows = await self.repo.get_allocation_agreements(
            compliance_report_id,
        )

        data = []
        for aa in allocation_rows:
            data.append(
                [
                    aa.allocation_transaction_type,
                    aa.transaction_partner,
                    aa.postal_address,
                    aa.transaction_partner_email,
                    aa.transaction_partner_phone,
                    aa.fuel_type,
                    aa.fuel_type_other,
                    aa.fuel_category,
                    aa.provision_of_the_act,
                    aa.fuel_code,
                    aa.quantity,
                ]
            )
        return data
