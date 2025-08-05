import io
from datetime import datetime
from math import ceil
from typing import Optional, List

from fastapi import Depends
from fastapi.responses import StreamingResponse

from lcfs.utils.constants import LCFS_Constants, FILE_MEDIA_TYPE
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    validate_pagination,
    get_field_for_filter,
    apply_filter_conditions,
    SortOrder,
)
from .schema import (
    CreditLedgerTxnSchema,
    CreditLedgerListSchema,
)
from .repo import CreditLedgerRepository
from lcfs.db.models.transaction.CreditLedgerView import CreditLedgerView


class CreditLedgerService:
    def __init__(self, repo: CreditLedgerRepository = Depends()) -> None:
        self.repo = repo

    def _apply_filters(self, pagination: PaginationRequestSchema, conditions: List[any]) -> None:
        for f in pagination.filters:
            field = get_field_for_filter(CreditLedgerView, f.field)
            filter_val = f.filter
            conditions.append(
                apply_filter_conditions(field, filter_val, f.type, f.filter_type)
            )

    @service_handler
    async def get_ledger_paginated(
        self,
        *,
        organization_id: int,
        pagination: PaginationRequestSchema,
    ) -> CreditLedgerListSchema:

        pagination = validate_pagination(pagination)

        conditions: List[any] = [CreditLedgerView.organization_id == organization_id]

        if pagination.filters:
            self._apply_filters(pagination, conditions)

        offset = (pagination.page - 1) * pagination.size
        limit = pagination.size

        rows, total = await self.repo.get_rows_paginated(
            offset=offset,
            limit=limit,
            conditions=conditions,
            sort_orders=pagination.sort_orders,
        )

        return CreditLedgerListSchema(
            ledger=[CreditLedgerTxnSchema.model_validate(r) for r in rows],
            pagination=PaginationResponseSchema(
                total=total,
                page=pagination.page,
                size=pagination.size,
                total_pages=ceil(total / pagination.size) or 1,
            ),
        )

    @service_handler
    async def get_organization_years(
        self,
        *,
        organization_id: int,
    ) -> List[str]:
        """
        Get distinct compliance years that have ledger data for an organization.
        Returns years sorted in descending order.
        """
        return await self.repo.get_distinct_years(organization_id=organization_id)

    @service_handler
    async def export_transactions(
        self,
        *,
        organization_id: int,
        compliance_year: Optional[int],
        export_format: str = "xlsx",
    ) -> StreamingResponse:
        """
        Prepare an Excel/CSV export of the full ledger for an organisation.
        """
        if export_format not in ["xls", "xlsx", "csv"]:
            raise ValueError("Export format not supported")

        conditions: List[any] = [CreditLedgerView.organization_id == organization_id]
        if compliance_year:
            conditions.append(
                CreditLedgerView.compliance_period == str(compliance_year)
            )

        sort_orders = [SortOrder(field="update_date", direction="desc")]

        rows, _ = await self.repo.get_rows_paginated(
            offset=0,
            limit=None,
            conditions=conditions,
            sort_orders=sort_orders,
        )

        sheet_rows = [
            [
                int(r.compliance_period),
                int(r.available_balance or 0),
                int(r.compliance_units or 0),
                r.transaction_type,
                r.update_date.strftime("%Y-%m-%d"),
            ]
            for r in rows
        ]

        builder = SpreadsheetBuilder(file_format=export_format)
        builder.add_sheet(
            sheet_name=LCFS_Constants.CREDIT_LEDGER_EXPORT_SHEETNAME,
            columns=LCFS_Constants.CREDIT_LEDGER_EXPORT_COLUMNS,
            rows=sheet_rows,
            styles={"bold_headers": True},
        )
        file_content: bytes = builder.build_spreadsheet()

        date_stamp = datetime.now().strftime("%Y-%m-%d")
        filename = (
            f"{LCFS_Constants.CREDIT_LEDGER_EXPORT_FILENAME}"
            f"-org{organization_id}-{date_stamp}.{export_format}"
        )

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=FILE_MEDIA_TYPE[export_format.upper()].value,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
