import structlog
from typing import Optional, List

from fastapi import Depends
from sqlalchemy import func, select, and_, desc, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.db.models.transaction.CreditLedgerView import CreditLedgerView
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport

log = structlog.get_logger(__name__)


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
