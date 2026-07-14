import structlog
from fastapi import APIRouter, Depends, Request, Query, status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.core.decorators import view_handler
from lcfs.web.api.credit_market.services import CreditMarketServices
from lcfs.web.api.credit_market.schema import (
    CreditMarketOverviewSchema,
    CreditMarketPublicOverviewSchema,
    PublicMarketReportSchema,
)

router = APIRouter()
logger = structlog.get_logger(__name__)


@router.get(
    "/public-overview",
    tags=["public"],
    response_model=CreditMarketPublicOverviewSchema,
    status_code=status.HTTP_200_OK,
)
async def get_credit_market_public_overview(
    request: Request,
    interval: str = Query(
        "quarter",
        description="Time bucket for the price series",
        pattern="^(month|quarter|year)$",
    ),
    service: CreditMarketServices = Depends(),
):
    """
    Public, aggregated + anonymized credit market snapshot for the landing
    page: price trend (VWAP with high/low band), traded volume, and headline
    program figures. No organization identity and no per-organization price.
    """
    return await service.get_public_overview(interval)


@router.get(
    "/public-report",
    tags=["public"],
    response_model=PublicMarketReportSchema,
    status_code=status.HTTP_200_OK,
)
async def get_credit_market_public_report(
    request: Request,
    service: CreditMarketServices = Depends(),
):
    """
    Public, aggregate-only market report: monthly/quarterly/annual transfer
    counts, volume, weighted-average price and transfer value, plus all-time
    totals and year-over-year KPIs. Low-count periods are withheld; no
    individual prices or organizations are exposed.
    """
    return await service.get_public_report()


@router.get("/overview", response_model=CreditMarketOverviewSchema)
@view_handler([RoleEnum.GOVERNMENT])
async def get_credit_market_overview(
    request: Request,
    interval: str = Query(
        "quarter",
        description="Time bucket for the price and balance series",
        pattern="^(month|quarter|year)$",
    ),
    service: CreditMarketServices = Depends(),
):
    """
    Aggregated BC LCFS credit market view: price index (VWAP), traded volume,
    province-wide credit balance trend, and ownership concentration.
    Government-only; no per-organization identity or price is exposed.
    """
    return await service.get_overview(interval)
