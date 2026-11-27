"""LCFS-SEC-025 regression: every public (unauthenticated) route must be
rate-limited via ``public_view_handler``. These routes previously ran the
bare view function with no limiter at all.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from fakeredis import FakeServer, aioredis
from starlette.requests import Request as StarletteRequest

from lcfs.settings import settings
from lcfs.web.api.calculator.views import (
    get_calculated_data,
    get_calculator_compliance_periods,
    get_calculator_fuel_type_options,
    get_calculator_fuel_types,
    get_lookup_table_data,
    get_quantity_from_compliance_units,
)
from lcfs.web.api.credit_market.views import (
    get_credit_market_public_overview,
    get_credit_market_public_report,
)
from lcfs.web.api.login_bg_image.views import get_active_image
from lcfs.web.api.release_notes.views import get_release_note_overrides

pytestmark = pytest.mark.anyio


def _make_request(app: FastAPI) -> StarletteRequest:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/test",
        "raw_path": b"/api/test",
        "query_string": b"",
        "headers": [],
        "client": ("1.2.3.4", 12345),
        "app": app,
        "route": None,
        "user": None,
        "state": {},
    }
    return StarletteRequest(scope)


@pytest.fixture
async def app_with_redis():
    server = FakeServer()
    server.connected = True
    redis_client = aioredis.FakeRedis(server=server, decode_responses=True)
    app = FastAPI()
    app.state.redis_client = redis_client
    try:
        yield app, redis_client
    finally:
        await redis_client.close()


@pytest.fixture(autouse=True)
def _tight_default_limit(monkeypatch):
    # These routes rely on the global default limit (no per-route override),
    # so tighten it to make the tests fast and deterministic.
    monkeypatch.setattr(settings, "rate_limit_default_times", 1)
    monkeypatch.setattr(settings, "rate_limit_default_seconds", 60)


@pytest.mark.parametrize(
    "call",
    [
        lambda req, svc: get_credit_market_public_overview(
            req, interval="quarter", service=svc
        ),
        lambda req, svc: get_credit_market_public_report(req, service=svc),
        lambda req, svc: get_active_image(req, service=svc),
        lambda req, svc: get_release_note_overrides(req, service=svc),
        lambda req, svc: get_calculator_compliance_periods(req, service=svc),
        lambda req, svc: get_calculator_fuel_types(
            req, compliance_period=2024, fuel_category="Gasoline", service=svc
        ),
        lambda req, svc: get_calculator_fuel_type_options(
            req,
            compliance_period="2024",
            fuel_category_id=1,
            fuel_type_id=1,
            service=svc,
        ),
        lambda req, svc: get_calculated_data(
            req,
            compliance_period="2024",
            query=MagicMock(
                fuel_type_id=1,
                fuel_category_id=1,
                end_use_id=1,
                fuel_code_id=None,
                quantity=1,
                use_custom_ci=False,
                custom_ci_value=None,
            ),
            service=svc,
        ),
        lambda req, svc: get_quantity_from_compliance_units(
            req,
            compliance_period="2024",
            query=MagicMock(
                fuel_type_id=1,
                fuel_category_id=1,
                end_use_id=1,
                fuel_code_id=None,
                compliance_units=1,
                use_custom_ci=False,
                custom_ci_value=None,
            ),
            service=svc,
        ),
        lambda req, svc: get_lookup_table_data(req, compliance_year=2024, service=svc),
    ],
    ids=[
        "credit_market_public_overview",
        "credit_market_public_report",
        "login_bg_image_active",
        "release_notes_overrides",
        "calculator_compliance_periods",
        "calculator_fuel_types",
        "calculator_fuel_type_options",
        "calculator_calculate",
        "calculator_calculate_quantity",
        "calculator_lookup_table",
    ],
)
async def test_public_route_is_rate_limited(app_with_redis, call):
    app, _ = app_with_redis
    service = MagicMock()
    # Every service method these routes call is async; set them all so
    # whichever one a given route hits returns a usable value.
    for method_name in (
        "get_public_overview",
        "get_public_report",
        "get_active",
        "get_overrides",
        "get_compliance_periods",
        "get_fuel_types",
        "get_fuel_type_options",
        "get_calculated_data",
        "get_quantity_from_compliance_units",
        "get_lookup_table_data",
    ):
        setattr(service, method_name, AsyncMock(return_value=MagicMock()))

    # First call (within the limit of 1/60s) succeeds.
    await call(_make_request(app), service)

    # Second call for the same route/IP trips the limiter.
    with pytest.raises(HTTPException) as exc_info:
        await call(_make_request(app), service)
    assert exc_info.value.status_code == 429
