"""Build small, real Office files in memory for upload tests."""

import io
import zipfile

import docx
import xlwt
from openpyxl import Workbook


def xlsx_bytes() -> bytes:
    buffer = io.BytesIO()
    workbook = Workbook()
    workbook.active["A1"] = "Fuel"
    workbook.save(buffer)
    return buffer.getvalue()


def docx_bytes(text: str = "hello") -> bytes:
    buffer = io.BytesIO()
    document = docx.Document()
    document.add_paragraph(text)
    document.save(buffer)
    return buffer.getvalue()


def xls_bytes() -> bytes:
    buffer = io.BytesIO()
    workbook = xlwt.Workbook()
    workbook.add_sheet("Sheet1").write(0, 0, "Fuel")
    workbook.save(buffer)
    return buffer.getvalue()


def rewrite_zip(data: bytes, edits: dict) -> bytes:
    """
    Copy a zip, passing each named entry's bytes through its edit function.
    Names not already in the zip are added with edit(b"").
    """
    edits = dict(edits)
    source = zipfile.ZipFile(io.BytesIO(data))
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as target:
        for info in source.infolist():
            content = source.read(info)
            if info.filename in edits:
                content = edits.pop(info.filename)(content)
            target.writestr(info.filename, content)
        for name, edit in edits.items():
            target.writestr(name, edit(b""))
    return out.getvalue()
