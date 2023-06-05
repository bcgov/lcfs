from typing import Optional

from pydantic import BaseModel


class User(BaseModel):
    """DTO for user values."""
    user_uuid: str
    user_idir: Optional[str]


class TokenData(BaseModel):
    username: str = None