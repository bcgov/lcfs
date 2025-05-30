from enum import Enum
from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.utils.spreadsheet_builder import SpreadsheetColumn


class LCFS_Constants:
    EXCEL_MEDIA_TYPE = "application/vnd.ms-excel"
    USERS_EXPORT_FILENAME = "BC-LCFS-BCeID-Users"
    USERS_EXPORT_SHEETNAME = "BCeID Users"
    USERS_EXPORT_COLUMNS = [
        SpreadsheetColumn("Last name", "text"),
        SpreadsheetColumn("First name", "text"),
        SpreadsheetColumn("Email", "text"),
        SpreadsheetColumn("BCeID User ID", "text"),
        SpreadsheetColumn("Title", "text"),
        SpreadsheetColumn("Phone", "text"),
        SpreadsheetColumn("Mobile", "text"),
        SpreadsheetColumn("Status", "text"),
        SpreadsheetColumn("Role(s)", "text"),
        SpreadsheetColumn("Organization name", "text"),
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
        SpreadsheetColumn("ID", "int"),
        SpreadsheetColumn("Compliance period", "text"),
        SpreadsheetColumn("Type", "text"),
        SpreadsheetColumn("Compliance units from", "int"),
        SpreadsheetColumn("Compliance units to", "int"),
        SpreadsheetColumn("Number of units", "int"),
        SpreadsheetColumn("Value per unit", "float"),
        SpreadsheetColumn("Category", "text"),
        SpreadsheetColumn("Status", "text"),
        SpreadsheetColumn("Effective Date", "date"),
        SpreadsheetColumn("Recorded", "date"),
        SpreadsheetColumn("Approved", "date"),
        SpreadsheetColumn("From Org Comment", "text"),
        SpreadsheetColumn("To Org Comment", "text"),
        SpreadsheetColumn("Government Comment", "text"),
    ]
    TRANSACTIONS_EXPORT_SHEETNAME = "Transactions"
    TRANSACTIONS_EXPORT_FILENAME = "BC-LCFS-transactions"
    LEGISLATION_TRANSITION_YEAR = (
        "2024"  # First year that the new LCFS Legislation takes effect
    )

    # Export credit ledger
    CREDIT_LEDGER_EXPORT_MEDIA_TYPE = "application/vnd.ms-excel"
    CREDIT_LEDGER_EXPORT_COLUMNS = [
        SpreadsheetColumn("Compliance year", "int"),
        SpreadsheetColumn("Available balance", "int"),
        SpreadsheetColumn("Compliance units", "int"),
        SpreadsheetColumn("Transaction type", "text"),
        SpreadsheetColumn("Transaction date", "date"),
    ]
    CREDIT_LEDGER_EXPORT_SHEETNAME = "Credit ledger"
    CREDIT_LEDGER_EXPORT_FILENAME = "Credit-ledger"


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
    "ComplianceReport": "CR",
}

id_prefix_to_transaction_type_map = {
    "CT": "Transfer",
    "AA": "AdminAdjustment",
    "IA": "InitiativeAgreement",
    "CR": "ComplianceReport",
}
FUEL_CATEGORIES = ["Diesel", "Gasoline", "Jet fuel"]

POSTAL_REGEX = r"^[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d$"


ALLOWED_MIME_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]
ALLOWED_FILE_TYPES = (
    "PDF, PNG, JPG/JPEG, Word Documents (.doc/.docx), Excel Spreadsheets (.xls/.xlsx)"
)
