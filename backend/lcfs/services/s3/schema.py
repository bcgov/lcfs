from typing import Literal

from lcfs.db.models.document.Document import DocumentScanStatusEnum
from lcfs.db.models.user.Role import RoleEnum
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
    # Macro review; findings are only sent to government users (see for_viewer)
    scan_status: DocumentScanStatusEnum | None = None
    scan_findings: list[str] | None = None

    class Config:
        from_attributes = True

    def for_viewer(self, user) -> "FileResponseSchema":
        """Drop the macro findings unless the viewer is government staff."""
        if user is not None and RoleEnum.GOVERNMENT in user.role_names:
            return self
        return self.model_copy(update={"scan_findings": None})


class DocumentRenameSchema(BaseSchema):
    display_name: str


class DocumentScanReviewSchema(BaseSchema):
    decision: Literal["approve", "reject"]


class UrlResponseSchema(BaseSchema):
    url: str
