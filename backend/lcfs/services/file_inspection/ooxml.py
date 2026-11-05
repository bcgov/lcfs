"""Inspection of Office Open XML packages (.xlsx/.xlsm/.docx)."""

import posixpath
import zipfile
import zlib
from collections.abc import Iterator
from io import BytesIO
from typing import IO
from xml.etree.ElementTree import Element

import structlog
from defusedxml import DefusedXmlException
from defusedxml import ElementTree as ET

from lcfs.services.file_inspection.common import (
    DAMAGED_MESSAGE,
    DDE_MESSAGE,
    DOCM,
    DOCX,
    EXTERNAL_CONTENT_MESSAGE,
    MISMATCH_MESSAGE,
    STRICT_MESSAGE,
    XLSM,
    XLSX,
    DetectedFile,
    FileRejectedException,
)

logger = structlog.get_logger(__name__)

MAX_ENTRIES = 10_000
MAX_TOTAL_UNCOMPRESSED = 2 * 1024**3
# Ratio check only applies to entries big enough to matter
MAX_COMPRESSION_RATIO = 200
RATIO_CHECK_MIN_SIZE = 10 * 1024 * 1024
# Office only writes these. Older Python releases decompress a bzip2 or lzma
# chunk with no bound on its output.
ALLOWED_COMPRESSION = {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}
# Office XML nests a few dozen elements deep
MAX_XML_DEPTH = 256

# Raised while reading a damaged or hostile package
PACKAGE_ERRORS = (
    ET.ParseError,
    DefusedXmlException,
    zipfile.BadZipFile,
    zlib.error,
    EOFError,
    KeyError,
    # Encrypted zip entries and unsupported compression methods
    RuntimeError,
    NotImplementedError,
)

CT_NS = "{http://schemas.openxmlformats.org/package/2006/content-types}"
REL_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"
W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

# Relationship types and content types are compared in lower case
OFFICE_DOCUMENT_REL = (
    "http://schemas.openxmlformats.org/officedocument/2006/relationships/"
    "officedocument"
)
STRICT_OFFICE_DOCUMENT_REL = (
    "http://purl.oclc.org/ooxml/officedocument/relationships/officedocument"
)

MAIN_PART_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml": XLSX,
    "application/vnd.ms-excel.sheet.macroenabled.main+xml": XLSM,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml": DOCX,
    "application/vnd.ms-word.document.macroenabled.main+xml": DOCM,
}

# Parts that hold code or COM controls
ACTIVE_CONTENT_TYPES = {
    "application/vnd.ms-office.vbaproject",
    "application/vnd.ms-excel.macrosheet+xml",
    "application/vnd.ms-excel.intlmacrosheet+xml",
    "application/vnd.ms-office.activex+xml",
    "application/vnd.ms-office.activex",
}
ACTIVE_REL_SUFFIXES = (
    "/vbaproject",
    "/xlmacrosheet",
    "/xlintlmacrosheet",
    "/control",
    "/activexcontrolbinary",
)
# Relationships that make Office fetch or open something outside the file
BLOCKED_EXTERNAL_REL_SUFFIXES = (
    "/attachedtemplate",
    "/oleobject",
    "/frame",
    "/subdocument",
)

EXTERNAL_LINK_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.externallink+xml"
)
WORD_PART_PREFIX = "application/vnd.openxmlformats-officedocument.wordprocessingml."
DDE_FIELDS = {"DDE", "DDEAUTO"}


def inspect_ooxml(data: bytes) -> DetectedFile:
    try:
        package = zipfile.ZipFile(BytesIO(data))
    except (zipfile.BadZipFile, ValueError) as e:
        raise FileRejectedException(DAMAGED_MESSAGE) from e

    with package:
        try:
            return _inspect_package(package)
        except PACKAGE_ERRORS as e:
            logger.warning("Could not parse OOXML package", error=str(e))
            raise FileRejectedException(DAMAGED_MESSAGE) from e


def _inspect_package(package: zipfile.ZipFile) -> DetectedFile:
    parts = _check_entries(package.infolist())
    content_types = _ContentTypes(package, parts)
    relationships = {
        name: _read_relationships(package, info)
        for name, info in parts.items()
        if name.endswith(".rels")
    }

    main_part = _main_part(relationships.get("_rels/.rels", []))
    if main_part not in parts:
        raise FileRejectedException(DAMAGED_MESSAGE)
    mime_type = MAIN_PART_TYPES.get(content_types.of(main_part))
    if mime_type is None:
        raise FileRejectedException(MISMATCH_MESSAGE)

    has_macros = any(content_types.of(name) in ACTIVE_CONTENT_TYPES for name in parts)
    for source, rels in relationships.items():
        for rel_type, target, external in rels:
            if external and rel_type.endswith(BLOCKED_EXTERNAL_REL_SUFFIXES):
                logger.warning(
                    "Rejected external relationship", source=source, type=rel_type
                )
                raise FileRejectedException(EXTERNAL_CONTENT_MESSAGE)
            if not external and rel_type.endswith(ACTIVE_REL_SUFFIXES):
                has_macros = True

    for name, info in parts.items():
        part_type = content_types.of(name)
        if part_type == EXTERNAL_LINK_TYPE and _has_dde_link(package, info):
            raise FileRejectedException(DDE_MESSAGE)
        if (
            mime_type in (DOCX, DOCM)
            and part_type.startswith(WORD_PART_PREFIX)
            and part_type.endswith("+xml")
            and _has_dde_field(package, info)
        ):
            raise FileRejectedException(DDE_MESSAGE)

    return DetectedFile(mime_type, has_macros=has_macros)


