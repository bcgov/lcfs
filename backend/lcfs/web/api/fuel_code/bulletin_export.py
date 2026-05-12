import io
from datetime import date, datetime, timezone

from fastapi import Depends
from starlette.responses import StreamingResponse

from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder, SpreadsheetColumn
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException


FUEL_CODE_BULLETIN_EXPORT_COLUMNS = [
    SpreadsheetColumn("Fuel Code", "text"),
    SpreadsheetColumn("Fuel", "text"),
    SpreadsheetColumn("Company", "text"),
    SpreadsheetColumn("Carbon Intensity (gCO2e/MJ)", "float"),
    SpreadsheetColumn("Effective Date", "date"),
    SpreadsheetColumn("Expiry Date", "date"),
]

FUEL_CODE_BULLETIN_SHEET_NAMES = {
    "current": "Current Fuel Codes",
    "archived": "Archived Fuel Codes",
}

FUEL_CODE_BULLETIN_FILE_PREFIXES = {
    "current": "BC-LCFS-Current-Fuel-Codes",
    "archived": "BC-LCFS-Archived-Fuel-Codes",
}


class FuelCodeBulletinExporter:
    def __init__(self, repo: FuelCodeRepository = Depends(FuelCodeRepository)) -> None:
        self.repo = repo

    def _get_compliance_period_start(self, today: date) -> date:
        period_anchor_this_year = date(today.year, 3, 31)
        return period_anchor_this_year if today >= period_anchor_this_year else date(
            today.year - 1, 3, 31
        )

    @service_handler
    async def export(
        self,
        bulletin_type: str,
        export_format: str,
        pagination: PaginationRequestSchema | None = None,
    ) -> StreamingResponse:
        if export_format not in ["xls", "xlsx", "csv"]:
            raise DataNotFoundException("Export format not supported")

        if bulletin_type not in FUEL_CODE_BULLETIN_SHEET_NAMES:
            raise DataNotFoundException("Bulletin type not supported")

        pagination = pagination or PaginationRequestSchema(
            page=1, size=25, filters=[], sort_orders=[]
        )

        period_start = self._get_compliance_period_start(date.today())
        conditions, sort_orders = self.repo.get_fuel_code_bulletin_pagination_params(
            pagination
        )
        rows, _ = await self.repo.get_fuel_code_bulletin_rows(
            compliance_period_start=period_start,
            bulletin_type=bulletin_type,
            offset=0,
            limit=None,
            conditions=conditions,
            sort_orders=sort_orders,
        )

        spreadsheet_rows = [
            [
                row["fuel_code"],
                row["fuel"],
                row["company"],
                row["carbon_intensity"],
                row["effective_date"],
                row["expiry_date"],
            ]
            for row in rows
        ]

        builder = SpreadsheetBuilder(file_format=export_format)
        builder.add_sheet(
            sheet_name=FUEL_CODE_BULLETIN_SHEET_NAMES[bulletin_type],
            columns=FUEL_CODE_BULLETIN_EXPORT_COLUMNS,
            rows=spreadsheet_rows,
            styles={"bold_headers": True},
        )

        file_content = builder.build_spreadsheet()
        current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        filename = (
            f"{FUEL_CODE_BULLETIN_FILE_PREFIXES[bulletin_type]}-"
            f"{current_date}.{export_format}"
        )
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=FILE_MEDIA_TYPE[export_format.upper()].value,
            headers=headers,
        )
