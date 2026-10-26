"""Inspection of Office Open XML packages (.xlsx/.xlsm/.docx)."""

import posixpath
import zipfile
import zlib
from io import BytesIO

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

# Parts that hold code or COM controls, by content type and by relationship
VBA = "vba"
MACRO_SHEET = "macro_sheet"
ACTIVEX = "activex"
ACTIVE_CONTENT_TYPES = {
    "application/vnd.ms-office.vbaproject": VBA,
    "application/vnd.ms-excel.macrosheet+xml": MACRO_SHEET,
    "application/vnd.ms-excel.intlmacrosheet+xml": MACRO_SHEET,
    "application/vnd.ms-office.activex+xml": ACTIVEX,
    "application/vnd.ms-office.activex": ACTIVEX,
}
ACTIVE_REL_SUFFIXES = {
    "/vbaproject": VBA,
    "/xlmacrosheet": MACRO_SHEET,
    "/xlintlmacrosheet": MACRO_SHEET,
    "/control": ACTIVEX,
    "/activexcontrolbinary": ACTIVEX,
}
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
        except (
            ET.ParseError,
            DefusedXmlException,
            zipfile.BadZipFile,
            zlib.error,
            EOFError,
            KeyError,
            # Encrypted zip entries and unsupported compression methods
            RuntimeError,
            NotImplementedError,
        ) as e:
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

    # Excel loads code from whatever part the relationship or content type
    # names, so never go by file name
    active: dict[str, set[str]] = {VBA: set(), MACRO_SHEET: set(), ACTIVEX: set()}
    for name in parts:
        kind = ACTIVE_CONTENT_TYPES.get(content_types.of(name))
        if kind:
            active[kind].add(name)
    for source, rels in relationships.items():
        for rel_type, target, external in rels:
            if external and rel_type.endswith(BLOCKED_EXTERNAL_REL_SUFFIXES):
                logger.warning(
                    "Rejected external relationship", source=source, type=rel_type
                )
                raise FileRejectedException(EXTERNAL_CONTENT_MESSAGE)
            if not external:
                kind = _active_kind(rel_type)
                if kind:
                    active[kind].add(target)

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

    def present(kind):
        return tuple(
            sorted(parts[name].filename for name in active[kind] if name in parts)
        )

    return DetectedFile(
        mime_type,
        has_macros=any(active.values()),
        vba_parts=present(VBA),
        macro_sheet_parts=present(MACRO_SHEET),
        has_activex=bool(active[ACTIVEX]),
    )


def _active_kind(rel_type: str) -> str | None:
    for suffix, kind in ACTIVE_REL_SUFFIXES.items():
        if rel_type.endswith(suffix):
            return kind
    return None


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
        ):
            raise FileRejectedException(DAMAGED_MESSAGE)
        if (
            info.file_size > RATIO_CHECK_MIN_SIZE
            and info.file_size > MAX_COMPRESSION_RATIO * max(info.compress_size, 1)
        ):
            raise FileRejectedException(DAMAGED_MESSAGE)
        parts[name.lower()] = info
    return parts


class _ContentTypes:
    def __init__(self, package: zipfile.ZipFile, parts: dict[str, zipfile.ZipInfo]):
        info = parts.get("[content_types].xml")
        if info is None:
            raise FileRejectedException(MISMATCH_MESSAGE)
        root = ET.fromstring(package.read(info))
        if root.tag != f"{CT_NS}Types":
            raise FileRejectedException(STRICT_MESSAGE)
        self.defaults = {
            el.get("Extension", "").lower(): el.get("ContentType", "").lower()
            for el in root.iter(f"{CT_NS}Default")
        }
        self.overrides = {
            el.get("PartName", "")
            .lstrip("/")
            .lower(): el.get("ContentType", "")
            .lower()
            for el in root.iter(f"{CT_NS}Override")
        }

    def of(self, part_name: str) -> str:
        if part_name in self.overrides:
            return self.overrides[part_name]
        return self.defaults.get(posixpath.splitext(part_name)[1].lstrip("."), "")


def _read_relationships(
    package: zipfile.ZipFile, info: zipfile.ZipInfo
) -> list[tuple[str, str, bool]]:
    """Returns (lower-case type, resolved lower-case target, is_external)."""
    root = ET.fromstring(package.read(info))
    # "word/_rels/document.xml.rels" describes "word/document.xml"
    source_dir = posixpath.dirname(posixpath.dirname(info.filename))
    rels = []
    for el in root.iter(f"{REL_NS}Relationship"):
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
    root = ET.fromstring(package.read(info))
    return any(
        el.tag.endswith("}ddeLink") or el.tag.endswith("}oleLink") for el in root.iter()
    )


def _has_dde_field(package: zipfile.ZipFile, info: zipfile.ZipInfo) -> bool:
    """
    Look for DDE field codes. A field's instruction can be split across many
    w:instrText runs between its begin and separate/end markers.
    """
    stack: list[list[str] | None] = []
    with package.open(info) as stream:
        for _, el in ET.iterparse(stream, events=("end",)):
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
            el.clear()
    return False


def _is_dde(instruction: str) -> bool:
    words = instruction.strip().split(None, 1)
    return bool(words) and words[0].strip('"').upper() in DDE_FIELDS
