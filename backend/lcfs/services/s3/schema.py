from lcfs.web.api.base import BaseSchema
from datetime import datetime


class FileResponseSchema(BaseSchema):
    document_id: int
    file_name: str
    file_size: int
    create_date: datetime | None = None
    create_user: str | None = None

    class Config:
        from_attributes = True


class UrlResponseSchema(BaseSchema):
    url: str
