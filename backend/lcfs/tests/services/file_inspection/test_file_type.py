import io
import struct
import zipfile

import olefile
import pytest

from lcfs.services.file_inspection import (
    FileRejectedException,
    detect_file_type,
    inspect_upload,
)
from lcfs.services.file_inspection import ole as ole_module
from lcfs.services.file_inspection import ooxml as ooxml_module
from lcfs.services.file_inspection.common import (
    CSV,
    DOC,
    DOCX,
    JPEG,
    PDF,
    PNG,
    TXT,
    XLS,
    XLSM,
    XLSX,
)
from lcfs.tests.services.file_inspection.builders import (
    docx_bytes,
    rewrite_zip,
    xls_bytes,
    xlsx_bytes,
)
from lcfs.utils.constants import ALLOWED_FILE_TYPES, ALLOWED_MIME_TYPES

REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def inspect(data, filename):
    return inspect_upload(data, filename, ALLOWED_MIME_TYPES, ALLOWED_FILE_TYPES)


def rejected(data, filename):
    with pytest.raises(FileRejectedException) as exc_info:
        inspect(data, filename)
    assert exc_info.value.status_code == 400
    return exc_info.value.detail


def add_relationship(rels_xml: bytes, rel_type: str, target: str, external=False):
    mode = ' TargetMode="External"' if external else ""
    rel = f'<Relationship Id="rIdTest" Type="{rel_type}" Target="{target}"{mode}/>'
    if rels_xml:
        return rels_xml.replace(b"</Relationships>", rel.encode() + b"</Relationships>")
    return (
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/'
        f'package/2006/relationships">{rel}</Relationships>'
    ).encode()


def add_content_type(types_xml: bytes, element: str):
    return types_xml.replace(b"</Types>", element.encode() + b"</Types>")


# --- Allowed files -----------------------------------------------------------


@pytest.mark.parametrize(
    "data, filename, expected",
    [
        (xlsx_bytes(), "model.xlsx", XLSX),
        (docx_bytes(), "report.docx", DOCX),
        (xls_bytes(), "old.xls", XLS),
        (b"%PDF-1.7\n%...", "letter.pdf", PDF),
        (b"\x00\x00junk before header %PDF-1.4\n", "preamble.pdf", PDF),
        (b"\x89PNG\r\n\x1a\nrest", "chart.png", PNG),
        (b"\xff\xd8\xff\xe0rest", "photo.jpeg", JPEG),
        (b"fuel,volume\ndiesel,10\n", "volumes.csv", CSV),
        ("Caf\u00e9 notes".encode("utf-8"), "notes.txt", TXT),
        ("Caf\u00e9 notes".encode("cp1252"), "notes.txt", TXT),
        ("Excel unicode text".encode("utf-16"), "export.txt", TXT),
    ],
)
def test_allowed_files_are_detected(data, filename, expected):
    detected = inspect(data, filename)
    assert detected.mime_type == expected
    assert detected.has_macros is False


def test_extension_is_case_insensitive():
    assert inspect(xlsx_bytes(), "MODEL.XLSX").mime_type == XLSX


# --- Contents that don't match the name ---------------------------------------


@pytest.mark.parametrize(
    "data, filename",
    [
        (xlsx_bytes(), "renamed.pdf"),
        (b"%PDF-1.7", "renamed.xlsx"),
        (b"<html><script>alert(1)</script></html>", "page.html"),
        (b"MZ\x90\x00\x03\x00", "setup.txt"),
        (xlsx_bytes(), "no-extension"),
    ],
)
def test_mismatched_contents_are_rejected(data, filename):
    assert "don't match" in rejected(data, filename)


def test_disallowed_detected_type_lists_allowed_types():
    detail = rejected(b"RIFF\x00\x00\x00\x00WEBPVP8 ", "image.webp")
    assert detail.startswith("File type is not allowed")
    assert ALLOWED_FILE_TYPES in detail


# --- Macros in OOXML ----------------------------------------------------------


def test_vba_part_found_by_content_type():
    data = rewrite_zip(
        xlsx_bytes(),
        {
            "[Content_Types].xml": lambda c: add_content_type(
                c,
                '<Default Extension="bin" '
                'ContentType="application/vnd.ms-office.vbaProject"/>',
            ),
            "xl/vbaProject.bin": lambda _: b"\xd0\xcf\x11\xe0",
        },
    )
    assert "contains macros" in rejected(data, "model.xlsx")


def test_vba_part_found_by_relationship_even_when_renamed():
    data = rewrite_zip(
        xlsx_bytes(),
        {
            "xl/_rels/workbook.xml.rels": lambda c: add_relationship(
                c,
                "http://schemas.microsoft.com/office/2006/relationships/vbaProject",
                "notes.dat",
            ),
            "xl/notes.dat": lambda _: b"\xd0\xcf\x11\xe0",
        },
    )
    assert "contains macros" in rejected(data, "model.xlsx")


