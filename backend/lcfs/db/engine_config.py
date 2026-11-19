from typing import Any, Dict

from sqlalchemy import event
from sqlalchemy.engine import Connection, Engine


def build_connect_args() -> Dict[str, Any]:
    """asyncpg connect args for the app and lifetime engines.

    Nothing is sent as a startup parameter (asyncpg ``server_settings``): the
    deployed environments connect through PgBouncer, which refuses startup
    parameters it does not track with ``unsupported startup parameter``. Use
    ``register_statement_timeout`` for the statement timeout instead.
    """
    return {
        "prepared_statement_cache_size": 0,
        "statement_cache_size": 0,
    }


def register_statement_timeout(engine: Engine, statement_timeout_ms: int) -> None:
    """Apply ``statement_timeout`` to every transaction ``engine`` begins.

    ``SET LOCAL`` lasts until that transaction commits or rolls back, the same
    unit PgBouncer's transaction pooling hands to a server connection, so the
    value never leaks to another client. It runs as the first statement of
    each transaction, so a later ``SET LOCAL`` in the same transaction (the
    export override in ``set_statement_timeout``) still wins.

    An explicit ``0`` disables the timeout; omitting it would inherit any
    server/database/role level statement_timeout.
    """
    sql = f"SET LOCAL statement_timeout = {max(int(statement_timeout_ms), 0)}"

    @event.listens_for(engine, "begin")
    def _set_statement_timeout(conn: Connection) -> None:
        conn.exec_driver_sql(sql)
