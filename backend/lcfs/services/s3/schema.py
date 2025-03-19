from lcfs.web.api.base import BaseSchema


class FileResponseSchema(BaseSchema):
    document_id: int
    file_name: str
    file_size: int


class UrlResponseSchema(BaseSchema):
    url: str
