import io
from datetime import datetime

from fastapi import Depends
from starlette.responses import StreamingResponse

from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder, SpreadsheetColumn
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException


FUEL_CODE_EXPORT_FILENAME = "BC-LCFS-Fuel-Codes"
FUEL_CODE_EXPORT_SHEETNAME = "Fuel Codes"
FUEL_CODE_EXPORT_COLUMNS = [
    SpreadsheetColumn("Status", "text"),
    SpreadsheetColumn("Prefix", "text"),
    SpreadsheetColumn("Fuel code", "text"),
    SpreadsheetColumn("Carbon intensity", "text"),
    SpreadsheetColumn("EDRMS#", "text"),
    SpreadsheetColumn("Company", "text"),
    SpreadsheetColumn("Contact name", "text"),
    SpreadsheetColumn("Contact email", "text"),
    SpreadsheetColumn("Application date", "date"),
    SpreadsheetColumn("Approval date", "date"),
    SpreadsheetColumn("Effective date", "date"),
    SpreadsheetColumn("Expiry date", "date"),
    SpreadsheetColumn("Fuel", "text"),
    SpreadsheetColumn("Feedstock", "text"),
    SpreadsheetColumn("Feedstock location", "text"),
    SpreadsheetColumn("Misc", "text"),
    SpreadsheetColumn("Fuel production facility city", "text"),
    SpreadsheetColumn("Fuel production facility province/state", "text"),
    SpreadsheetColumn("Fuel production facility country", "text"),
    SpreadsheetColumn("Facility nameplate capacity", "text"),
    SpreadsheetColumn("Unit", "text"),
    SpreadsheetColumn("Feedstock transport mode", "text"),
    SpreadsheetColumn("Finished fuel transport mode", "text"),
    SpreadsheetColumn("Former company", "text"),
    SpreadsheetColumn("Notes", "text"),
]


class FuelCodeExporter:
    def __init__(self, repo: FuelCodeRepository = Depends(FuelCodeRepository)) -> None:
        self.repo = repo

    @service_handler
    async def export(
        self,
        export_format: str,
        pagination: PaginationRequestSchema | None = None,
    ) -> StreamingResponse:
        """
        Prepares a list of users in a file that is downloadable
        """
        if not export_format in ["xls", "xlsx", "csv"]:
            raise DataNotFoundException("Export format not supported")

        # Normalise incoming pagination
        pagination = pagination or PaginationRequestSchema(
            page=1, size=10000, filters=[], sort_orders=[]
        )

        # Ignore client-side paging & sorting
        pagination.page, pagination.size, pagination.sort_orders = 1, 10000, []

        results = await self.repo.get_fuel_codes_paginated(pagination)

        # Prepare data for the spreadsheet
        data = []
        for fuel_code in results[0]:
            data.append(
                [
                    fuel_code.fuel_code_status.status.value,
                    fuel_code.fuel_code_prefix.prefix,
                    fuel_code.fuel_suffix,
                    fuel_code.carbon_intensity,
                    fuel_code.edrms,
                    fuel_code.company,
                    fuel_code.contact_name,
                    fuel_code.contact_email,
                    fuel_code.application_date,
                    fuel_code.approval_date,
                    fuel_code.effective_date,
                    fuel_code.expiration_date,
                    fuel_code.fuel_type.fuel_type,
                    fuel_code.feedstock,
                    fuel_code.feedstock_location,
                    fuel_code.feedstock_misc,
                    fuel_code.fuel_production_facility_city,
                    fuel_code.fuel_production_facility_province_state,
                    fuel_code.fuel_production_facility_country,
                    fuel_code.facility_nameplate_capacity,
                    (
                        fuel_code.facility_nameplate_capacity_unit.value
                        if fuel_code.facility_nameplate_capacity_unit
                        else None
                    ),
                    ", ".join(
                        mode.feedstock_fuel_transport_mode.transport_mode
                        for mode in fuel_code.feedstock_fuel_transport_modes
                    ),
                    ", ".join(
                        mode.finished_fuel_transport_mode.transport_mode
                        for mode in fuel_code.finished_fuel_transport_modes
                    ),
                    fuel_code.former_company,
                    fuel_code.notes,
                ]
            )

        # Create a spreadsheet
        builder = SpreadsheetBuilder(file_format=export_format)

        builder.add_sheet(
            sheet_name=FUEL_CODE_EXPORT_SHEETNAME,
            columns=FUEL_CODE_EXPORT_COLUMNS,
            rows=data,
            styles={"bold_headers": True},
        )

        file_content = builder.build_spreadsheet()

        # Get the current date in YYYY-MM-DD format
        current_date = datetime.now().strftime("%Y-%m-%d")

        filename = f"{FUEL_CODE_EXPORT_FILENAME}-{current_date}.{export_format}"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=FILE_MEDIA_TYPE[export_format.upper()].value,
            headers=headers,
        )
