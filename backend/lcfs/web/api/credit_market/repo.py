import structlog
from fastapi import Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.transfer.TransferStatus import TransferStatus, TransferStatusEnum
from lcfs.db.models.transaction.Transaction import (
    Transaction,
    TransactionActionEnum,
)

logger = structlog.get_logger(__name__)


class CreditMarketRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_price_index(self, interval: str, cutoff_current_month: bool = False):
        """
        Volume-weighted price statistics for recorded (settled) transfers,
        bucketed by ``interval`` on the transfer agreement date.

        Only ``Recorded`` transfers with a positive price and quantity are
        included, so nominal / non-arm's-length transfers do not distort the
        market price signal. When ``cutoff_current_month`` is set, the current
        in-progress month is excluded (used for public, monthly-published data).
        """
        period = func.date_trunc(interval, Transfer.agreement_date).label("period")
        conditions = [
            TransferStatus.status == TransferStatusEnum.Recorded,
            Transfer.price_per_unit.isnot(None),
            Transfer.price_per_unit > 0,
            Transfer.quantity.isnot(None),
            Transfer.quantity > 0,
            Transfer.agreement_date.isnot(None),
        ]
        if cutoff_current_month:
            conditions.append(
                Transfer.agreement_date
                < func.date_trunc("month", func.current_date())
            )
        query = (
            select(
                period,
                (
                    func.sum(Transfer.price_per_unit * Transfer.quantity)
                    / func.sum(Transfer.quantity)
                ).label("vwap"),
                func.percentile_cont(0.5)
                .within_group(Transfer.price_per_unit.asc())
                .label("median_price"),
                func.min(Transfer.price_per_unit).label("min_price"),
                func.max(Transfer.price_per_unit).label("max_price"),
                func.sum(Transfer.quantity).label("volume"),
                func.count(Transfer.transfer_id).label("trade_count"),
            )
            .join(
                TransferStatus,
                Transfer.current_status_id == TransferStatus.transfer_status_id,
            )
            .where(*conditions)
            .group_by(period)
            .order_by(period)
        )
        result = await self.db.execute(query)
        return result.all()

    @repo_handler
    async def get_market_balance(self, interval: str):
        """
        Net province-wide credit movement per time bucket, from settled
        ledger adjustments. The caller turns this into a running balance.
        """
        period = func.date_trunc(interval, Transaction.create_date).label("period")
        query = (
            select(
                period,
                func.sum(Transaction.compliance_units).label("net_units"),
            )
            .where(
                Transaction.transaction_action == TransactionActionEnum.Adjustment,
                Transaction.create_date.isnot(None),
            )
            .group_by(period)
            .order_by(period)
        )
        result = await self.db.execute(query)
        return result.all()

    @repo_handler
    async def get_holder_balances(self):
        """
        Current outstanding credit balance per organization (positive holders
        only), ordered largest first. Used to compute market concentration.
        Organization identity is not returned to callers.
        """
        balance = func.sum(Transaction.compliance_units).label("balance")
        query = (
            select(Transaction.organization_id, balance)
            .where(Transaction.transaction_action == TransactionActionEnum.Adjustment)
            .group_by(Transaction.organization_id)
            .having(func.sum(Transaction.compliance_units) > 0)
            .order_by(balance.desc())
        )
        result = await self.db.execute(query)
        return result.all()

    @repo_handler
    async def get_total_credits_issued(self):
        """
        Lifetime credits issued to organizations (positive settled
        adjustments). In the LCFS one credit corresponds to one tonne of CO2e
        reduced, so this is a proxy for the program's total emissions impact.
        """
        query = select(
            func.coalesce(func.sum(Transaction.compliance_units), 0)
        ).where(
            Transaction.transaction_action == TransactionActionEnum.Adjustment,
            Transaction.compliance_units > 0,
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    def _recorded_transfer_filters(self):
        """
        Shared filters: settled, priced, arm's-length-quantified transfers.
        The public report is published monthly, so only transfers effective up
        to the end of last month are included (the current, in-progress month
        is excluded).
        """
        return [
            TransferStatus.status == TransferStatusEnum.Recorded,
            Transfer.price_per_unit.isnot(None),
            Transfer.price_per_unit > 0,
            Transfer.quantity.isnot(None),
            Transfer.quantity > 0,
            Transfer.transaction_effective_date.isnot(None),
            Transfer.transaction_effective_date
            < func.date_trunc("month", func.current_date()),
        ]

    @repo_handler
    async def get_report_periods(self, interval: str):
        """
        Per-period market aggregates (count, volume, weighted-average price,
        transfer value) plus distinct-participant counts so the service can
        suppress periods that are too small to publish safely.
        """
        period = func.date_trunc(
            interval, Transfer.transaction_effective_date
        ).label("period")
        query = (
            select(
                period,
                func.count(Transfer.transfer_id).label("transfers"),
                func.sum(Transfer.quantity).label("volume"),
                func.sum(Transfer.price_per_unit * Transfer.quantity).label(
                    "transfer_value"
                ),
                (
                    func.sum(Transfer.price_per_unit * Transfer.quantity)
                    / func.nullif(func.sum(Transfer.quantity), 0)
                ).label("wavg"),
                func.count(func.distinct(Transfer.from_organization_id)).label(
                    "distinct_sellers"
                ),
                func.count(func.distinct(Transfer.to_organization_id)).label(
                    "distinct_buyers"
                ),
            )
            .join(
                TransferStatus,
                Transfer.current_status_id == TransferStatus.transfer_status_id,
            )
            .where(*self._recorded_transfer_filters())
            .group_by(period)
            .order_by(period)
        )
        result = await self.db.execute(query)
        return result.all()

    @repo_handler
    async def get_report_all_time(self):
        """Program-wide totals across all recorded, priced transfers."""
        query = (
            select(
                func.count(Transfer.transfer_id).label("transfers"),
                func.coalesce(func.sum(Transfer.quantity), 0).label("volume"),
                func.coalesce(
                    func.sum(Transfer.price_per_unit * Transfer.quantity), 0
                ).label("transfer_value"),
                (
                    func.sum(Transfer.price_per_unit * Transfer.quantity)
                    / func.nullif(func.sum(Transfer.quantity), 0)
                ).label("wavg"),
            )
            .join(
                TransferStatus,
                Transfer.current_status_id == TransferStatus.transfer_status_id,
            )
            .where(*self._recorded_transfer_filters())
        )
        result = await self.db.execute(query)
        return result.first()
