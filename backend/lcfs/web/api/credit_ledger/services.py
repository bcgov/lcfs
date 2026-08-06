import io
from datetime import datetime, timezone, date, time
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
    PeriodLedgerTxnSchema,
    PeriodLedgerTypeTotalSchema,
    PeriodLedgerSchema,
    AssessedBalanceSchema,
)
from .repo import CreditLedgerRepository
from lcfs.db.models.transaction.CreditLedgerView import CreditLedgerView


# Statuses that represent a completed (finalized) transaction per type — these
# are always shown. Mirrors the mv_credit_ledger status gating.
_COMPLETED_STATUSES = {
    "Transfer": {"Recorded"},
    "InitiativeAgreement": {"Approved"},
    "AdminAdjustment": {"Approved"},
    "ComplianceReport": {"Assessed", "Reassessed"},
    "AggregatorIssuance": {"Recorded"},
    "StandaloneTransaction": {"Recorded"},
}

# In-flight statuses that reserve units and only appear when "show pending" is
# on (#4714). Pending compliance reports are not in mv_transaction_aggregate,
# so they surface only once assessed — consistent with the rest of the system.
_PENDING_STATUSES = {
    "Transfer": {"Submitted", "Recommended"},
    "InitiativeAgreement": {"Recommended"},
    "AdminAdjustment": {"Recommended"},
}

# Display order for the Show-totals type groupings (wireframe order); unknown
# types fall to the end alphabetically.
_TYPE_DISPLAY_ORDER = {
    "Transfer": 0,
    "InitiativeAgreement": 1,
    "AdminAdjustment": 2,
    "AggregatorIssuance": 3,
    "ComplianceReport": 4,
    "StandaloneTransaction": 5,
}


def _signed_units_for_org(row, organization_id: int) -> int:
    """Signed compliance units from the organization's perspective: positive =
    units in, negative = units out."""
    if row.transaction_type == "Transfer":
        if row.to_organization_id == organization_id:
            return int(row.quantity or 0)
        if row.from_organization_id == organization_id:
            return -int(row.quantity or 0)
        return 0
    # Non-transfer types are issued toward to_organization_id; quantity is
    # already signed (a compliance report can be negative for a deficit).
    return int(row.quantity or 0)


def _effective_date(row):
    return (
        row.transaction_effective_date
        or row.recorded_date
        or row.approved_date
        or row.create_date
    )


# Display labels and id prefixes, kept in step with the frontend's TYPE_LABELS
# and TRANSACTION_ID_PREFIXES so an exported ledger reads like the screen.
# Legacy transactions carry a raw id with no user-facing prefix.
_TYPE_LABELS = {
    "Transfer": "Transfer",
    "InitiativeAgreement": "Initiative Agreement",
    "AdminAdjustment": "Administrative Adjustment",
    "ComplianceReport": "Compliance Report",
    "AggregatorIssuance": "Aggregator Issuance",
    "StandaloneTransaction": "Legacy Transaction",
}

_TYPE_ID_PREFIXES = {
    "Transfer": "CT",
    "AdminAdjustment": "AA",
    "InitiativeAgreement": "IA",
    "ComplianceReport": "CR",
    "AggregatorIssuance": "AG",
}


def _display_transaction_id(transaction_type: str, transaction_id: int) -> str:
    return f"{_TYPE_ID_PREFIXES.get(transaction_type, '')}{transaction_id}"


