"""Query timeouts, slow query logging and connection monitoring."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
import sqlalchemy as sa
from fastapi import Depends, FastAPI, Request
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from structlog.testing import capture_logs

from lcfs.db import pool_monitor
from lcfs.db.dependencies import extended_statement_timeout, set_statement_timeout
from lcfs.db.engine_config import build_connect_args
from lcfs.db.pool_monitor import ConnectionTracker, register_pool_monitor
from lcfs.settings import Settings, settings
from lcfs.utils import query_analyzer
from lcfs.utils.query_analyzer import (
    SLOW_QUERIES_TOTAL,
    STATEMENT_TIMEOUTS_TOTAL,
    _is_statement_timeout,
    register_query_analyzer,
)

pytestmark = pytest.mark.anyio


def _counter_value(counter, *labels) -> float:
    return counter.labels(*labels)._value.get()


class TestBuildConnectArgs:
    def test_sets_statement_timeout_as_server_setting(self):
        args = build_connect_args(30_000)
        assert args["server_settings"] == {"statement_timeout": "30000"}
        assert args["statement_cache_size"] == 0
        assert args["prepared_statement_cache_size"] == 0

    @pytest.mark.parametrize("value", [0, -1])
    def test_zero_or_negative_explicitly_disables_timeout(self, value):
        """An explicit "0" overrides any inherited server/database/role timeout."""
        assert build_connect_args(value)["server_settings"] == {
            "statement_timeout": "0"
        }

    def test_defaults(self):
        assert settings.db_statement_timeout_ms == 30_000
        assert (
            settings.db_export_statement_timeout_ms > settings.db_statement_timeout_ms
        )
        # Lifetime engine runs REINDEX / MV refresh jobs: unlimited by default.
        assert settings.db_background_statement_timeout_ms == 0


class TestSettings:
    """The documented environment variable names must really configure the app."""

    def test_environment_variables_override_defaults(self, monkeypatch):
        for name, value in {
            "LCFS_DB_STATEMENT_TIMEOUT_MS": "1000",
            "LCFS_DB_EXPORT_STATEMENT_TIMEOUT_MS": "2000",
            "LCFS_DB_BACKGROUND_STATEMENT_TIMEOUT_MS": "3000",
            "LCFS_DB_SLOW_QUERY_THRESHOLD_SECONDS": "0.5",
            "LCFS_DB_POOL_MONITORING_ENABLED": "false",
            "LCFS_DB_CONNECTION_BUDGET": "42",
            "LCFS_DB_POOL_UTILIZATION_WARN_RATIO": "0.5",
            "LCFS_DB_CONNECTION_HOLD_WARN_SECONDS": "7",
            "LCFS_DB_POOL_STATS_LOG_INTERVAL_SECONDS": "9",
        }.items():
            monkeypatch.setenv(name, value)
        cfg = Settings()
        assert cfg.db_statement_timeout_ms == 1000
        assert cfg.db_export_statement_timeout_ms == 2000
        assert cfg.db_background_statement_timeout_ms == 3000
        assert cfg.db_slow_query_threshold_seconds == 0.5
        assert cfg.db_pool_monitoring_enabled is False
        assert cfg.db_connection_budget == 42
        assert cfg.db_pool_utilization_warn_ratio == 0.5
        assert cfg.db_connection_hold_warn_seconds == 7
        assert cfg.db_pool_stats_log_interval_seconds == 9

    @pytest.mark.parametrize(
        "name, value",
        [
            ("LCFS_DB_STATEMENT_TIMEOUT_MS", "-1"),
            ("LCFS_DB_EXPORT_STATEMENT_TIMEOUT_MS", "-1"),
            ("LCFS_DB_BACKGROUND_STATEMENT_TIMEOUT_MS", "-1"),
            ("LCFS_DB_CONNECTION_BUDGET", "0"),
            ("LCFS_DB_POOL_UTILIZATION_WARN_RATIO", "0"),
            ("LCFS_DB_POOL_UTILIZATION_WARN_RATIO", "1.5"),
            ("LCFS_DB_SLOW_QUERY_THRESHOLD_SECONDS", "-0.1"),
        ],
    )
    def test_invalid_values_are_rejected_at_startup(self, monkeypatch, name, value):
        monkeypatch.setenv(name, value)
        with pytest.raises(ValidationError):
            Settings()


class TestExtendedStatementTimeout:
    async def test_sets_export_timeout_on_request_state(self):
        request = SimpleNamespace(state=SimpleNamespace())
        await extended_statement_timeout(request)
        assert (
            request.state.db_statement_timeout_ms
            == settings.db_export_statement_timeout_ms
        )

    async def test_is_noop_when_timeouts_are_disabled_globally(self, monkeypatch):
        """An export must never get a tighter limit than a normal request."""
        monkeypatch.setattr(settings, "db_statement_timeout_ms", 0)
        request = SimpleNamespace(state=SimpleNamespace())
        await extended_statement_timeout(request)
        assert not hasattr(request.state, "db_statement_timeout_ms")

    @pytest.mark.parametrize("export_ms", [300_000, 120_000])
    async def test_is_noop_when_export_timeout_is_not_larger(
        self, monkeypatch, export_ms
    ):
        monkeypatch.setattr(settings, "db_statement_timeout_ms", 300_000)
        monkeypatch.setattr(settings, "db_export_statement_timeout_ms", export_ms)
        request = SimpleNamespace(state=SimpleNamespace())
        await extended_statement_timeout(request)
        assert not hasattr(request.state, "db_statement_timeout_ms")

    async def test_zero_export_timeout_means_unlimited(self, monkeypatch):
        monkeypatch.setattr(settings, "db_statement_timeout_ms", 30_000)
        monkeypatch.setattr(settings, "db_export_statement_timeout_ms", 0)
        request = SimpleNamespace(state=SimpleNamespace())
        await extended_statement_timeout(request)
        assert request.state.db_statement_timeout_ms == 0

    async def test_set_statement_timeout_is_transaction_local(self):
        session = MagicMock()
        session.execute = AsyncMock()
        await set_statement_timeout(session, 120_000)

        stmt, params = session.execute.await_args.args
        sql = str(stmt)
        assert "set_config('statement_timeout'" in sql
        assert sql.rstrip().endswith("true)")
        assert params == {"timeout_ms": "120000"}

    async def test_negative_timeout_is_clamped_to_zero(self):
        session = MagicMock()
        session.execute = AsyncMock()
        await set_statement_timeout(session, -5)
        assert session.execute.await_args.args[1] == {"timeout_ms": "0"}

    async def test_route_dependency_runs_before_session_dependency(self):
        """
        ``get_async_db_session`` reads ``request.state`` when it is resolved, so
        route-level ``dependencies=[...]`` must run before parameter dependencies.
        """
        app = FastAPI()
        seen = {}

        async def fake_session(request: Request):
            seen["timeout"] = getattr(request.state, "db_statement_timeout_ms", None)
            return object()

        @app.get("/export", dependencies=[Depends(extended_statement_timeout)])
        async def export(session=Depends(fake_session)):
            return {"ok": True}

        @app.get("/plain")
        async def plain(session=Depends(fake_session)):
            return {"ok": True}

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            assert (await client.get("/export")).status_code == 200
            assert seen["timeout"] == settings.db_export_statement_timeout_ms
            assert (await client.get("/plain")).status_code == 200
            assert seen["timeout"] is None


class TestExportRoutesUseExtendedTimeout:
    """Guard against export endpoints silently falling back to the 30s default."""

    @staticmethod
    def _api_routes(routes):
        for route in routes:
            if hasattr(route, "dependant"):
                yield route
            yield from TestExportRoutesUseExtendedTimeout._api_routes(
                getattr(route, "routes", None) or []
            )

    @staticmethod
    def _is_export(path: str) -> bool:
        # update-template is a data export despite its name
        return (
            path.endswith("/export")
            or "/export/" in path
            or path.endswith("/update-template/{report_id}")
        )

    def test_every_export_route_has_extended_timeout(self):
        from lcfs.web.application import get_app

        export_routes = [
            route
            for route in self._api_routes(get_app().routes)
            if self._is_export(route.path)
        ]
        assert len(export_routes) >= 17, "export routes were not discovered"

        missing = [
            f"{sorted(route.methods)} {route.path}"
            for route in export_routes
            if extended_statement_timeout
            not in [dep.dependency for dep in route.dependencies]
        ]
        assert not missing, f"export routes without extended timeout: {missing}"


class TestQueryAnalyzer:
    @pytest.fixture
    def engine(self, monkeypatch):
        monkeypatch.setattr(settings, "db_slow_query_threshold_seconds", 0.0)
        engine = sa.create_engine("sqlite:///:memory:")
        register_query_analyzer(engine, name="test-slow")
        return engine

    def test_slow_orm_style_statement_is_logged(self, engine):
        before = _counter_value(SLOW_QUERIES_TOTAL, "test-slow")
        with capture_logs() as logs, engine.connect() as conn:
            conn.execute(sa.select(sa.literal(1)))
        slow = [e for e in logs if e["event"] == "Slow query detected"]
        assert slow and slow[0]["engine"] == "test-slow"
        assert slow[0]["execution_time"] >= 0
        assert _counter_value(SLOW_QUERIES_TOTAL, "test-slow") > before

    def test_raw_text_statement_is_logged(self, engine):
        """``text()`` bypasses ORM logging but not cursor-level hooks."""
        with capture_logs() as logs, engine.connect() as conn:
            conn.execute(sa.text("SELECT 42 AS answer"))
        assert any(
            e["event"] == "Slow query detected" and "SELECT 42" in e["query"]
            for e in logs
        )

    def test_fast_query_not_logged(self, engine, monkeypatch):
        monkeypatch.setattr(settings, "db_slow_query_threshold_seconds", 60.0)
        with capture_logs() as logs, engine.connect() as conn:
            conn.execute(sa.text("SELECT 1"))
        assert not [e for e in logs if e["event"] == "Slow query detected"]

    def test_threshold_is_configurable(self, engine, monkeypatch):
        monkeypatch.setattr(settings, "db_slow_query_threshold_seconds", 0.0)
        with capture_logs() as logs, engine.connect() as conn:
            conn.execute(sa.text("SELECT 1"))
        assert logs

        monkeypatch.setattr(settings, "db_slow_query_threshold_seconds", 1000.0)
        with capture_logs() as logs, engine.connect() as conn:
            conn.execute(sa.text("SELECT 1"))
        assert not logs

    def test_failed_statement_does_not_leak_start_time(self, engine):
        with engine.connect() as conn:
            with pytest.raises(sa.exc.OperationalError):
                conn.execute(sa.text("SELECT * FROM table_that_does_not_exist"))
            assert conn.connection.dbapi_connection is not None
            assert conn.info.get("query_start_time") == []

    def test_statement_timeout_is_detected_and_logged(self):
        before = _counter_value(STATEMENT_TIMEOUTS_TOTAL, "test-timeout")

        class QueryCanceled(Exception):
            sqlstate = "57014"

        exc = QueryCanceled("canceling statement due to statement timeout")
        assert _is_statement_timeout(exc)

        conn = SimpleNamespace(info={"query_start_time": [0.0]})
        ctx = SimpleNamespace(
            connection=conn,
            original_exception=exc,
            statement="SELECT pg_sleep(100)",
            parameters={"secret": "value"},
        )
        handler = query_analyzer._make_handle_error("test-timeout")
        with capture_logs() as logs:
            handler(ctx)

        assert _counter_value(STATEMENT_TIMEOUTS_TOTAL, "test-timeout") == before + 1
        entry = [e for e in logs if e["event"].startswith("Query cancelled")][0]
        assert entry["query"] == "SELECT pg_sleep(100)"
        assert "parameters" not in entry  # may contain personal data
        assert entry["execution_time"] > 0
        assert conn.info["query_start_time"] == []

    def test_user_cancel_is_not_counted_as_timeout(self):
        class QueryCanceled(Exception):
            sqlstate = "57014"

        assert not _is_statement_timeout(
            QueryCanceled("canceling statement due to user request")
        )
        assert not _is_statement_timeout(ValueError("boom"))
        assert not _is_statement_timeout(None)

    def test_timeout_detected_through_cause_chain(self):
        class QueryCanceled(Exception):
            sqlstate = "57014"

        inner = QueryCanceled("canceling statement due to statement timeout")
        outer = RuntimeError("wrapped")
        outer.__cause__ = inner
        assert _is_statement_timeout(outer)


def _record():
    return SimpleNamespace(info={})


class TestConnectionTracker:
    @pytest.fixture
    def tracker(self, monkeypatch):
        monkeypatch.setattr(settings, "db_connection_budget", 10)
        monkeypatch.setattr(settings, "db_pool_utilization_warn_ratio", 0.8)
        monkeypatch.setattr(settings, "db_connection_hold_warn_seconds", 30.0)
        monkeypatch.setattr(settings, "db_pool_stats_log_interval_seconds", 3600.0)
        return ConnectionTracker()

    def test_tracks_checkout_and_checkin_across_engines(self, tracker):
        a, b, c = _record(), _record(), _record()
        tracker.on_checkout("app", a)
        tracker.on_checkout("app", b)
        tracker.on_checkout("lifetime", c)

        snap = tracker.snapshot()
        assert snap["checked_out"] == 3
        assert snap["by_engine"] == {"app": 2, "lifetime": 1}
        assert snap["utilization"] == 0.3
        assert snap["total_checkouts"] == 3

        tracker.on_checkin(a)
        tracker.on_checkin(c)
        snap = tracker.snapshot()
        assert snap["checked_out"] == 1
        assert snap["by_engine"] == {"app": 1, "lifetime": 0}

    def test_checkin_without_checkout_is_ignored(self, tracker):
        tracker.on_checkin(_record())
        assert tracker.snapshot()["checked_out"] == 0

    def test_double_checkin_does_not_go_negative(self, tracker):
        rec = _record()
        tracker.on_checkout("app", rec)
        tracker.on_checkin(rec)
        tracker.on_checkin(rec)
        assert tracker.snapshot()["by_engine"]["app"] == 0

    def test_warns_when_utilization_reaches_threshold(self, tracker):
        records = [_record() for _ in range(8)]
        with capture_logs() as logs:
            for rec in records:
                tracker.on_checkout("app", rec)
        warnings = [
            e for e in logs if e["event"] == "Database connection utilization is high"
        ]
        # 8/10 == 0.8 reaches the threshold; throttling collapses repeats.
        assert len(warnings) == 1
        assert warnings[0]["checked_out"] == 8
        assert warnings[0]["budget"] == 10

    def test_no_warning_below_threshold(self, tracker):
        with capture_logs() as logs:
            for _ in range(7):
                tracker.on_checkout("app", _record())
        assert not [e for e in logs if e["log_level"] == "warning"]

    def test_warns_on_long_connection_hold(self, tracker, monkeypatch):
        rec = _record()
        tracker.on_checkout("app", rec)
        rec.info[pool_monitor._CHECKOUT_TS_KEY] -= 45  # held for 45s
        with capture_logs() as logs:
            tracker.on_checkin(rec)
        held = [e for e in logs if e["event"].startswith("Database connection held")]
        assert held and held[0]["held_seconds"] >= 45

    def test_periodic_stats_log(self, tracker, monkeypatch):
        monkeypatch.setattr(settings, "db_pool_stats_log_interval_seconds", 0.0)
        with capture_logs() as logs:
            rec = _record()
            tracker.on_checkout("app", rec)
            tracker.on_checkin(rec)
        stats = [e for e in logs if e["event"] == "Database connection stats"]
        assert stats
        assert stats[0]["peak_in_interval"] >= 1

    def test_register_wires_real_pool_events(self, monkeypatch):
        """End to end with a real engine: counts return to zero after use."""
        monkeypatch.setattr(settings, "db_pool_monitoring_enabled", True)
        fresh = ConnectionTracker()
        monkeypatch.setattr(pool_monitor, "connection_tracker", fresh)

        engine = sa.create_engine("sqlite:///:memory:", poolclass=sa.pool.NullPool)
        register_pool_monitor(engine, "sqlite-test")
        with engine.connect() as conn:
            assert fresh.snapshot()["by_engine"]["sqlite-test"] == 1
            conn.execute(sa.text("SELECT 1"))
        snap = fresh.snapshot()
        assert snap["by_engine"]["sqlite-test"] == 0
        assert snap["total_checkouts"] == 1

    def test_register_is_noop_when_disabled(self, monkeypatch):
        monkeypatch.setattr(settings, "db_pool_monitoring_enabled", False)
        fresh = ConnectionTracker()
        monkeypatch.setattr(pool_monitor, "connection_tracker", fresh)
        engine = sa.create_engine("sqlite:///:memory:", poolclass=sa.pool.NullPool)
        register_pool_monitor(engine, "disabled")
        with engine.connect():
            pass
        assert fresh.snapshot()["total_checkouts"] == 0


class TestStatementTimeoutAgainstPostgres:
    @pytest.fixture
    async def pg_engine(self):
        from sqlalchemy.ext.asyncio import create_async_engine
        from sqlalchemy.pool import NullPool

        engine = create_async_engine(
            # maintenance DB: exists everywhere and these tests only use pg_sleep/SHOW
            str(settings.db_url.with_path("/postgres")),
            poolclass=NullPool,
            connect_args=build_connect_args(300),  # 300ms
        )
        try:
            async with engine.connect() as conn:
                await conn.execute(sa.text("SELECT 1"))
        except Exception as exc:
            await engine.dispose()
            pytest.skip(f"PostgreSQL not reachable: {exc!r}")
        yield engine
        await engine.dispose()

    async def test_default_timeout_cancels_slow_query(self, pg_engine):
        before = _counter_value(STATEMENT_TIMEOUTS_TOTAL, "pg-test")
        register_query_analyzer(pg_engine.sync_engine, name="pg-test")
        async with pg_engine.connect() as conn:
            assert (await conn.scalar(sa.text("SHOW statement_timeout"))) == "300ms"
            with pytest.raises(sa.exc.DBAPIError) as exc_info:
                await conn.execute(sa.text("SELECT pg_sleep(5)"))
            assert "statement timeout" in str(exc_info.value)
        assert _counter_value(STATEMENT_TIMEOUTS_TOTAL, "pg-test") == before + 1

    async def test_local_override_extends_timeout_for_transaction_only(self, pg_engine):
        from sqlalchemy.ext.asyncio import AsyncSession

        async with AsyncSession(pg_engine) as session:
            async with session.begin():
                await set_statement_timeout(session, 5_000)
                assert await session.scalar(sa.text("SHOW statement_timeout")) == "5s"
                # would be cancelled by the 300ms default
                await session.execute(sa.text("SELECT pg_sleep(0.6)"))
            # transaction over: back to the engine default
            async with session.begin():
                assert (
                    await session.scalar(sa.text("SHOW statement_timeout")) == "300ms"
                )


class TestSessionDependencyEndToEnd:
    """Real ``get_async_db_session`` over HTTP: default vs export timeout."""

    async def test_request_and_export_routes_get_expected_timeouts(self, monkeypatch):
        from sqlalchemy.ext.asyncio import create_async_engine
        from sqlalchemy.pool import NullPool

        from lcfs.db import dependencies as db_dependencies

        engine = create_async_engine(
            str(settings.db_url.with_path("/postgres")),
            poolclass=NullPool,
            connect_args=build_connect_args(settings.db_statement_timeout_ms),
        )
        try:
            async with engine.connect() as conn:
                await conn.execute(sa.text("SELECT 1"))
        except Exception as exc:
            await engine.dispose()
            pytest.skip(f"PostgreSQL not reachable: {exc!r}")

        monkeypatch.setattr(db_dependencies, "async_engine", engine)
        monkeypatch.setattr(settings, "db_statement_timeout_ms", 30_000)
        monkeypatch.setattr(settings, "db_export_statement_timeout_ms", 300_000)

        app = FastAPI()

        @app.middleware("http")
        async def anonymous(request: Request, call_next):
            request.scope["user"] = None  # get_async_db_session reads request.user
            return await call_next(request)

        async def show_timeout(session=Depends(db_dependencies.get_async_db_session)):
            return {"timeout": await session.scalar(sa.text("SHOW statement_timeout"))}

        app.add_api_route("/plain", show_timeout)
        app.add_api_route(
            "/export",
            show_timeout,
            dependencies=[Depends(extended_statement_timeout)],
        )

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                plain = await client.get("/plain")
                export = await client.get("/export")
                plain_again = await client.get("/plain")
        finally:
            await engine.dispose()

        assert plain.json() == {"timeout": "30s"}
        assert export.json() == {"timeout": "5min"}
        # the override is transaction-local and must not leak to later requests
        assert plain_again.json() == {"timeout": "30s"}
