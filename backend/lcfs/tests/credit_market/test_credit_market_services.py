from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.exceptions import RequestValidationError

from lcfs.web.api.credit_market.services import CreditMarketServices


@pytest.fixture
def mock_repo():
    repo = MagicMock()
    repo.get_price_index = AsyncMock(return_value=[])
    repo.get_market_balance = AsyncMock(return_value=[])
    repo.get_holder_balances = AsyncMock(return_value=[])
    repo.get_total_credits_issued = AsyncMock(return_value=0)
    repo.get_report_periods = AsyncMock(return_value=[])
    repo.get_report_all_time = AsyncMock(
        return_value=SimpleNamespace(
            transfers=0, volume=0, transfer_value=0, wavg=None
        )
    )
    return repo


def _report_row(period, transfers, volume, value, wavg, sellers, buyers):
    return SimpleNamespace(
        period=period,
        transfers=transfers,
        volume=volume,
        transfer_value=value,
        wavg=wavg,
        distinct_sellers=sellers,
        distinct_buyers=buyers,
    )


@pytest.fixture
def service(mock_repo):
    return CreditMarketServices(repo=mock_repo)


def _price_row(period, vwap, median, lo, hi, volume, count):
    return SimpleNamespace(
        period=period,
        vwap=vwap,
        median_price=median,
        min_price=lo,
        max_price=hi,
        volume=volume,
        trade_count=count,
    )


@pytest.mark.anyio
async def test_invalid_interval_raises(service):
    with pytest.raises(RequestValidationError):
        await service.get_overview("daily")


@pytest.mark.anyio
@pytest.mark.parametrize(
    "interval,expected",
    [
        ("year", "2024"),
        ("quarter", "2024-Q3"),
        ("month", "2024-08"),
    ],
)
async def test_period_labels(service, mock_repo, interval, expected):
    mock_repo.get_price_index.return_value = [
        _price_row(datetime(2024, 8, 1), 320.5, 318.0, 300.0, 350.0, 1000, 4)
    ]
    result = await service.get_overview(interval)
    assert result.price_index[0].period == expected
    assert result.price_index[0].vwap == 320.5
    assert result.price_index[0].volume == 1000


@pytest.mark.anyio
async def test_cumulative_balance_is_running_sum(service, mock_repo):
    mock_repo.get_market_balance.return_value = [
        SimpleNamespace(period=datetime(2023, 1, 1), net_units=100),
        SimpleNamespace(period=datetime(2024, 1, 1), net_units=-30),
        SimpleNamespace(period=datetime(2025, 1, 1), net_units=50),
    ]
    result = await service.get_overview("year")
    balances = [p.cumulative_balance for p in result.market_balance]
    assert balances == [100, 70, 120]
    assert result.market_balance[1].period_net_units == -30


@pytest.mark.anyio
async def test_concentration_hhi_and_shares(service, mock_repo):
    # Two equal holders -> HHI = 50^2 + 50^2 = 5000, top5 share = 1.0
    mock_repo.get_holder_balances.return_value = [
        SimpleNamespace(organization_id=1, balance=500),
        SimpleNamespace(organization_id=2, balance=500),
    ]
    result = await service.get_overview("quarter")
    conc = result.concentration
    assert conc.total_holders == 2
    assert conc.hhi == pytest.approx(5000.0)
    assert conc.top5_share == pytest.approx(1.0)
    assert conc.top_holders[0].rank == 1
    assert conc.top_holders[0].share == pytest.approx(0.5)


@pytest.mark.anyio
async def test_concentration_empty_market(service):
    result = await service.get_overview("quarter")
    assert result.concentration.hhi == 0.0
    assert result.concentration.total_holders == 0
    assert result.concentration.top_holders == []


@pytest.mark.anyio
async def test_public_overview_is_aggregated_and_headline(service, mock_repo):
    # Snapshot reuses the suppressed, effective-date report aggregation.
    mock_repo.get_report_periods.return_value = [
        _report_row(datetime(2024, 1, 1), 10, 500, 180000, 360.0, 4, 3),
        _report_row(datetime(2024, 4, 1), 8, 620, 244000, 395.0, 4, 3),
    ]
    mock_repo.get_holder_balances.return_value = [
        SimpleNamespace(organization_id=1, balance=400),
        SimpleNamespace(organization_id=2, balance=300),
    ]
    mock_repo.get_total_credits_issued.return_value = 4200
    result = await service.get_public_overview("quarter")

    assert result.latest_vwap == 395.0
    assert result.total_volume_traded == 1120
    assert result.outstanding_credits == 700
    assert result.participating_organizations == 2
    assert result.total_credits_issued == 4200
    # Public price points expose aggregate price/volume only — never min/max.
    point = result.price_index[0]
    assert point.period == "2024-Q1"
    assert point.vwap == 360.0
    assert point.low is None
    assert point.high is None


@pytest.mark.anyio
async def test_public_overview_suppresses_low_count_periods(service, mock_repo):
    mock_repo.get_report_periods.return_value = [
        _report_row(datetime(2024, 1, 1), 10, 500, 180000, 360.0, 4, 3),
        # withheld: too few transfers / sellers
        _report_row(datetime(2024, 4, 1), 2, 50, 20000, 395.0, 2, 1),
    ]
    result = await service.get_public_overview("quarter")
    assert [p.period for p in result.price_index] == ["2024-Q1"]


@pytest.mark.anyio
async def test_public_overview_invalid_interval_raises(service):
    with pytest.raises(RequestValidationError):
        await service.get_public_overview("weekly")


@pytest.mark.anyio
async def test_public_report_suppresses_low_count_periods(service, mock_repo):
    rows = [
        # publishable: >= 5 transfers and >= 3 distinct sellers
        _report_row(datetime(2025, 1, 1), 10, 1000, 200000, 200.0, 4, 3),
        # withheld: only 3 transfers and 2 sellers
        _report_row(datetime(2026, 1, 1), 3, 300, 60000, 250.0, 2, 2),
    ]
    mock_repo.get_report_periods.return_value = rows
    mock_repo.get_report_all_time.return_value = _report_row(
        None, 13, 1300, 260000, 210.0, 5, 4
    )

    result = await service.get_public_report()

    # Only the qualifying period survives, at every granularity.
    assert [p.period for p in result.monthly] == ["2025-01"]
    assert result.monthly[0].transfer_value == 200000.0
    assert result.all_time.transfers == 13
    assert result.min_transfers == 5
    assert result.min_participants == 3
    # Latest publishable month with no publishable year-ago comparison.
    assert result.kpis.label_period == "2025-01"
    assert result.kpis.transfers.current == 10
    assert result.kpis.transfers.delta_pct is None
