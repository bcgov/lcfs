import zoneinfo
from datetime import datetime
from typing import Optional, List

import structlog
from fastapi import Depends
from sqlalchemy import func, select, and_, or_, desc, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.db.models.transaction.CreditLedgerView import CreditLedgerView
from lcfs.db.models.transaction.TransactionView import TransactionView
from lcfs.db.models.transaction.Transaction import Transaction, TransactionActionEnum
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport

log = structlog.get_logger(__name__)

_VANCOUVER_TZ = zoneinfo.ZoneInfo("America/Vancouver")


class CreditLedgerRepository:

    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
    ):
        self.db = db

    @repo_handler
    async def get_rows_paginated(
        self,
        *,
        offset: int,
        limit: Optional[int],
        conditions: List[any],
        sort_orders: List[any],
    ) -> tuple[List[tuple], int]:
        stmt = (
            select(
                CreditLedgerView,
                ComplianceReport.version.label("compliance_report_version"),
                func.count().over().label("_wf_total"),
            )
            .outerjoin(
                ComplianceReport,
                and_(
                    CreditLedgerView.transaction_id
                    == ComplianceReport.compliance_report_id,
                    CreditLedgerView.transaction_type == "ComplianceReport",
                ),
            )
            .where(and_(*conditions))
            .order_by(CreditLedgerView.update_date.desc())
            .offset(offset)
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        all_rows = result.all()
        total = all_rows[0]._wf_total if all_rows else 0
        # Strip _wf_total so callers can still unpack as (ledger_view, version)
        rows = [(row[0], row[1]) for row in all_rows]
        return rows, total

    @repo_handler
    async def get_distinct_years(
        self,
        *,
        organization_id: int,
    ) -> List[str]:
        """
        Get distinct compliance years that have data for the organization.
        Returns years sorted in descending order.
        """
        stmt = (
            select(distinct(CreditLedgerView.compliance_period))
            .where(CreditLedgerView.organization_id == organization_id)
            .where(CreditLedgerView.compliance_period.isnot(None))
            .order_by(desc(CreditLedgerView.compliance_period))
        )

        result = await self.db.execute(stmt)
        years = result.scalars().all()
        return [str(year) for year in years if year]

    @repo_handler
    async def get_period_rows(
        self,
        *,
        organization_id: int,
        compliance_period: int,
    ) -> List[tuple]:
        """
        Fetch every transaction-aggregate row involving this organization within
        a single compliance period, regardless of status. Status filtering,
        signed-unit derivation, running balance and totals are handled in the
        service so completed/pending selection stays a pure application concern.

        Returns rows as ``(TransactionView, compliance_report_version)`` tuples.
        """
        stmt = (
            select(
                TransactionView,
                ComplianceReport.version.label("compliance_report_version"),
            )
            .outerjoin(
                ComplianceReport,
                and_(
                    TransactionView.transaction_id
                    == ComplianceReport.compliance_report_id,
                    TransactionView.transaction_type == "ComplianceReport",
                ),
            )
            .where(
                or_(
                    TransactionView.compliance_period == str(compliance_period),
                    # Pending transfers carry no compliance period ("N/A") until
                    # recorded, so fall back to the transaction's effective-date
                    # year — otherwise "show pending" could never surface them
                    # in a period (#4714).
                    and_(
                        TransactionView.compliance_period.op("!~")("^[0-9]{4}$"),
                        func.extract(
                            "year", TransactionView.transaction_effective_date
                        )
                        == compliance_period,
                    ),
                ),
                or_(
                    TransactionView.from_organization_id == organization_id,
                    TransactionView.to_organization_id == organization_id,
                ),
            )
        )
        result = await self.db.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]

    @repo_handler
    async def get_period_assessed_balance(
        self,
        *,
        organization_id: int,
        compliance_period: int,
    ) -> int:
        """
        Raw (not floored) credit balance for an organization as of a compliance
        year's assessment cut-off (March 31 of the following year, Vancouver
        time), mirroring ``calculate_available_balance_for_period`` but WITHOUT
        the ``max(…, 0)`` floor so an assessed/carried-forward deficit surfaces
        as a negative value for the ledger's assessed-balance section (#4714).
        """
        period_end = datetime.strptime(
            f"{compliance_period + 1}-03-31", "%Y-%m-%d"
        ).replace(
            hour=23,
            minute=59,
            second=59,
            microsecond=999999,
            tzinfo=_VANCOUVER_TZ,
        )
        balance = await self.db.scalar(
            select(func.coalesce(func.sum(Transaction.compliance_units), 0)).where(
                and_(
                    Transaction.organization_id == organization_id,
                    Transaction.create_date <= period_end,
                    Transaction.transaction_action != TransactionActionEnum.Released,
                )
            )
        )
        return int(balance or 0)
