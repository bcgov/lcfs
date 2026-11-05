"""Work out what an uploaded file really is from its contents."""

import posixpath
from typing import Collection

import structlog

from lcfs.services.file_inspection.common import (
    CSV,
    EXTENSIONS,
    JPEG,
    MACROS_MESSAGE,
    MISMATCH_MESSAGE,
    PDF,
    PNG,
    TXT,
    WEBP,
    DetectedFile,
    FileRejectedException,
)
from lcfs.services.file_inspection.ole import OLE_MAGIC, inspect_ole
from lcfs.services.file_inspection.ooxml import inspect_ooxml

logger = structlog.get_logger(__name__)

ZIP_MAGIC = b"PK\x03\x04"
UTF16_BOMS = (b"\xff\xfe", b"\xfe\xff")
# PDF readers accept a short preamble before the header
PDF_HEADER_WINDOW = 1024


def detect_file_type(data: bytes, filename: str | None) -> DetectedFile:
    if b"%PDF-" in data[:PDF_HEADER_WINDOW]:
        return DetectedFile(PDF)
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return DetectedFile(PNG)
    if data.startswith(b"\xff\xd8\xff"):
        return DetectedFile(JPEG)
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return DetectedFile(WEBP)
    if data.startswith(OLE_MAGIC):
        return inspect_ole(data)
    if data.startswith(ZIP_MAGIC):
        return inspect_ooxml(data)
    if _is_text(data):
        return DetectedFile(CSV if file_extension(filename) == "csv" else TXT)
    raise FileRejectedException(MISMATCH_MESSAGE)


def inspect_upload(
    data: bytes,
    filename: str | None,
    allowed_types: Collection[str],
    allowed_description: str,
    macro_types: Collection[str] = (),
) -> DetectedFile:
    """
    Detect the file's real type and reject it unless it is an allowed type,
    has a matching extension and carries no macros. Files of `macro_types`
    may carry macros; the caller analyzes them.
    """
    try:
        detected = detect_file_type(data, filename)
        if detected.has_macros and detected.mime_type not in macro_types:
            raise FileRejectedException(MACROS_MESSAGE)
        if detected.mime_type not in allowed_types:
            raise FileRejectedException(
                "File type is not allowed. Please upload files of the "
                f"following types: {allowed_description}"
            )
        if file_extension(filename) not in EXTENSIONS[detected.mime_type]:
            raise FileRejectedException(MISMATCH_MESSAGE)
    except FileRejectedException as e:
        logger.warning("Upload rejected by file inspection", reason=e.detail)
        raise
    return detected


def file_extension(filename: str | None) -> str:
    return posixpath.splitext(filename or "")[1].lstrip(".").lower()


def _is_text(data: bytes) -> bool:
    if data.startswith(UTF16_BOMS):
        try:
            data.decode("utf-16")
            return True
        except UnicodeDecodeError:
            return False
    if b"\x00" in data:
        return False
    for encoding in ("utf-8", "cp1252"):
        try:
            data.decode(encoding)
            return True
        except UnicodeDecodeError:
            continue
    return False