def _check_entries(infos: list[zipfile.ZipInfo]) -> dict[str, zipfile.ZipInfo]:
    """Reject zip bombs and unsafe names. Returns entries keyed by lower-case name."""
    if len(infos) > MAX_ENTRIES:
        raise FileRejectedException(DAMAGED_MESSAGE)
    if sum(info.file_size for info in infos) > MAX_TOTAL_UNCOMPRESSED:
        raise FileRejectedException(DAMAGED_MESSAGE)

    parts = {}
    for info in infos:
        name = info.filename
        if (
            name.startswith("/")
            or "\\" in name
            or ".." in name.split("/")
            or name.lower() in parts
            or info.compress_type not in ALLOWED_COMPRESSION
        ):
            raise FileRejectedException(DAMAGED_MESSAGE)
        if (
            info.file_size > RATIO_CHECK_MIN_SIZE
            and info.file_size > MAX_COMPRESSION_RATIO * max(info.compress_size, 1)
        ):
            raise FileRejectedException(DAMAGED_MESSAGE)
        parts[name.lower()] = info
    return parts


def iter_elements(stream: IO[bytes]) -> Iterator[Element]:
    """
    Parse a part as a stream and yield each element as it ends, then drop it
    from its parent. Clearing an element still leaves it attached, so a part
    made of millions of tiny elements would otherwise be held in memory
    whole, at many times its size. The root element comes last.
    """
    open_elements = []
    for event, el in ET.iterparse(stream, events=("start", "end")):
        if event == "start":
            open_elements.append(el)
            if len(open_elements) > MAX_XML_DEPTH:
                raise FileRejectedException(DAMAGED_MESSAGE)
            continue
        open_elements.pop()
        yield el
        if open_elements:
            # The element that just ended is always its parent's last child
            del open_elements[-1][-1]


class _ContentTypes:
    def __init__(self, package: zipfile.ZipFile, parts: dict[str, zipfile.ZipInfo]):
        info = parts.get("[content_types].xml")
        if info is None:
            raise FileRejectedException(MISMATCH_MESSAGE)
        self.defaults = {}
        self.overrides = {}
        with package.open(info) as stream:
            for el in iter_elements(stream):
                content_type = el.get("ContentType", "").lower()
                if el.tag == f"{CT_NS}Default":
                    self.defaults[el.get("Extension", "").lower()] = content_type
                elif el.tag == f"{CT_NS}Override":
                    part_name = el.get("PartName", "").lstrip("/").lower()
                    self.overrides[part_name] = content_type
                root = el
        # The root ends last. An empty part never gets here: the parser
        # raises first.
        if root.tag != f"{CT_NS}Types":
            raise FileRejectedException(STRICT_MESSAGE)

    def of(self, part_name: str) -> str:
        if part_name in self.overrides:
            return self.overrides[part_name]
        return self.defaults.get(posixpath.splitext(part_name)[1].lstrip("."), "")


def _read_relationships(
    package: zipfile.ZipFile, info: zipfile.ZipInfo
) -> list[tuple[str, str, bool]]:
    """Returns (lower-case type, resolved lower-case target, is_external)."""
    # "word/_rels/document.xml.rels" describes "word/document.xml"
    source_dir = posixpath.dirname(posixpath.dirname(info.filename))
    rels = []
    with package.open(info) as stream:
        for el in iter_elements(stream):
            if el.tag != f"{REL_NS}Relationship":
                continue
            external = el.get("TargetMode", "").lower() == "external"
            target = el.get("Target", "")
            if not external:
                if target.startswith("/"):
                    target = target.lstrip("/")
                else:
                    target = posixpath.normpath(posixpath.join(source_dir, target))
            rels.append((el.get("Type", "").lower(), target.lower(), external))
    return rels


def _main_part(root_rels: list[tuple[str, str, bool]]) -> str:
    for rel_type, target, external in root_rels:
        if rel_type == STRICT_OFFICE_DOCUMENT_REL:
            raise FileRejectedException(STRICT_MESSAGE)
        if rel_type == OFFICE_DOCUMENT_REL and not external:
            return target
    raise FileRejectedException(MISMATCH_MESSAGE)


def _has_dde_link(package: zipfile.ZipFile, info: zipfile.ZipInfo) -> bool:
    with package.open(info) as stream:
        return any(
            el.tag.endswith("}ddeLink") or el.tag.endswith("}oleLink")
            for el in iter_elements(stream)
        )


def _has_dde_field(package: zipfile.ZipFile, info: zipfile.ZipInfo) -> bool:
    """
    Look for DDE field codes. A field's instruction can be split across many
    w:instrText runs between its begin and separate/end markers.
    """
    stack: list[list[str] | None] = []
    with package.open(info) as stream:
        for el in iter_elements(stream):
            if el.tag == f"{W_NS}fldChar":
                kind = el.get(f"{W_NS}fldCharType")
                if kind == "begin":
                    stack.append([])
                elif kind in ("separate", "end") and stack:
                    instruction = stack[-1]
                    if instruction is not None and _is_dde("".join(instruction)):
                        return True
                    if kind == "separate":
                        stack[-1] = None
                    else:
                        stack.pop()
            elif el.tag == f"{W_NS}instrText" and stack and stack[-1] is not None:
                stack[-1].append(el.text or "")
            elif el.tag == f"{W_NS}fldSimple" and _is_dde(el.get(f"{W_NS}instr", "")):
                return True
    return False


def _is_dde(instruction: str) -> bool:
    words = instruction.strip().split(None, 1)
    return bool(words) and words[0].strip('"').upper() in DDE_FIELDS
