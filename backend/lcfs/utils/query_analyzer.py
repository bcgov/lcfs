import time
from typing import Optional

import structlog
from prometheus_client import Counter, Histogram
from sqlalchemy import event
from sqlalchemy.engine import Engine

from lcfs.logging_config import correlation_id_var
from lcfs.settings import settings

logger = structlog.get_logger("sqlalchemy")

# SQLSTATE query_canceled, raised when statement_timeout fires.
QUERY_CANCELED_SQLSTATE = "57014"

SLOW_QUERIES_TOTAL = Counter(
    "lcfs_db_slow_queries_total",
    "Number of database statements that exceeded the slow query threshold.",
    ["engine"],
)
STATEMENT_TIMEOUTS_TOTAL = Counter(
    "lcfs_db_statement_timeouts_total",
    "Number of database statements cancelled by PostgreSQL statement_timeout.",
    ["engine"],
)
QUERY_DURATION_SECONDS = Histogram(
    "lcfs_db_query_duration_seconds",
    "Database statement execution time in seconds.",
    ["engine"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 300.0),
)


def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault("query_start_time", []).append(time.perf_counter())


def _pop_elapsed(conn) -> Optional[float]:
    starts = conn.info.get("query_start_time") if conn is not None else None
    if not starts:
        return None
    return time.perf_counter() - starts.pop(-1)


def _is_statement_timeout(exc: Optional[BaseException]) -> bool:
    """True if ``exc`` or its cause chain is a statement_timeout cancellation."""
    seen = 0
    while exc is not None and seen < 5:
        sqlstate = getattr(exc, "sqlstate", None) or getattr(exc, "pgcode", None)
        # The SQLSTATE is shared with user cancellations (e.g. a dropped request),
        # so the message tells them apart.
        if sqlstate == QUERY_CANCELED_SQLSTATE and "statement timeout" in str(exc):
            return True
        exc = exc.__cause__ or exc.__context__
        seen += 1
    return False


def _make_after_cursor_execute(engine_name: str):
    def _after_cursor_execute(
        conn, cursor, statement, parameters, context, executemany
    ):
        total = _pop_elapsed(conn)
        if total is None:
            return
        QUERY_DURATION_SECONDS.labels(engine_name).observe(total)
        if total > settings.db_slow_query_threshold_seconds:
            SLOW_QUERIES_TOTAL.labels(engine_name).inc()
            logger.warning(
                "Slow query detected",
                query=statement,
                execution_time=total,
                parameters=parameters,
                transaction_id=id(conn),
                correlation_id=correlation_id_var.get(),
                engine=engine_name,
            )

    return _after_cursor_execute


def _make_handle_error(engine_name: str):
    def _handle_error(exception_context):
        # Failed statements never reach after_cursor_execute, so timeouts are
        # logged here.
        conn = exception_context.connection
        elapsed = _pop_elapsed(conn)
        if not _is_statement_timeout(exception_context.original_exception):
            return
        STATEMENT_TIMEOUTS_TOTAL.labels(engine_name).inc()
        logger.error(
            "Query cancelled by statement_timeout",
            # No bound parameters: they may contain personal data.
            query=exception_context.statement,
            execution_time=elapsed,
            transaction_id=id(conn) if conn is not None else None,
            correlation_id=correlation_id_var.get(),
            engine=engine_name,
        )

    return _handle_error


def register_query_analyzer(target_engine: Engine, name: str = "app"):
    """Registers slow query and statement timeout logging on the engine."""
    event.listen(target_engine, "before_cursor_execute", _before_cursor_execute)
    event.listen(
        target_engine, "after_cursor_execute", _make_after_cursor_execute(name)
    )
    event.listen(target_engine, "handle_error", _make_handle_error(name))
