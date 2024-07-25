from logging import getLogger
from fastapi import Depends
from sqlalchemy import select, func, union_all, join, literal
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.db.models.transaction.DirectorReviewTransactionCountView import DirectorReviewTransactionCountView
from lcfs.db.models.transaction.TransactionCountView import TransactionCountView
from lcfs.db.models.organization.Organization import Organization

logger = getLogger("dashboard_repo")

class DashboardRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_director_review_counts(self):
        query = select(
            DirectorReviewTransactionCountView.transaction_type,
            DirectorReviewTransactionCountView.count_for_review
        )

        result = await self.db.execute(query)
        counts = {row.transaction_type: row.count_for_review for row in result.fetchall()}
        return counts

    @repo_handler
    async def get_transaction_counts(self):
        query = select(
            TransactionCountView.transaction_type,
            TransactionCountView.count_in_progress
        )

        result = await self.db.execute(query)
        counts = {row.transaction_type: row.count_in_progress for row in result.fetchall()}
        return counts

    @repo_handler
    async def get_org_transaction_counts(self, organization_id):
        query = select(
            Organization.count_transfers_in_progress
        ).where(
            Organization.organization_id == organization_id
        )

        result = await self.db.execute(query)
        counts = {'transfers': result.scalar_one()}
        return counts
