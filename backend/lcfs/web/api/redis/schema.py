from typing import Optional

from lcfs.web.api.base import BaseSchema


class RedisValueDTO(BaseSchema):
    """DTO for redis values."""

    key: str
    value: Optional[str] = None  # noqa: WPS110
