from lcfs.web.api.base import BaseSchema
from datetime import datetime


class FileResponseSchema(BaseSchema):
    document_id: int
    file_name: str
    file_size: int
    create_date: datetime | None = None
    create_user: str | None = None
    # Step 3 categorisation; only populated for ci_application uploads.
    document_category: str | None = None
    display_name: str | None = None
    # Code of the uploading user's organization; None for government
    # (IDIR) uploads. Populated by the document list endpoint only.
    uploading_organization_code: str | None = None

    class Config:
        from_attributes = True


class DocumentRenameSchema(BaseSchema):
    display_name: str


class UrlResponseSchema(BaseSchema):
    url: str
