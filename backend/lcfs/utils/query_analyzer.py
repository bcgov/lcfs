import logging
import time

from sqlalchemy import event
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

SLOW_QUERY_TIME = 1.3  # Seconds


@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault("query_start_time", []).append(time.time())


@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total = time.time() - conn.info["query_start_time"].pop(-1)
    if total > SLOW_QUERY_TIME:
        logger.warning(
            f"Slow Query Detected:\n"
            f"Query: {statement}\n"
            f"Execution Time: {total:.2f} seconds\n"
            f"Parameters: {parameters}\n"
            f"Transaction ID: {id(conn)}\n"
        )
