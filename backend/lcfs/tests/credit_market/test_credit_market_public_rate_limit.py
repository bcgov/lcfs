"""The public credit market routes share the public-route request limit."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import status

from lcfs.settings import settings
from lcfs.web.api.credit_market.services import CreditMarketServices

PUBLIC_ROUTES = [
    "/api/credit-market/public-overview",
    "/api/credit-market/public-report",
]


def _services():
    repo = MagicMock()
    repo.get_report_periods = AsyncMock(return_value=[])
    repo.get_report_a1_periods = AsyncMock(return_value=[])
    repo.get_holder_balances = AsyncMock(return_value=[])
    repo.get_total_credits_issued = AsyncMock(return_value=0)
    repo.get_report_all_time = AsyncMock(
        return_value=SimpleNamespace(transfers=0, volume=0, transfer_value=0, wavg=None)
    )
    return CreditMarketServices(repo=repo)


@pytest.fixture
def limited_public_routes(fastapi_app, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_default_times", 2)
    # A long window keeps the fixed-window counter from rolling over mid-test.
    monkeypatch.setattr(settings, "rate_limit_default_seconds", 3600)
    fastapi_app.dependency_overrides[CreditMarketServices] = _services
    yield
    fastapi_app.dependency_overrides.pop(CreditMarketServices, None)


@pytest.mark.anyio
@pytest.mark.parametrize("route", PUBLIC_ROUTES)
async def test_public_route_returns_429_past_the_limit(
    client, limited_public_routes, route
):
    for _ in range(2):
        response = await client.get(route)
        assert response.status_code == status.HTTP_200_OK, response.text

    response = await client.get(route)

    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert int(response.headers["Retry-After"]) >= 1


@pytest.mark.anyio
async def test_each_public_route_counts_separately(client, limited_public_routes):
    overview, report = PUBLIC_ROUTES
    for _ in range(2):
        assert (await client.get(overview)).status_code == status.HTTP_200_OK

    assert (await client.get(overview)).status_code == 429
    assert (await client.get(report)).status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_public_overview_still_validates_interval(client, limited_public_routes):
    response = await client.get(
        "/api/credit-market/public-overview", params={"interval": "week"}
    )

    assert response.status_code == 422
