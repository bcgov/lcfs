"""
Unit tests for the FSE bulk-update Excel template exporter.

Covers:
  - FSEReportingExporter.export_update_template (success, report not found)
  - _build_workbook: sheet name, headers, column widths, sheet protection,
    locked/unlocked cells, data validators, date number format
  - _load_fse_data: datetime → date normalisation, None values passed through
"""

import datetime
import io
from unittest.mock import AsyncMock, MagicMock

import pytest
from openpyxl import load_workbook
from starlette.responses import StreamingResponse

from lcfs.db.models import Organization
from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.web.api.final_supply_equipment.fse_reporting_export import (
    COLUMN_WIDTHS,
    FSE_UPDATE_EXPORT_FILENAME,
    FSE_UPDATE_SHEETNAME,
    FSEReportingExporter,
    HEADERS,
)
from lcfs.web.exception.exceptions import DataNotFoundException


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _compliance_period(year: int = 2024):
    return MagicMock(
        description=str(year),
        effective_date=datetime.datetime(year, 1, 1),
        expiration_date=datetime.datetime(year, 12, 31),
    )


def _make_exporter(fse_rows=None, report_found=True):
    repo = MagicMock()
    repo.get_fse_for_bulk_update_template = AsyncMock(return_value=fse_rows or [])

    cr_repo = MagicMock()
    if report_found:
        report = MagicMock(
            compliance_period=_compliance_period(),
            compliance_report_group_uuid="group-abc",
        )
        cr_repo.get_compliance_report_by_id = AsyncMock(return_value=report)
    else:
        cr_repo.get_compliance_report_by_id = AsyncMock(return_value=None)

    exp = FSEReportingExporter(repo=repo, compliance_report_repo=cr_repo)
    return exp


def _fse_row(
    registration="ORG-AAAA1A-001",
    supply_from=datetime.date(2024, 1, 1),
    supply_to=datetime.date(2024, 12, 31),
    kwh_usage=1500.0,
    notes="Test note",
):
    row = MagicMock()
    row.registration_number = registration
    row.supply_from_date = supply_from
    row.supply_to_date = supply_to
    row.kwh_usage = kwh_usage
    row.compliance_notes = notes
    return row


# ---------------------------------------------------------------------------
# export_update_template
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_export_returns_streaming_response():
    exporter = _make_exporter(fse_rows=[_fse_row()])
    org = Organization(name="TestOrg")
    org.organization_id = 1

    response = await exporter.export_update_template(
        compliance_report_id=1,
        user=MagicMock(),
        organization=org,
    )

    assert isinstance(response, StreamingResponse)
    assert response.status_code == 200
    assert response.media_type == FILE_MEDIA_TYPE["XLSX"].value


@pytest.mark.anyio
async def test_export_filename_includes_org_and_period():
    exporter = _make_exporter(fse_rows=[])
    org = Organization(name="MyOrg")
    org.organization_id = 1

    response = await exporter.export_update_template(
        compliance_report_id=1,
        user=MagicMock(),
        organization=org,
    )

    disposition = response.headers["Content-Disposition"]
    assert FSE_UPDATE_EXPORT_FILENAME in disposition
    assert "MyOrg" in disposition
    assert "2024" in disposition


@pytest.mark.anyio
async def test_export_report_not_found_raises():
    exporter = _make_exporter(report_found=False)
    org = Organization(name="AnyOrg")
    org.organization_id = 1

    with pytest.raises(DataNotFoundException):
        await exporter.export_update_template(
            compliance_report_id=999,
            user=MagicMock(),
            organization=org,
        )


# ---------------------------------------------------------------------------
# _build_workbook content
# ---------------------------------------------------------------------------


def _parse_workbook(exporter, rows=None) -> "openpyxl.worksheet.worksheet.Worksheet":
    """Call _build_workbook and return the worksheet for inspection."""
    period = _compliance_period()
    wb = exporter._build_workbook(rows or [], period)
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    wb2 = load_workbook(out)
    return wb2[FSE_UPDATE_SHEETNAME]


def test_sheet_name_is_fse():
    exp = _make_exporter()
    ws = _parse_workbook(exp)
    assert ws.title == FSE_UPDATE_SHEETNAME


def test_headers_match_spec():
    exp = _make_exporter()
    ws = _parse_workbook(exp)
    actual = [ws.cell(row=1, column=i + 1).value for i in range(len(HEADERS))]
    assert actual == HEADERS


def test_header_labels():
    """Spot-check the label renames requested by the user."""
    assert HEADERS[0] == "Registration #"
    assert HEADERS[3] == "kWh usage"


