from dataclasses import dataclass

from lcfs.services.clamav.client import FileScanException

PDF = "application/pdf"
PNG = "image/png"
JPEG = "image/jpeg"
WEBP = "image/webp"
DOC = "application/msword"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
DOCM = "application/vnd.ms-word.document.macroEnabled.12"
XLS = "application/vnd.ms-excel"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
XLSM = "application/vnd.ms-excel.sheet.macroEnabled.12"
CSV = "text/csv"
TXT = "text/plain"

# File extensions that may carry each detected type
EXTENSIONS = {
    PDF: {"pdf"},
    PNG: {"png"},
    JPEG: {"jpg", "jpeg"},
    WEBP: {"webp"},
    DOC: {"doc"},
    DOCX: {"docx"},
    DOCM: {"docm"},
    XLS: {"xls"},
    XLSX: {"xlsx"},
    XLSM: {"xlsm"},
    CSV: {"csv"},
    TXT: {"txt", "log"},
}

MACROS_MESSAGE = (
    "This file contains macros, which can't be uploaded here. Save it as "
    ".xlsx or .docx without macros and upload it again."
)
ENCRYPTED_MESSAGE = (
    "Password-protected files can't be checked for viruses. Remove the "
    "password and upload the file again."
)
MISMATCH_MESSAGE = (
    "This file's contents don't match its file type. Save it in a supported "
    "format and upload it again."
)
DAMAGED_MESSAGE = (
    "This file appears to be damaged and can't be checked. Save it again and "
    "upload the new copy."
)
STRICT_MESSAGE = (
    "Strict Open XML files aren't supported. Save the file as a regular Excel "
    "or Word file and upload it again."
)
DDE_MESSAGE = (
    "This file contains links that can run commands (DDE) and can't be "
    "uploaded. Remove them and upload the file again."
)
EXTERNAL_CONTENT_MESSAGE = (
    "This file loads content from outside the document, such as a remote "
    "template, and can't be uploaded. Remove the link and upload it again."
)


class FileRejectedException(FileScanException):
    """The file's contents failed inspection."""

    status_code = 400

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


@dataclass(frozen=True)
class DetectedFile:
    mime_type: str
    # VBA, Excel 4.0 macro sheets or ActiveX controls
    has_macros: bool = False
    # Package part names, for macro analysis of .xlsm workbooks
    vba_parts: tuple[str, ...] = ()
    macro_sheet_parts: tuple[str, ...] = ()
    has_activex: bool = False
