from typing import Optional
from datetime import datetime
from pydantic import ConfigDict

from lcfs.web.api.base import BaseSchema


class LoginBgImageSchema(BaseSchema):
    """Schema for login background image response."""

    model_config = ConfigDict(from_attributes=True)

    login_bg_image_id: int
    image_key: str
    file_name: str
    display_name: str
    caption: Optional[str] = None
    is_active: bool
    create_date: Optional[datetime] = None
    update_date: Optional[datetime] = None
    create_user: Optional[str] = None
    update_user: Optional[str] = None


class LoginBgImageUpdateSchema(BaseSchema):
    """Schema for updating login background image metadata."""

    model_config = ConfigDict(from_attributes=True)

    display_name: str
    caption: Optional[str] = None