def test_excel4_macro_sheet_counts_as_macros():
    data = rewrite_zip(
        xlsx_bytes(),
        {
            "[Content_Types].xml": lambda c: add_content_type(
                c,
                '<Override PartName="/xl/macrosheets/sheet1.xml" '
                'ContentType="application/vnd.ms-excel.macrosheet+xml"/>',
            ),
            "xl/macrosheets/sheet1.xml": lambda _: b"<xm:macrosheet/>",
        },
    )
    assert "contains macros" in rejected(data, "model.xlsx")


def test_macro_enabled_workbook_without_macros_is_not_allowed_yet():
    data = rewrite_zip(
        xlsx_bytes(),
        {
            "[Content_Types].xml": lambda c: c.replace(
                b"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
                b"application/vnd.ms-excel.sheet.macroEnabled.main+xml",
            )
        },
    )
    assert detect_file_type(data, "model.xlsm").mime_type == XLSM
    assert rejected(data, "model.xlsm").startswith("File type is not allowed")


# --- Active and external content ----------------------------------------------


def test_remote_template_is_rejected():
    data = rewrite_zip(
        docx_bytes(),
        {
            "word/_rels/settings.xml.rels": lambda c: add_relationship(
                c,
                f"{REL}/attachedTemplate",
                "https://example.com/t.dotm",
                external=True,
            )
        },
    )
    assert "outside the document" in rejected(data, "report.docx")


def test_external_hyperlink_is_fine():
    data = rewrite_zip(
        docx_bytes(),
        {
            "word/_rels/document.xml.rels": lambda c: add_relationship(
                c, f"{REL}/hyperlink", "https://www2.gov.bc.ca", external=True
            )
        },
    )
    assert inspect(data, "report.docx").mime_type == DOCX


def _with_field(runs: str):
    return lambda c: c.replace(
        b"<w:t>hello</w:t>", b"<w:t>hello</w:t></w:r>" + runs.encode() + b"<w:r>"
    )


def test_dde_field_split_across_runs_is_rejected():
    runs = (
        '<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
        "<w:r><w:instrText> DD</w:instrText></w:r>"
        '<w:r><w:instrText>EAUTO c:\\\\windows\\\\cmd.exe "/k"</w:instrText></w:r>'
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
        '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
    )
    data = rewrite_zip(docx_bytes(), {"word/document.xml": _with_field(runs)})
    assert "DDE" in rejected(data, "report.docx")


def test_simple_dde_field_is_rejected():
    runs = '<w:fldSimple w:instr=" DDE excel sheet1 r1c1"><w:r><w:t>1</w:t></w:r></w:fldSimple>'
    data = rewrite_zip(docx_bytes(), {"word/document.xml": _with_field(runs)})
    assert "DDE" in rejected(data, "report.docx")


def test_ordinary_field_is_fine():
    runs = (
        '<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
        "<w:r><w:instrText> PAGE </w:instrText></w:r>"
        '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
    )
    data = rewrite_zip(docx_bytes(), {"word/document.xml": _with_field(runs)})
    assert inspect(data, "report.docx").mime_type == DOCX


def test_excel_dde_link_is_rejected():
    data = rewrite_zip(
        xlsx_bytes(),
        {
            "[Content_Types].xml": lambda c: add_content_type(
                c,
                '<Override PartName="/xl/externalLinks/externalLink1.xml" ContentType='
                '"application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml"/>',
            ),
            "xl/externalLinks/externalLink1.xml": lambda _: (
                b'<externalLink xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                b'<ddeLink ddeService="cmd" ddeTopic="/c calc"/></externalLink>'
            ),
        },
    )
    assert "DDE" in rejected(data, "model.xlsx")


# --- Unsafe or damaged packages -----------------------------------------------


@pytest.mark.parametrize("name", ["../evil.txt", "/abs.txt", "xl\\back.txt"])
def test_unsafe_entry_names_are_rejected(name):
    data = rewrite_zip(xlsx_bytes(), {name: lambda _: b"x"})
    assert "damaged" in rejected(data, "model.xlsx")


def test_duplicate_entry_names_are_rejected():
    data = rewrite_zip(xlsx_bytes(), {"XL/WORKBOOK.XML": lambda _: b"<workbook/>"})
    assert "damaged" in rejected(data, "model.xlsx")


def test_zip_bomb_entry_is_rejected():
    data = rewrite_zip(
        xlsx_bytes(), {"xl/media/big.bin": lambda _: b"\0" * (11 * 1024 * 1024)}
    )
    assert "damaged" in rejected(data, "model.xlsx")


