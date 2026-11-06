"""Static analysis of the macros in a macro-enabled workbook (.xlsm)."""

import json
import re
import subprocess
import sys
import zipfile
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from time import monotonic

import structlog

from lcfs.services.file_inspection.common import DAMAGED_MESSAGE, DetectedFile
from lcfs.services.file_inspection.ole import OLE_MAGIC
from lcfs.services.file_inspection.ooxml import (
    PACKAGE_ERRORS,
    iter_elements,
    read_part,
)

logger = structlog.get_logger(__name__)

PROBE_SCRIPT = Path(__file__).with_name("vba_probe.py")
# Shared by every VBA project in the file, so extra projects add no time
PROBE_TIMEOUT_SECONDS = 90

# Real VBA projects and macro sheets are a few MB at most. Checked against
# the sizes the package declares, before anything is decompressed.
MAX_MACRO_PART_BYTES = 32 * 1024**2
MAX_MACRO_TOTAL_BYTES = 64 * 1024**2

# Excel 4.0 functions that run code or reach outside the workbook
DANGEROUS_XLM = re.compile(
    r"\b(EXEC|CALL|REGISTER|REGISTER\.ID|FOPEN|FWRITE|FWRITELN|URLDOWNLOADTOFILE)\s*\(",
    re.IGNORECASE,
)
# olevba reports these as "Suspicious"; they are covered by their own finding
ENCODED_STRING_KEYWORDS = {
    "hex strings",
    "base64 strings",
    "dridex strings",
    "vba strings",
}
MAX_KEYWORDS_LISTED = 8

STOMPED_MESSAGE = (
    "This file's macro code has been altered so that it doesn't match what "
    "Excel shows, and can't be uploaded."
)
XLM_EXEC_MESSAGE = (
    "This file contains Excel 4.0 macros that can run programs and can't be "
    "uploaded."
)
PROJECT_REFERENCE_MESSAGE = (
    "This file's macros load code from another file and can't be uploaded."
)
TOO_LARGE_MESSAGE = "This file's macros are too large to check and can't be uploaded."
NOT_ANALYZED_FINDING = "The macro code could not be fully analyzed"


@dataclass(frozen=True)
class MacroReport:
    # Plain-language findings shown to staff next to the file
    findings: list[str]
    # Set when the file must be refused outright
    block_reason: str | None = None


def analyze_workbook_macros(data: bytes, detected: DetectedFile) -> MacroReport:
    findings: list[str] = []
    block_reason = None

    with zipfile.ZipFile(BytesIO(data)) as package:
        sizes = [
            package.getinfo(part).file_size
            for part in detected.vba_parts + detected.macro_sheet_parts
        ]
        if (
            max(sizes, default=0) > MAX_MACRO_PART_BYTES
            or sum(sizes) > MAX_MACRO_TOTAL_BYTES
        ):
            logger.warning("Macro workbook refused", reason="macros too large")
            return MacroReport([], TOO_LARGE_MESSAGE)
        try:
            vba_projects = [
                read_part(package, part, MAX_MACRO_PART_BYTES)
                for part in detected.vba_parts
            ]
            runs_programs = any(
                _formula_runs_programs(package, part)
                for part in detected.macro_sheet_parts
            )
        except PACKAGE_ERRORS as e:
            logger.warning("Could not read macro parts", error=str(e))
            return MacroReport([], DAMAGED_MESSAGE)

    deadline = monotonic() + PROBE_TIMEOUT_SECONDS
    for vba_project in vba_projects:
        report = _probe(vba_project, deadline - monotonic())
        block_reason = block_reason or _vba_block_reason(report)
        findings.extend(_vba_findings(report))

    if detected.macro_sheet_parts:
        if runs_programs:
            block_reason = block_reason or XLM_EXEC_MESSAGE
        findings.append("Contains Excel 4.0 macro sheets")

    if detected.has_activex:
        findings.append("Contains ActiveX controls")

    if block_reason:
        logger.warning("Macro workbook refused", reason=block_reason)
    # Keep the order, drop repeats from multiple VBA projects
    return MacroReport(list(dict.fromkeys(findings)), block_reason)


def _formula_runs_programs(package: zipfile.ZipFile, part: str) -> bool:
    """
    Scan each formula as Excel reads it, after XML decoding, so character
    references or a UTF-16 part can't hide a function name.
    """
    # Read in small chunks, and zipfile stops at the part's declared size,
    # which the caller has checked
    with package.open(part) as stream:
        for el in iter_elements(stream):
            if el.tag.rpartition("}")[2] == "f" and DANGEROUS_XLM.search(el.text or ""):
                return True
    return False


def _probe(vba_project: bytes, timeout: float) -> dict:
    if not vba_project.startswith(OLE_MAGIC):
        return {"error": "VBA project is not an OLE file"}
    if timeout <= 0:
        logger.warning("Macro analysis timed out")
        return {"error": "timed out"}
    try:
        completed = subprocess.run(
            [sys.executable, "-I", str(PROBE_SCRIPT)],
            input=vba_project,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        logger.warning("Macro analysis timed out")
        return {"error": "timed out"}

    try:
        report = json.loads(completed.stdout or b"null")
    except json.JSONDecodeError:
        report = None
    if completed.returncode != 0 or not isinstance(report, dict):
        logger.warning(
            "Macro analysis failed",
            returncode=completed.returncode,
            stderr=completed.stderr[-2000:].decode("utf-8", errors="replace"),
        )
        return {"error": "probe failed"}
    if report.get("error"):
        logger.warning("Macro analysis error", error=report["error"])
    return report


def _vba_block_reason(report: dict) -> str | None:
    if report.get("stomping"):
        return STOMPED_MESSAGE
    if report.get("references_projects"):
        return PROJECT_REFERENCE_MESSAGE
    return None


def _vba_findings(report: dict) -> list[str]:
    if report.get("error"):
        return ["Contains macros", NOT_ANALYZED_FINDING]

    modules = report.get("modules", 0)
    findings = [f"Contains macros ({modules} code module{'s' if modules != 1 else ''})"]
    if report.get("autoexec"):
        findings.append("Runs automatically when the file is opened")
    if report.get("runs_programs"):
        findings.append("Can run other programs or commands")
    if report.get("writes_files"):
        findings.append("Can create or change files on the computer")
    if report.get("iocs"):
        findings.append("Contains web addresses, IP addresses or file names")
    if report.get("encoded_strings"):
        findings.append("Contains encoded text that can hide what the code does")

    keywords = sorted(
        {
            item["keyword"]
            for item in report.get("keywords", [])
            if item.get("type") == "Suspicious"
            and item.get("keyword", "").lower() not in ENCODED_STRING_KEYWORDS
        }
    )
    if keywords:
        listed = ", ".join(keywords[:MAX_KEYWORDS_LISTED])
        findings.append(f"Uses functions often found in harmful macros: {listed}")

    if report.get("stomping") is None:
        findings.append(
            "The compiled macro code couldn't be checked against its source"
        )
    return findings
