"""Inspection of legacy Office files (.xls/.doc) stored as OLE compound files."""

import struct

import olefile
import structlog

from lcfs.services.file_inspection.common import (
    DAMAGED_MESSAGE,
    DOC,
    ENCRYPTED_MESSAGE,
    MISMATCH_MESSAGE,
    XLS,
    DetectedFile,
    FileRejectedException,
)

logger = structlog.get_logger(__name__)

OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

BIFF_EOF = 0x000A
BIFF_FILEPASS = 0x002F
BIFF_BOUNDSHEET = 0x0085
# BoundSheet8.dt: 1 = Excel 4.0 macro sheet, 6 = VBA module (BIFF5)
MACRO_SHEET_TYPES = {1, 6}

WORD_FIB_FLAGS_OFFSET = 0x0A
WORD_FIB_ENCRYPTED = 0x0100


def inspect_ole(data: bytes) -> DetectedFile:
    if len(data) < olefile.MINIMAL_OLEFILE_SIZE:
        raise FileRejectedException(DAMAGED_MESSAGE)
    try:
        ole = olefile.OleFileIO(data)
    except Exception as e:
        logger.warning("Could not parse OLE file", error=str(e))
        raise FileRejectedException(DAMAGED_MESSAGE) from e

    with ole:
        top_level = {
            path[0].lower() for path in ole.listdir(streams=True, storages=True) if path
        }

        # An encrypted .xlsx/.docx is wrapped in an OLE container
        if {"encryptedpackage", "encryptioninfo"} & top_level:
            raise FileRejectedException(ENCRYPTED_MESSAGE)

        if {"workbook", "book"} & top_level:
            name = "Workbook" if "workbook" in top_level else "Book"
            encrypted, macro_sheets = _scan_biff_globals(ole.openstream(name).read())
            if encrypted:
                raise FileRejectedException(ENCRYPTED_MESSAGE)
            return DetectedFile(
                XLS, has_macros="_vba_project_cur" in top_level or macro_sheets
            )

        if "worddocument" in top_level:
            fib = ole.openstream("WordDocument").read(WORD_FIB_FLAGS_OFFSET + 2)
            if len(fib) < WORD_FIB_FLAGS_OFFSET + 2:
                raise FileRejectedException(DAMAGED_MESSAGE)
            (flags,) = struct.unpack_from("<H", fib, WORD_FIB_FLAGS_OFFSET)
            if flags & WORD_FIB_ENCRYPTED:
                raise FileRejectedException(ENCRYPTED_MESSAGE)
            return DetectedFile(DOC, has_macros="macros" in top_level)

    # Some other OLE file, such as .ppt or .msg
    raise FileRejectedException(MISMATCH_MESSAGE)


def _scan_biff_globals(stream: bytes) -> tuple[bool, bool]:
    """
    Walk the workbook globals substream. Returns (encrypted, has_macro_sheets).
    """
    encrypted = False
    macro_sheets = False
    pos = 0
    while pos + 4 <= len(stream):
        record_type, length = struct.unpack_from("<HH", stream, pos)
        body = stream[pos + 4 : pos + 4 + length]
        pos += 4 + length
        if record_type == BIFF_FILEPASS:
            encrypted = True
        elif (
            record_type == BIFF_BOUNDSHEET
            and len(body) >= 6
            and body[5] in MACRO_SHEET_TYPES
        ):
            macro_sheets = True
        elif record_type == BIFF_EOF:
            break
    return encrypted, macro_sheets
