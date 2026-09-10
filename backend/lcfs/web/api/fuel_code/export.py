import io
from datetime import date, datetime, timezone
from typing import Any, Sequence

from fastapi import Depends
from starlette.responses import StreamingResponse

from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder, SpreadsheetColumn
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException


FUEL_CODE_EXPORT_FILENAME = "BC-LCFS-Fuel-Codes"
FUEL_CODE_EXPORT_SHEETNAME = "Fuel codes"
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
    SpreadsheetColumn("Co-processed", "text"),
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


def _format_transport_modes(values: Sequence[Any] | None) -> str:
    """
    Render transport modes the way the fuel code grid does: ``Truck (125 km)``.

    ``FuelCodeRepository.get_fuel_codes_paginated`` returns each mode as a
    ``{"transport_mode", "distance"}`` dict when a distance is recorded and
    falls back to the view's plain list of mode names otherwise.
    """
    labels = []
    for item in values or []:
        if isinstance(item, dict):
            mode = item.get("transport_mode")
            distance = item.get("distance")
        else:
            mode, distance = item, None
        if not mode:
            continue
        labels.append(f"{mode} ({distance} km)" if distance is not None else str(mode))
    return ", ".join(labels)


class FuelCodeExporter:
    def __init__(self, repo: FuelCodeRepository = Depends(FuelCodeRepository)) -> None:
        self.repo = repo

    @service_handler
    async def export(
        self,
        export_format: str,
        pagination: PaginationRequestSchema | None = None,
        exclude_archived: bool = False,
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

        # Ignore client-side paging but preserve sorting
        pagination.page, pagination.size = 1, 10000

        compliance_period_start = None
        if exclude_archived:
            today = date.today()
            anchor = date(today.year, 3, 31)
            compliance_period_start = (
                anchor if today >= anchor else date(today.year - 1, 3, 31)
            )

        results = await self.repo.get_fuel_codes_paginated(
            pagination,
            exclude_archived=exclude_archived,
            compliance_period_start=compliance_period_start,
        )

        # Prepare data for the spreadsheet. The repo returns plain dicts (see
        # FuelCodeRepository._with_transport_mode_distances), not ORM rows.
        data = []
        for fuel_code in results[0]:
            data.append(
                [
                    fuel_code.get("status"),
                    fuel_code.get("prefix"),
                    fuel_code.get("fuel_suffix"),
                    fuel_code.get("carbon_intensity"),
                    fuel_code.get("edrms"),
                    fuel_code.get("company"),
                    fuel_code.get("contact_name"),
                    fuel_code.get("contact_email"),
                    fuel_code.get("application_date"),
                    fuel_code.get("approval_date"),
                    fuel_code.get("effective_date"),
                    fuel_code.get("expiration_date"),
                    fuel_code.get("fuel_type"),
                    fuel_code.get("feedstock"),
                    fuel_code.get("feedstock_location"),
                    fuel_code.get("feedstock_misc"),
                    fuel_code.get("co_processed"),
                    fuel_code.get("fuel_production_facility_city"),
                    fuel_code.get("fuel_production_facility_province_state"),
                    fuel_code.get("fuel_production_facility_country"),
                    fuel_code.get("facility_nameplate_capacity"),
                    fuel_code.get("facility_nameplate_capacity_unit"),
                    _format_transport_modes(
                        fuel_code.get("feedstock_fuel_transport_modes")
                    ),
                    _format_transport_modes(
                        fuel_code.get("finished_fuel_transport_modes")
                    ),
                    fuel_code.get("former_company"),
                    fuel_code.get("notes"),
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
        current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        filename = f"{FUEL_CODE_EXPORT_FILENAME}-{current_date}.{export_format}"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=FILE_MEDIA_TYPE[export_format.upper()].value,
            headers=headers,
        )
