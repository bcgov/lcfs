from enum import Enum
from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum


class LCFS_Constants:
    EXCEL_MEDIA_TYPE = "application/vnd.ms-excel"
    USERS_EXPORT_FILENAME = "BC-LCFS-BCeID-Users"
    USERS_EXPORT_SHEETNAME = "BCeID Users"
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
    FROM_ORG_TRANSFER_STATUSES = [
        TransferStatusEnum.Draft,
        TransferStatusEnum.Sent,
        TransferStatusEnum.Rescinded,
        TransferStatusEnum.Deleted,
    ]
    TO_ORG_TRANSFER_STATUSES = [
        TransferStatusEnum.Submitted,
        TransferStatusEnum.Declined,
        TransferStatusEnum.Rescinded,
    ]
    GOV_TRANSFER_STATUSES = [
        TransferStatusEnum.Submitted,  # To handle the save comment feature
        TransferStatusEnum.Recommended,
        TransferStatusEnum.Refused,
        TransferStatusEnum.Recorded,
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
        "Comments (external)",
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


transaction_type_to_id_prefix_map = {
    "Transfer": "CT",
    "AdminAdjustment": "AA",
    "InitiativeAgreement": "IA",
}

id_prefix_to_transaction_type_map = {
    "CT": "Transfer",
    "AA": "AdminAdjustment",
    "IA": "InitiativeAgreement",
}

default_ci = {"Gasoline": 93.67, "Diesel": 100.21, "Jet fuel": 88.83}


RENEWABLE_FUEL_TYPES = [
    "Renewable gasoline",
    "Ethanol",
    "Renewable naphtha",
    "Biodiesel",
    "HDRD",
    "Other diesel",
    "Alternative jet fuel",
    "Other"
]
