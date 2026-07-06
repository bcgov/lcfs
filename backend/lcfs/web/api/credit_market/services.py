from datetime import datetime
from typing import List

import structlog
from fastapi import Depends
from fastapi.exceptions import RequestValidationError

from lcfs.web.core.decorators import service_handler
from lcfs.web.api.credit_market.repo import CreditMarketRepository
from lcfs.web.api.credit_market.schema import (
    PricePointSchema,
    MarketBalancePointSchema,
    ConcentrationHolderSchema,
    ConcentrationSchema,
    CreditMarketOverviewSchema,
    PublicPricePointSchema,
    CreditMarketPublicOverviewSchema,
    MarketReportPeriodSchema,
    MetricDeltaSchema,
    MarketReportKpiSchema,
    MarketReportAllTimeSchema,
    PublicMarketReportSchema,
)

logger = structlog.get_logger(__name__)

VALID_INTERVALS = {"month", "quarter", "year"}
TOP_HOLDERS = 10

# Aggregate-only publishing thresholds. Periods below these are withheld so
# no near-individual transaction or price can be inferred from public data.
MIN_TRANSFERS = 5
MIN_PARTICIPANTS = 3


def _publishable(row) -> bool:
    return (
        (row.transfers or 0) >= MIN_TRANSFERS
        and (row.distinct_sellers or 0) >= MIN_PARTICIPANTS
    )


def _period_label(period: datetime, interval: str) -> str:
    """Format a date_trunc bucket into a stable, human-readable label."""
    if period is None:
        return "unknown"
    if interval == "year":
        return f"{period.year}"
    if interval == "quarter":
        quarter = (period.month - 1) // 3 + 1
        return f"{period.year}-Q{quarter}"
    return f"{period.year}-{period.month:02d}"


def _to_float(value):
    return float(value) if value is not None else None


def _to_int(value):
    return int(value) if value is not None else 0