def test_too_many_entries_are_rejected(monkeypatch):
    monkeypatch.setattr(ooxml_module, "MAX_ENTRIES", 3)
    assert "damaged" in rejected(xlsx_bytes(), "model.xlsx")


def test_strict_open_xml_is_rejected():
    data = rewrite_zip(
        xlsx_bytes(),
        {
            "_rels/.rels": lambda c: c.replace(
                b"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
                b"http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument",
            )
        },
    )
    assert "Strict Open XML" in rejected(data, "model.xlsx")


def test_truncated_zip_is_rejected():
    assert "damaged" in rejected(xlsx_bytes()[:200], "model.xlsx")


def test_plain_zip_is_not_office():
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        z.writestr("readme.txt", "hi")
    assert "don't match" in rejected(out.getvalue(), "archive.xlsx")


# --- Legacy OLE files ---------------------------------------------------------


def _edit_workbook_stream(tmp_path, edit):
    """Rewrite the Workbook stream of a real .xls in place (same size)."""
    path = tmp_path / "book.xls"
    path.write_bytes(xls_bytes())
    with olefile.OleFileIO(str(path), write_mode=True) as ole:
        stream = bytearray(ole.openstream("Workbook").read())
        edit(stream)
        ole.write_stream("Workbook", bytes(stream))
    return path.read_bytes()


def _records(stream):
    pos = 0
    while pos + 4 <= len(stream):
        record_type, length = struct.unpack_from("<HH", stream, pos)
        yield pos, record_type, length
        pos += 4 + length


def test_xls_with_excel4_macro_sheet_is_rejected(tmp_path):
    def mark_macro_sheet(stream):
        for pos, record_type, _ in _records(stream):
            if record_type == ole_module.BIFF_BOUNDSHEET:
                stream[pos + 4 + 5] = 1
                return
        raise AssertionError("no BoundSheet record")

    data = _edit_workbook_stream(tmp_path, mark_macro_sheet)
    assert "contains macros" in rejected(data, "old.xls")


def test_encrypted_xls_is_rejected(tmp_path):
    def add_filepass(stream):
        # Relabel the record after BOF as FILEPASS, keeping the size
        positions = list(_records(stream))
        pos = positions[1][0]
        struct.pack_into("<H", stream, pos, ole_module.BIFF_FILEPASS)

    data = _edit_workbook_stream(tmp_path, add_filepass)
    assert "Password-protected" in rejected(data, "old.xls")


class FakeOle:
    def __init__(self, entries, streams):
        self.entries = entries
        self.streams = streams

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def listdir(self, streams=True, storages=False):
        return self.entries

    def openstream(self, name):
        return io.BytesIO(self.streams[name])


def _fake_ole(monkeypatch, entries, streams=None):
    monkeypatch.setattr(
        ole_module.olefile, "OleFileIO", lambda data: FakeOle(entries, streams or {})
    )
    return ole_module.OLE_MAGIC + b"\0" * 2048


def _fib(flags=0):
    return b"\xec\xa5" + b"\0" * 8 + struct.pack("<H", flags)


def test_doc_is_detected(monkeypatch):
    data = _fake_ole(
        monkeypatch, [["WordDocument"], ["1Table"]], {"WordDocument": _fib()}
    )
    assert inspect(data, "letter.doc").mime_type == DOC


def test_doc_with_macros_is_rejected(monkeypatch):
    data = _fake_ole(
        monkeypatch,
        [["WordDocument"], ["Macros", "VBA", "dir"]],
        {"WordDocument": _fib()},
    )
    assert "contains macros" in rejected(data, "letter.doc")


def test_encrypted_doc_is_rejected(monkeypatch):
    data = _fake_ole(
        monkeypatch,
        [["WordDocument"]],
        {"WordDocument": _fib(ole_module.WORD_FIB_ENCRYPTED)},
    )
    assert "Password-protected" in rejected(data, "letter.doc")


def test_xls_with_vba_storage_is_rejected(monkeypatch):
    data = _fake_ole(
        monkeypatch,
        [["Workbook"], ["_VBA_PROJECT_CUR", "VBA", "dir"]],
        {"Workbook": b""},
    )
    assert "contains macros" in rejected(data, "old.xls")


def test_password_protected_xlsx_is_rejected(monkeypatch):
    data = _fake_ole(monkeypatch, [["EncryptionInfo"], ["EncryptedPackage"]])
    assert "Password-protected" in rejected(data, "model.xlsx")


def test_other_ole_files_are_rejected(monkeypatch):
    data = _fake_ole(monkeypatch, [["PowerPoint Document"]])
    assert "don't match" in rejected(data, "slides.doc")