def test_column_count_matches_headers():
    assert len(COLUMN_WIDTHS) == len(HEADERS)


def test_registration_cell_is_locked():
    exp = _make_exporter()
    rows = [_fse_row()]
    period = _compliance_period()

    wb = exp._build_workbook(
        [["ORG-001", datetime.date(2024, 1, 1), datetime.date(2024, 12, 31), 500, "note"]],
        period,
    )
    ws = wb[FSE_UPDATE_SHEETNAME]
    reg_cell = ws.cell(row=2, column=1)
    assert reg_cell.protection.locked is True


def test_editable_columns_are_unlocked():
    exp = _make_exporter()
    period = _compliance_period()
    wb = exp._build_workbook(
        [["ORG-001", datetime.date(2024, 1, 1), datetime.date(2024, 12, 31), 500, "note"]],
        period,
    )
    ws = wb[FSE_UPDATE_SHEETNAME]
    for col in (2, 3, 4, 5):
        assert ws.cell(row=2, column=col).protection.locked is False, (
            f"Column {col} should be unlocked"
        )


def test_sheet_protection_is_enabled():
    exp = _make_exporter()
    period = _compliance_period()
    wb = exp._build_workbook([], period)
    ws = wb[FSE_UPDATE_SHEETNAME]
    assert ws.protection.sheet is True


def test_date_columns_have_date_number_format():
    exp = _make_exporter()
    period = _compliance_period()
    wb = exp._build_workbook(
        [["ORG-001", datetime.date(2024, 1, 1), datetime.date(2024, 12, 31), 500, ""]],
        period,
    )
    ws = wb[FSE_UPDATE_SHEETNAME]
    assert ws.cell(row=2, column=2).number_format == "yyyy-mm-dd"
    assert ws.cell(row=2, column=3).number_format == "yyyy-mm-dd"


def test_kwh_column_has_numeric_format():
    exp = _make_exporter()
    period = _compliance_period()
    wb = exp._build_workbook(
        [["ORG-001", datetime.date(2024, 1, 1), datetime.date(2024, 12, 31), 500, ""]],
        period,
    )
    ws = wb[FSE_UPDATE_SHEETNAME]
    assert ws.cell(row=2, column=4).number_format == "#,##0"


def test_data_validators_are_added():
    exp = _make_exporter()
    period = _compliance_period()
    wb = exp._build_workbook([], period)
    ws = wb[FSE_UPDATE_SHEETNAME]
    assert len(ws.data_validations.dataValidation) == 2


def test_no_background_fill_on_headers():
    """Headers must NOT have a coloured fill (consistency requirement)."""
    exp = _make_exporter()
    period = _compliance_period()
    wb = exp._build_workbook([], period)
    ws = wb[FSE_UPDATE_SHEETNAME]
    for col in range(1, len(HEADERS) + 1):
        fill = ws.cell(row=1, column=col).fill
        # openpyxl default fill type is "none" or patternType is None
        pattern = getattr(fill, "patternType", None)
        assert pattern in (None, "none"), (
            f"Header col {col} has unexpected fill: {pattern}"
        )


# ---------------------------------------------------------------------------
# _load_fse_data datetime normalisation
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_load_fse_data_converts_datetime_to_date():
    """datetime objects from the DB must be converted to plain date."""
    dt_from = datetime.datetime(2024, 3, 15, 0, 0, 0)
    dt_to = datetime.datetime(2024, 9, 30, 23, 59, 59)
    row = _fse_row(supply_from=dt_from, supply_to=dt_to)

    exporter = _make_exporter(fse_rows=[row])
    rows = await exporter._load_fse_data(1, "group-abc")

    assert rows[0][1] == datetime.date(2024, 3, 15)
    assert rows[0][2] == datetime.date(2024, 9, 30)


@pytest.mark.anyio
async def test_load_fse_data_passes_none_dates():
    """None dates (blank in DB) must be preserved as None."""
    row = _fse_row(supply_from=None, supply_to=None, kwh_usage=None, notes=None)

    exporter = _make_exporter(fse_rows=[row])
    rows = await exporter._load_fse_data(1, "group-abc")

    assert rows[0][1] is None
    assert rows[0][2] is None
    assert rows[0][3] is None
    assert rows[0][4] is None


@pytest.mark.anyio
async def test_load_fse_data_empty_registration_becomes_empty_string():
    row = _fse_row(registration=None)
    exporter = _make_exporter(fse_rows=[row])
    rows = await exporter._load_fse_data(1, "group-abc")
    assert rows[0][0] == ""