class CreditMarketServices:
    def __init__(
        self, repo: CreditMarketRepository = Depends(CreditMarketRepository)
    ):
        self.repo = repo

    @service_handler
    async def get_overview(self, interval: str) -> CreditMarketOverviewSchema:
        if interval not in VALID_INTERVALS:
            raise RequestValidationError(
                [
                    {
                        "loc": ("query", "interval"),
                        "msg": f"interval must be one of {sorted(VALID_INTERVALS)}",
                        "type": "value_error",
                    }
                ]
            )

        price_index = await self._build_price_index(interval)
        market_balance = await self._build_market_balance(interval)
        concentration = await self._build_concentration()

        return CreditMarketOverviewSchema(
            interval=interval,
            price_index=price_index,
            market_balance=market_balance,
            concentration=concentration,
        )

    @service_handler
    async def get_public_overview(
        self, interval: str
    ) -> CreditMarketPublicOverviewSchema:
        """Public-safe subset: price trend, volume, and headline figures."""
        if interval not in VALID_INTERVALS:
            raise RequestValidationError(
                [
                    {
                        "loc": ("query", "interval"),
                        "msg": f"interval must be one of {sorted(VALID_INTERVALS)}",
                        "type": "value_error",
                    }
                ]
            )

        rows = await self.repo.get_price_index(interval)
        price_index = [
            PublicPricePointSchema(
                period=_period_label(row.period, interval),
                vwap=_to_float(row.vwap),
                low=_to_float(row.min_price),
                high=_to_float(row.max_price),
                volume=_to_int(row.volume),
            )
            for row in rows
        ]

        latest_vwap = next(
            (p.vwap for p in reversed(price_index) if p.vwap is not None), None
        )
        total_volume = sum(p.volume for p in price_index)

        holders = await self.repo.get_holder_balances()
        outstanding = sum(_to_int(row.balance) for row in holders)
        total_issued = _to_int(await self.repo.get_total_credits_issued())

        return CreditMarketPublicOverviewSchema(
            interval=interval,
            latest_vwap=latest_vwap,
            total_volume_traded=total_volume,
            outstanding_credits=outstanding,
            participating_organizations=len(holders),
            total_credits_issued=total_issued,
            price_index=price_index,
        )

    @service_handler
    async def get_public_report(self) -> PublicMarketReportSchema:
        """Aggregate-only market report across month/quarter/year granularity."""
        monthly_rows = await self.repo.get_report_periods("month")
        quarterly_rows = await self.repo.get_report_periods("quarter")
        annual_rows = await self.repo.get_report_periods("year")
        all_time_row = await self.repo.get_report_all_time()

        def to_periods(rows, interval):
            return [
                MarketReportPeriodSchema(
                    period=_period_label(r.period, interval),
                    transfers=_to_int(r.transfers),
                    volume=_to_int(r.volume),
                    weighted_avg_price=_to_float(r.wavg),
                    transfer_value=_to_float(r.transfer_value) or 0.0,
                )
                for r in rows
                if _publishable(r)
            ]

        pub_monthly = [r for r in monthly_rows if _publishable(r)]
        kpis = self._build_report_kpis(pub_monthly)

        all_time = MarketReportAllTimeSchema(
            transfers=_to_int(all_time_row.transfers) if all_time_row else 0,
            volume=_to_int(all_time_row.volume) if all_time_row else 0,
            weighted_avg_price=(
                _to_float(all_time_row.wavg) if all_time_row else None
            ),
            transfer_value=(
                _to_float(all_time_row.transfer_value) if all_time_row else 0.0
            )
            or 0.0,
        )

        return PublicMarketReportSchema(
            monthly=to_periods(monthly_rows, "month"),
            quarterly=to_periods(quarterly_rows, "quarter"),
            annual=to_periods(annual_rows, "year"),
            all_time=all_time,
            kpis=kpis,
            min_transfers=MIN_TRANSFERS,
            min_participants=MIN_PARTICIPANTS,
        )

    def _build_report_kpis(self, pub_monthly) -> MarketReportKpiSchema:
        empty = MetricDeltaSchema()
        if not pub_monthly:
            return MarketReportKpiSchema(
                label_period=None,
                transfers=empty,
                volume=empty,
                weighted_avg_price=empty,
            )

        by_ym = {(r.period.year, r.period.month): r for r in pub_monthly}
        latest = pub_monthly[-1]
        prior = by_ym.get((latest.period.year - 1, latest.period.month))

        def delta(current, prior_value) -> MetricDeltaSchema:
            cur = _to_float(current)
            pri = _to_float(prior_value)
            dpct = (
                round((cur - pri) / pri * 100, 2)
                if cur is not None and pri not in (None, 0)
                else None
            )
            return MetricDeltaSchema(current=cur, prior=pri, delta_pct=dpct)

        return MarketReportKpiSchema(
            label_period=_period_label(latest.period, "month"),
            transfers=delta(latest.transfers, prior.transfers if prior else None),
            volume=delta(latest.volume, prior.volume if prior else None),
            weighted_avg_price=delta(latest.wavg, prior.wavg if prior else None),
        )

    async def _build_price_index(self, interval: str) -> List[PricePointSchema]:
        rows = await self.repo.get_price_index(interval)
        return [
            PricePointSchema(
                period=_period_label(row.period, interval),
                vwap=_to_float(row.vwap),
                median_price=_to_float(row.median_price),
                min_price=_to_float(row.min_price),
                max_price=_to_float(row.max_price),
                volume=_to_int(row.volume),
                trade_count=_to_int(row.trade_count),
            )
            for row in rows
        ]

    async def _build_market_balance(
        self, interval: str
    ) -> List[MarketBalancePointSchema]:
        rows = await self.repo.get_market_balance(interval)
        running = 0
        points: List[MarketBalancePointSchema] = []
        for row in rows:
            net = _to_int(row.net_units)
            running += net
            points.append(
                MarketBalancePointSchema(
                    period=_period_label(row.period, interval),
                    period_net_units=net,
                    cumulative_balance=running,
                )
            )
        return points

    async def _build_concentration(self) -> ConcentrationSchema:
        rows = await self.repo.get_holder_balances()
        balances = [_to_int(row.balance) for row in rows]
        total = sum(balances)

        if total <= 0:
            return ConcentrationSchema(
                hhi=0.0, top5_share=0.0, total_holders=0, top_holders=[]
            )

        # HHI = sum of squared percentage shares (0..10000).
        hhi = sum((b / total * 100) ** 2 for b in balances)
        top5_share = sum(balances[:5]) / total
        top_holders = [
            ConcentrationHolderSchema(rank=i + 1, share=b / total)
            for i, b in enumerate(balances[:TOP_HOLDERS])
        ]

        return ConcentrationSchema(
            hhi=round(hhi, 2),
            top5_share=round(top5_share, 4),
            total_holders=len(balances),
            top_holders=top_holders,
        )
