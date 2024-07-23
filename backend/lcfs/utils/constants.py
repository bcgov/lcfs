from enum import Enum
from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum


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
        TransferStatusEnum.Rescinded.value,
    ]
    GOV_TRANSFER_STATUSES = [
        TransferStatusEnum.Submitted.value, # To handle the save comment feature
        TransferStatusEnum.Recommended.value,
        TransferStatusEnum.Refused.value,
        TransferStatusEnum.Recorded.value
    ]

    # Export transactions
    TRANSACTIONS_EXPORT_MEDIA_TYPE = "application/vnd.ms-excel"
    TRANSACTIONS_EXPORT_COLUMNS = [
        "ID",
        "Compliance period",
        "Type",
        "Compliance units from",
        "Compliance units to",
        "Number of units",
        "Value per unit",
        "Category",
        "Status",
        "Effective Date",
        "Recorded",
        "Approved",
        "Comments (external)"
    ]
    TRANSACTIONS_EXPORT_SHEETNAME = "Transactions"
    TRANSACTIONS_EXPORT_FILENAME = "BC-LCFS-transactions"


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
