from typing import List, Optional

from lcfs.web.api.base import BaseSchema


class PricePointSchema(BaseSchema):
    """A single point on the credit price curve for one time bucket."""

    period: str  # e.g. "2024", "2024-Q1", "2024-03"
    vwap: Optional[float] = None  # volume-weighted average price ($/credit)
    median_price: Optional[float] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    volume: int = 0  # total compliance units traded in the bucket
    trade_count: int = 0  # number of recorded transfers in the bucket


class MarketBalancePointSchema(BaseSchema):
    """Province-wide credit supply for one time bucket."""

    period: str
    period_net_units: int  # net credits issued/consumed in the bucket
    cumulative_balance: int  # running province-wide credit balance


class ConcentrationHolderSchema(BaseSchema):
    """An anonymized holder's share of outstanding credits (ranked, no identity)."""

    rank: int
    share: float  # fraction of total outstanding credits (0..1)


class ConcentrationSchema(BaseSchema):
    """How concentrated credit ownership is across the market."""

    hhi: float  # Herfindahl-Hirschman Index, 0..10000
    top5_share: float  # fraction of credits held by the 5 largest holders (0..1)
    total_holders: int  # number of organizations holding a positive balance
    top_holders: List[ConcentrationHolderSchema]  # ranked, anonymized


class CreditMarketOverviewSchema(BaseSchema):
    """Full market dashboard payload (government/internal)."""

    interval: str  # "month" | "quarter" | "year"
    price_index: List[PricePointSchema]
    market_balance: List[MarketBalancePointSchema]
    concentration: ConcentrationSchema


class PublicPricePointSchema(BaseSchema):
    """Reduced, public-safe price point — no median or per-trade detail."""

    period: str
    vwap: Optional[float] = None
    low: Optional[float] = None
    high: Optional[float] = None
    volume: int = 0


class CreditMarketPublicOverviewSchema(BaseSchema):
    """
    Public landing-page payload. Aggregated and anonymized: a price trend
    with a high/low band, traded volume, and headline program figures. No
    concentration, no organization identity.
    """

    interval: str
    latest_vwap: Optional[float] = None
    total_volume_traded: int = 0
    outstanding_credits: int = 0
    participating_organizations: int = 0
    total_credits_issued: int = 0  # ~= tonnes CO2e reduced (1 credit = 1 tonne)
    price_index: List[PublicPricePointSchema]


class MarketReportPeriodSchema(BaseSchema):
    """One published (non-suppressed) period of aggregate market activity."""

    period: str
    transfers: int
    volume: int
    weighted_avg_price: Optional[float] = None
    transfer_value: float = 0.0


class MetricDeltaSchema(BaseSchema):
    """A headline metric compared against the same period a year earlier."""

    current: Optional[float] = None
    prior: Optional[float] = None
    delta_pct: Optional[float] = None


class MarketReportKpiSchema(BaseSchema):
    label_period: Optional[str] = None
    transfers: MetricDeltaSchema
    volume: MetricDeltaSchema
    weighted_avg_price: MetricDeltaSchema


class MarketReportAllTimeSchema(BaseSchema):
    transfers: int = 0
    volume: int = 0
    weighted_avg_price: Optional[float] = None
    transfer_value: float = 0.0


class PublicMarketReportSchema(BaseSchema):
    """
    Public, aggregate-only market report. Periods with fewer than the
    published thresholds of transfers/participants are withheld; no individual
    prices (min/max) or low-count category detail are exposed.
    """

    monthly: List[MarketReportPeriodSchema]
    quarterly: List[MarketReportPeriodSchema]
    annual: List[MarketReportPeriodSchema]
    all_time: MarketReportAllTimeSchema
    kpis: MarketReportKpiSchema
    min_transfers: int
    min_participants: int