def _export_date(value) -> Optional[date]:
    """
    Reduce an effective date to a plain date for the spreadsheet.

    openpyxl rejects tz-aware datetimes outright ("Excel does not support
    datetimes with timezones"), and the aggregate view emits a mix of date,
    naive and tz-aware values — so writing them through untouched fails the
    whole export for any organization that happens to have one. The ledger
    displays a date only, so nothing is lost by dropping the time.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def _display_transaction_type(transaction_type: str, description: Optional[str]) -> str:
    label = _TYPE_LABELS.get(transaction_type, transaction_type)
    if transaction_type == "ComplianceReport" and description:
        return f"{label} - {description}"
    return label


def compliance_year_envelope(
    compliance_period: int, first_assessed_year: Optional[int] = None
) -> tuple[date, date]:
    """
    Date range a compliance year's ledger covers (#4832).

    A compliance year runs April 1 through March 31 of the following year,
    matching the reporting period rather than the calendar year. The earliest
    year the organization has an assessed report for opens on January 1
    instead: there is no earlier envelope to hold that January–March, so
    without this those transactions would fall out of the ledger entirely.
    """
    start_month, start_day = (
        (1, 1) if compliance_period == first_assessed_year else (4, 1)
    )
    return (
        date(compliance_period, start_month, start_day),
        date(compliance_period + 1, 3, 31),
    )


def _sort_key_datetime(value) -> datetime:
    """Normalize a date/datetime (tz-aware or naive) to a naive datetime so the
    aggregate's mixed effective-date types can be ordered together (real data
    mixes ``date`` and tz-aware/naive ``datetime``)."""
    if value is None:
        return datetime.min
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, date):
        return datetime.combine(value, time.min)
    return datetime.min


class CreditLedgerService:
    def __init__(self, repo: CreditLedgerRepository = Depends()) -> None:
        self.repo = repo

    def _apply_filters(
        self, pagination: PaginationRequestSchema, conditions: List[any]
    ) -> None:
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

        # Transform rows with compliance report version (e.g., "Original", "Supplemental 1")
        ledger_items = []
        for row in rows:
            ledger_view, version = row
            # Create schema from the ledger view
            item = CreditLedgerTxnSchema.model_validate(ledger_view)

            # Add formatted description for compliance reports
            if (
                ledger_view.transaction_type == "ComplianceReport"
                and version is not None
            ):
                item.description = (
                    "Original" if version == 0 else f"Supplemental {version}"
                )

            ledger_items.append(item)

        return CreditLedgerListSchema(
            ledger=ledger_items,
            pagination=PaginationResponseSchema(
                total=total,
                page=pagination.page,
                size=pagination.size,
                total_pages=ceil(total / pagination.size) or 1,
            ),
        )

    @service_handler
    async def get_period_ledger(
        self,
        *,
        organization_id: int,
        compliance_period: int,
        include_pending: bool = False,
    ) -> PeriodLedgerSchema:
        """
        Build the compliance-period credit ledger for one organization (#4714):
        completed transactions (optionally plus in-flight pending ones), a
        per-period running balance, totals grouped by transaction type, and the
        previous/current compliance-year assessed balances.
        """
        first_assessed_year = await self.repo.get_first_assessed_year(
            organization_id=organization_id,
        )
        envelope_start, envelope_end = compliance_year_envelope(
            compliance_period, first_assessed_year
        )
        rows = await self.repo.get_period_rows(
            organization_id=organization_id,
            compliance_period=compliance_period,
            envelope_start=envelope_start,
            envelope_end=envelope_end,
        )

        # 1. Keep only rows whose status is completed (always) or, when
        #    requested, pending for their type.
        selected = []
        for ledger_view, version in rows:
            ttype = ledger_view.transaction_type
            status = ledger_view.status
            completed = status in _COMPLETED_STATUSES.get(ttype, set())
            pending = status in _PENDING_STATUSES.get(ttype, set())
            if completed or (include_pending and pending):
                selected.append((ledger_view, version, not completed and pending))

        # 2. Sort chronologically (ascending effective date) so the running
        #    balance accumulates from the start of the period. A stable
        #    transaction_id tiebreaker keeps same-day rows deterministic.
        selected.sort(
            key=lambda t: (
                _sort_key_datetime(_effective_date(t[0])),
                t[0].transaction_id,
            )
        )

        # 3. Build transaction rows with signed units + running balance.
        transactions: List[PeriodLedgerTxnSchema] = []
        running = 0
        for ledger_view, version, is_pending in selected:
            signed = _signed_units_for_org(ledger_view, organization_id)
            running += signed

            description = None
            if (
                ledger_view.transaction_type == "ComplianceReport"
                and version is not None
            ):
                description = "Original" if version == 0 else f"Supplemental {version}"

            transactions.append(
                PeriodLedgerTxnSchema(
                    transaction_id=ledger_view.transaction_id,
                    transaction_type=ledger_view.transaction_type,
                    description=description,
                    effective_date=_effective_date(ledger_view),
                    units_in=signed if signed > 0 else 0,
                    units_out=-signed if signed < 0 else 0,
                    running_balance=running,
                    status=ledger_view.status,
                    is_pending=is_pending,
                )
            )

        # 4. Totals grouped by transaction type.
        totals_map: dict[str, list[int]] = {}
        for txn in transactions:
            entry = totals_map.setdefault(txn.transaction_type, [0, 0])
            entry[0] += txn.units_in
            entry[1] += txn.units_out
        totals_by_type = [
            PeriodLedgerTypeTotalSchema(
                transaction_type=ttype,
                units_in=units_in,
                units_out=units_out,
                net=units_in - units_out,
            )
            for ttype, (units_in, units_out) in sorted(
                totals_map.items(),
                key=lambda kv: (_TYPE_DISPLAY_ORDER.get(kv[0], 99), kv[0]),
            )
        ]
        total_units_in = sum(t.units_in for t in totals_by_type)
        total_units_out = sum(t.units_out for t in totals_by_type)

        # 5. Assessed balances, taken straight from Line 22 of the most recent
        #    assessed report for each year (#4831). A year with no assessed
        #    report has no assessed balance — None, not zero, so the UI leaves
        #    it blank rather than implying the org ended the year at nil.
        current_balance = await self.repo.get_assessed_line_22(
            organization_id=organization_id,
            compliance_period=compliance_period,
        )
        previous_balance = await self.repo.get_assessed_line_22(
            organization_id=organization_id,
            compliance_period=compliance_period - 1,
        )

        return PeriodLedgerSchema(
            organization_id=organization_id,
            compliance_period=compliance_period,
            include_pending=include_pending,
            transactions=transactions,
            totals_by_type=totals_by_type,
            total_units_in=total_units_in,
            total_units_out=total_units_out,
            total_net=total_units_in - total_units_out,
            assessed_balance=AssessedBalanceSchema(
                previous_year=compliance_period - 1,
                previous_balance=previous_balance,
                current_year=compliance_period,
                current_balance=current_balance,
            ),
        )

    @service_handler
    async def export_period_ledger(
        self,
        *,
        organization_id: int,
        compliance_year: int,
        include_pending: bool = False,
        export_format: str = "xlsx",
    ) -> StreamingResponse:
        """
        Excel/CSV export of one compliance-period ledger (#4832).

        Built from ``get_period_ledger`` rather than querying separately, so the
        download is exactly what the screen shows — same April–March envelope,
        same rows, same running balance. Anything that changes the ledger changes
        the export with it.
        """
        if export_format not in ["xls", "xlsx", "csv"]:
            raise ValueError("Export format not supported")

        ledger = await self.get_period_ledger(
            organization_id=organization_id,
            compliance_period=compliance_year,
            include_pending=include_pending,
        )

        sheet_rows = [
            [
                _display_transaction_id(txn.transaction_type, txn.transaction_id),
                _export_date(txn.effective_date),
                _display_transaction_type(txn.transaction_type, txn.description),
                txn.units_in,
                txn.units_out,
                txn.running_balance,
            ]
            for txn in ledger.transactions
        ]

        builder = SpreadsheetBuilder(file_format=export_format)
        builder.add_sheet(
            sheet_name=LCFS_Constants.CREDIT_LEDGER_EXPORT_SHEETNAME,
            columns=LCFS_Constants.CREDIT_LEDGER_PERIOD_EXPORT_COLUMNS,
            rows=sheet_rows,
            styles={"bold_headers": True},
        )
        file_content: bytes = builder.build_spreadsheet()

        filename = (
            f"{LCFS_Constants.CREDIT_LEDGER_EXPORT_FILENAME}"
            f"-org{organization_id}-{compliance_year}.{export_format}"
        )

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=FILE_MEDIA_TYPE[export_format.upper()].value,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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

        sheet_rows = []
        for row in rows:
            ledger_view, version = row

            # Format transaction type with version for compliance reports
            transaction_type = ledger_view.transaction_type
            if transaction_type == "ComplianceReport" and version is not None:
                # Format as "Original", "Supplemental 1", etc.
                description = "Original" if version == 0 else f"Supplemental {version}"
                transaction_type = f"Compliance Report – {description}"
            elif transaction_type == "StandaloneTransaction":
                transaction_type = "Legacy Transaction"
            else:
                # Add spaces to camelCase
                transaction_type = "".join(
                    [" " + c if c.isupper() else c for c in transaction_type]
                ).strip()

            sheet_rows.append(
                [
                    int(ledger_view.compliance_period),
                    int(ledger_view.available_balance or 0),
                    int(ledger_view.compliance_units or 0),
                    transaction_type,
                    ledger_view.update_date.strftime("%Y-%m-%d"),
                ]
            )

        builder = SpreadsheetBuilder(file_format=export_format)
        builder.add_sheet(
            sheet_name=LCFS_Constants.CREDIT_LEDGER_EXPORT_SHEETNAME,
            columns=LCFS_Constants.CREDIT_LEDGER_EXPORT_COLUMNS,
            rows=sheet_rows,
            styles={"bold_headers": True},
        )
        file_content: bytes = builder.build_spreadsheet()

        date_stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        filename = (
            f"{LCFS_Constants.CREDIT_LEDGER_EXPORT_FILENAME}"
            f"-org{organization_id}-{date_stamp}.{export_format}"
        )

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=FILE_MEDIA_TYPE[export_format.upper()].value,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
