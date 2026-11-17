from typing import Any, Dict


def build_connect_args(statement_timeout_ms: int) -> Dict[str, Any]:
    """asyncpg connect args; the timeout is always sent as a startup parameter."""
    # An explicit "0" disables the timeout; omitting it would inherit any
    # server/database/role level statement_timeout.
    return {
        "prepared_statement_cache_size": 0,
        "statement_cache_size": 0,
        "server_settings": {
            "statement_timeout": str(max(int(statement_timeout_ms), 0))
        },
    }
