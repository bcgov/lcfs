import time
from sqlalchemy import event
from sqlalchemy.engine import Engine
import structlog
from lcfs.logging_config import correlation_id_var

logger = structlog.get_logger('sqlalchemy')

SLOW_QUERY_TIME = 1.3  # Seconds

@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault("query_start_time", []).append(time.time())

@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total = time.time() - conn.info["query_start_time"].pop(-1)
    if total > SLOW_QUERY_TIME:
        logger.warning(
            "Slow query detected",
            query=statement,
            execution_time=total,
            parameters=parameters,
            transaction_id=id(conn),
            correlation_id=correlation_id_var.get(),
        )
