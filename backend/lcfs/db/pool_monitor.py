"""
Connection utilization tracking via pool checkout/checkin events.

The app uses ``NullPool``, which has no size to inspect, so connections in use
are counted across all engines instead.
"""

import threading
import time
from typing import Any, Dict, Optional

import structlog
from prometheus_client import Counter, Gauge, Histogram
from sqlalchemy import event
from sqlalchemy.engine import Engine

from lcfs.settings import settings

logger = structlog.get_logger("lcfs.db.pool")

HIGH_UTILIZATION_WARN_THROTTLE_SECONDS = 10.0
_CHECKOUT_TS_KEY = "lcfs_checkout_ts"
_CHECKOUT_ENGINE_KEY = "lcfs_checkout_engine"

CONNECTIONS_CHECKED_OUT = Gauge(
    "lcfs_db_connections_checked_out",
    "Database connections currently checked out, per engine.",
    ["engine"],
)
CONNECTION_UTILIZATION = Gauge(
    "lcfs_db_connection_utilization_ratio",
    "Checked out connections across all engines divided by the connection budget.",
)
CONNECTION_HOLD_SECONDS = Histogram(
    "lcfs_db_connection_hold_seconds",
    "How long a database connection was held before being returned.",
    ["engine"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 300.0),
)
LONG_CONNECTION_HOLDS_TOTAL = Counter(
    "lcfs_db_connection_long_holds_total",
    "Connections held longer than the configured warning threshold.",
    ["engine"],
)
HIGH_UTILIZATION_TOTAL = Counter(
    "lcfs_db_high_utilization_events_total",
    "Times connection utilization reached the configured warning ratio.",
)


class ConnectionTracker:
    """Thread-safe counter of checked-out connections across engines."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by_engine: Dict[str, int] = {}
        self._peak = 0
        self._total_checkouts = 0
        self._last_stats_log = time.monotonic()
        self._last_high_warn = 0.0

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return self._stats(sum(self._by_engine.values()))

    def _stats(self, total: int) -> Dict[str, Any]:
        """Usage figures. Caller holds the lock."""
        budget = max(settings.db_connection_budget, 1)
        return {
            "checked_out": total,
            "by_engine": dict(self._by_engine),
            "peak_in_interval": self._peak,
            "total_checkouts": self._total_checkouts,
            "budget": budget,
            "utilization": round(total / budget, 3),
        }

    def on_checkout(self, engine_name: str, connection_record) -> None:
        now = time.monotonic()
        budget = max(settings.db_connection_budget, 1)
        connection_record.info[_CHECKOUT_TS_KEY] = now
        connection_record.info[_CHECKOUT_ENGINE_KEY] = engine_name

        with self._lock:
            self._by_engine[engine_name] = self._by_engine.get(engine_name, 0) + 1
            self._total_checkouts += 1
            total = sum(self._by_engine.values())
            self._peak = max(self._peak, total)
            engine_count = self._by_engine[engine_name]
            utilization = total / budget
            should_warn = (
                utilization >= settings.db_pool_utilization_warn_ratio
                and now - self._last_high_warn >= HIGH_UTILIZATION_WARN_THROTTLE_SECONDS
            )
            if should_warn:
                self._last_high_warn = now
            stats = self._maybe_stats_report(now, total)

        CONNECTIONS_CHECKED_OUT.labels(engine_name).set(engine_count)
        CONNECTION_UTILIZATION.set(utilization)

        if should_warn:
            HIGH_UTILIZATION_TOTAL.inc()
            logger.warning(
                "Database connection utilization is high",
                checked_out=total,
                budget=budget,
                utilization=round(utilization, 3),
                warn_ratio=settings.db_pool_utilization_warn_ratio,
                engine=engine_name,
            )
        if stats:
            logger.info("Database connection stats", **stats)

    def on_checkin(self, connection_record) -> None:
        now = time.monotonic()
        started = connection_record.info.pop(_CHECKOUT_TS_KEY, None)
        engine_name = connection_record.info.pop(_CHECKOUT_ENGINE_KEY, None)
        if started is None or engine_name is None:
            return

        held = now - started
        budget = max(settings.db_connection_budget, 1)
        with self._lock:
            self._by_engine[engine_name] = max(
                self._by_engine.get(engine_name, 0) - 1, 0
            )
            total = sum(self._by_engine.values())
            engine_count = self._by_engine[engine_name]
            stats = self._maybe_stats_report(now, total)

        CONNECTIONS_CHECKED_OUT.labels(engine_name).set(engine_count)
        CONNECTION_UTILIZATION.set(total / budget)
        CONNECTION_HOLD_SECONDS.labels(engine_name).observe(held)

        if held >= settings.db_connection_hold_warn_seconds:
            LONG_CONNECTION_HOLDS_TOTAL.labels(engine_name).inc()
            logger.warning(
                "Database connection held for a long time",
                held_seconds=round(held, 2),
                threshold_seconds=settings.db_connection_hold_warn_seconds,
                engine=engine_name,
            )
        if stats:
            logger.info("Database connection stats", **stats)

    def _maybe_stats_report(self, now: float, total: int) -> Optional[Dict[str, Any]]:
        """Return the periodic stats payload when due. Caller holds the lock."""
        if now - self._last_stats_log < settings.db_pool_stats_log_interval_seconds:
            return None
        self._last_stats_log = now
        stats = self._stats(total)
        self._peak = total
        return stats


connection_tracker = ConnectionTracker()


def register_pool_monitor(target_engine: Engine, name: str) -> None:
    """Track connections on a sync engine (e.g. ``async_engine.sync_engine``)."""
    if not settings.db_pool_monitoring_enabled:
        return

    event.listen(
        target_engine,
        "checkout",
        lambda dbapi_conn, record, proxy: connection_tracker.on_checkout(name, record),
    )
    event.listen(
        target_engine,
        "checkin",
        lambda dbapi_conn, record: connection_tracker.on_checkin(record),
    )
