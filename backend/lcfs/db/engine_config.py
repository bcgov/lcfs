from typing import Any, Dict


def build_connect_args(statement_timeout_ms: int) -> Dict[str, Any]:
    """asyncpg connect args; a timeout > 0 is sent as a startup parameter."""
    connect_args: Dict[str, Any] = {
        "prepared_statement_cache_size": 0,
        "statement_cache_size": 0,
    }
    if statement_timeout_ms > 0:
        connect_args["server_settings"] = {
            "statement_timeout": str(int(statement_timeout_ms))
        }
    return connect_args
