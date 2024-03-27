from enum import Enum
from lcfs.db.models.TransferStatus import TransferStatusEnum


class LCFS_Constants:
    MEDIA_TYPE = "application/vnd.ms-excel"
    USERS_EXPORT_COLUMNS = [
        "Last name",
        "First name",
        "Email",
        "BCeID User ID",
        "Title",
        "Phone",
        "Mobile",
        "Status",
        "Role(s)",
        "Organization name",
    ]
    USERS_EXPORT_SHEETNAME = "BCeID Users"
    USERS_EXPORT_FILENAME = "BC-LCFS-BCeID-Users"
    FROM_ORG_TRANSFER_STATUSES = [
        TransferStatusEnum.Draft.value,
        TransferStatusEnum.Sent.value,
        TransferStatusEnum.Rescinded.value,
        TransferStatusEnum.Deleted.value,
    ]
    TO_ORG_TRANSFER_STATUSES = [
        TransferStatusEnum.Submitted.value,
        TransferStatusEnum.Declined.value,
    ]
    GOV_TRANSFER_STATUSES = [
        TransferStatusEnum.Recommended.value,
        TransferStatusEnum.Refused.value,
        TransferStatusEnum.Recorded.value
    ]


class FILE_MEDIA_TYPE(Enum):
    PDF = "application/pdf"
    DOC = "application/msword"
    DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    XLS = "application/vnd.ms-excel"
    XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    CSV = "text/csv"
    TXT = "text/plain"
    JSON = "application/json"
    XML = "application/xml"
    ZIP = "application/zip"
