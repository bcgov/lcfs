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
        # Base query - join with compliance_report to get version for ComplianceReport transactions
        stmt = (
            select(
                CreditLedgerView,
                ComplianceReport.version.label("compliance_report_version"),
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
        )

        # Always sort by update_date DESC - sorting is not allowed on credit ledger
        stmt = stmt.order_by(CreditLedgerView.update_date.desc())

        # Count before pagination
        count_stmt = select(func.count()).select_from(
            select(CreditLedgerView).where(and_(*conditions)).subquery()
        )
        total = await self.db.scalar(count_stmt)

        # Pagination
        stmt = stmt.offset(offset).limit(limit)

        result = await self.db.execute(stmt)
        rows = result.all()
        return rows, total or 0

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
