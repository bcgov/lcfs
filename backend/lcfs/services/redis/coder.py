"""FastAPI cache coder for Redis clients configured with decoded responses."""

from typing import Any

from fastapi_cache.coder import JsonCoder


class RedisJsonCoder(JsonCoder):
    """Allow the cache backend to decode bytes or UTF-8 strings from Redis."""

    @classmethod
    def decode(cls, value: bytes | str) -> Any:
        if isinstance(value, str):
            value = value.encode("utf-8")
        return super().decode(value)
