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
    repo.get_report_a1_periods = AsyncMock(return_value=[])
    repo.get_report_all_time = AsyncMock(
        return_value=SimpleNamespace(transfers=0, volume=0, transfer_value=0, wavg=None)
    )
    return repo


def _report_row(
    period,
    transfers,
    volume,
    value,
    wavg,
    sellers,
    buyers,
    min_price=None,
    max_price=None,
):
    return SimpleNamespace(
        period=period,
        transfers=transfers,
        volume=volume,
        transfer_value=value,
        wavg=wavg,
        min_price=min_price,
        max_price=max_price,
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
    # Snapshot reuses the effective-date report aggregation.
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
@pytest.mark.parametrize("interval", ["month", "quarter", "year"])
@pytest.mark.parametrize("participants", [0, 1, 2, None])
async def test_public_overview_keeps_low_count_historical_periods(
    service, mock_repo, interval, participants
):
    mock_repo.get_report_periods.return_value = [
        _report_row(datetime(2015, 1, 1), 1, 50, 10000, 200.0, participants, 1),
        _report_row(datetime(2016, 1, 1), 2, 100, 25000, 250.0, 1, participants),
        _report_row(datetime(2024, 1, 1), 10, 500, 180000, 360.0, 4, 3),
    ]
    result = await service.get_public_overview(interval)
    mock_repo.get_report_periods.assert_awaited_once_with(interval)
    assert [p.period[:4] for p in result.price_index] == ["2015", "2016", "2024"]
    assert [p.vwap for p in result.price_index] == [200.0, 250.0, 360.0]
    assert result.total_volume_traded == 650
    assert result.latest_vwap == 360.0


@pytest.mark.anyio
async def test_public_overview_invalid_interval_raises(service):
    with pytest.raises(RequestValidationError):
        await service.get_public_overview("weekly")


@pytest.mark.anyio
async def test_public_report_tables_and_kpis_keep_low_count_historical_periods(
    service, mock_repo
):
    rows = [
        _report_row(datetime(2015, 1, 1), 10, 1000, 200000, 200.0, 4, 3),
        _report_row(datetime(2016, 1, 1), 3, 300, 75000, 250.0, 0, None),
    ]
    mock_repo.get_report_periods.return_value = rows
    mock_repo.get_report_a1_periods.return_value = [
        _report_row(datetime(2015, 12, 1), 2, 200, 40000, 200.0, 1, 1),
        rows[-1],
    ]
    mock_repo.get_report_all_time.return_value = _report_row(
        None, 13, 1300, 275000, 211.54, 5, 4
    )

    result = await service.get_public_report()

    assert [p.period for p in result.monthly] == ["2015-01", "2016-01"]
    assert [p.period for p in result.quarterly] == ["2015-Q1", "2016-Q1"]
    assert [p.period for p in result.annual] == ["2015", "2016"]
    assert [p.period for p in result.a1_monthly] == ["2015-12", "2016-01"]
    assert [p.transfers for p in result.monthly] == [10, 3]
    assert result.monthly[0].transfer_value == 200000.0
    assert result.monthly[1].transfer_value == 75000.0
    assert result.all_time.transfers == 13
    assert result.min_transfers == 0
    assert result.min_participants == 0
    assert result.kpis.label_period == "2016-01"
    assert result.kpis.transfers.current == 3
    assert result.kpis.transfers.prior == 10
    assert result.kpis.transfers.delta_pct == -70
    assert result.ytd_kpis.transfers.current == 3
    assert result.ytd_kpis.transfers.prior == 10
    assert result.ytd_kpis.weighted_avg_price.current == 250.0
    assert result.a1_kpis.label_period == "2016-01"
    assert result.a1_kpis.transfers.current == 3
    assert result.a1_kpis.transfers.prior == 2
    assert result.a1_kpis.transfers.delta_pct == 50


@pytest.mark.anyio
async def test_empty_public_data(service):
    overview = await service.get_public_overview("year")
    assert overview.price_index == []
    assert overview.latest_vwap is None
    assert overview.total_volume_traded == 0

    report = await service.get_public_report()
    assert report.monthly == []
    assert report.quarterly == []
    assert report.annual == []
    assert report.a1_monthly == []
    assert report.all_time.transfers == 0
    for kpis in (report.kpis, report.ytd_kpis, report.a1_kpis):
        assert kpis.label_period is None
        assert kpis.transfers.current is None
        assert kpis.transfers.prior is None
        assert kpis.transfers.delta_pct is None


@pytest.mark.anyio
async def test_public_report_includes_a1_details_from_transfer_base_view(
    service, mock_repo
):
    mock_repo.get_report_periods.return_value = [
        _report_row(datetime(2026, 7, 1), 13, 51404, 6972143.2, 135.63, 4, 4, 100, 175)
    ]
    mock_repo.get_report_a1_periods.return_value = [
        _report_row(datetime(2025, 7, 1), 9, 38000, 4560000, 120.0, 3, 3),
        _report_row(datetime(2026, 6, 1), 10, 35000, 4210500, 120.3, 3, 3, 90, 150),
        _report_row(datetime(2026, 7, 1), 11, 41274, 5849110.5, 141.75, 3, 3, 100, 175),
    ]

    result = await service.get_public_report()

    mock_repo.get_report_a1_periods.assert_awaited_once_with("month")
    assert result.monthly[0].min_price == 100
    assert result.monthly[0].max_price == 175
    assert result.a1_monthly[-1].min_price == 100
    assert result.a1_monthly[-1].max_price == 175
    assert result.a1_kpis.label_period == "2026-07"
    assert result.a1_kpis.transfers.current == 11
    assert result.a1_kpis.volume.current == 41274
    assert result.a1_kpis.weighted_avg_price.current == 141.75
    assert result.a1_kpis.weighted_avg_price.prior == 120.3
    assert result.a1_kpis.weighted_avg_price.delta_pct == 17.83


@pytest.mark.anyio
async def test_public_report_builds_ytd_kpis(service, mock_repo):
    mock_repo.get_report_periods.return_value = [
        _report_row(datetime(2025, 1, 1), 10, 1000, 200000, 200, 4, 3),
        _report_row(datetime(2025, 2, 1), 15, 1500, 330000, 220, 4, 3),
        _report_row(datetime(2026, 1, 1), 20, 1900, 361000, 190, 4, 3),
        _report_row(datetime(2026, 2, 1), 25, 2100, 441000, 210, 4, 3),
    ]

    result = await service.get_public_report()

    assert result.ytd_kpis.label_period == "2026-02"
    assert result.ytd_kpis.transfers.current == 45
    assert result.ytd_kpis.transfers.prior == 25
    assert result.ytd_kpis.transfers.delta_pct == 80
    assert result.ytd_kpis.volume.current == 4000
    assert result.ytd_kpis.volume.prior == 2500
    assert result.ytd_kpis.volume.delta_pct == 60
    assert result.ytd_kpis.weighted_avg_price.current == 200.5
    assert result.ytd_kpis.weighted_avg_price.prior == 212
