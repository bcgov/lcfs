from datetime import date
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock

from openpyxl import load_workbook
import pytest
from starlette.responses import StreamingResponse

from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.bulletin_export import FuelCodeBulletinExporter


@pytest.mark.anyio
async def test_bulletin_export_success():
    repo_mock = MagicMock()
    repo_mock.get_fuel_code_bulletin_rows = AsyncMock()
    exporter = FuelCodeBulletinExporter(repo=repo_mock)

    pagination = PaginationRequestSchema(
        page=2,
        size=25,
        sort_orders=[{"field": "fuel_code", "direction": "asc"}],
        filters=[],
    )
    repo_mock.get_fuel_code_bulletin_pagination_params.return_value = (
        [],
        pagination.sort_orders,
    )
    repo_mock.get_fuel_code_bulletin_rows.return_value = (
        [
            {
                "fuel_code": "C-BCLCF264.3",
                "fuel": "CNG",
                "company": "FortisBC",
                "carbon_intensity": 2.89,
                "effective_date": date(2025, 12, 31),
                "expiry_date": date(2028, 12, 30),
            }
        ],
        1,
    )

    response = await exporter.export("current", "csv", pagination)

    assert isinstance(response, StreamingResponse)
    assert response.media_type == "text/csv"
    assert "BC-LCFS-Current-Fuel-Codes" in response.headers["Content-Disposition"]
    repo_mock.get_fuel_code_bulletin_pagination_params.assert_called_once_with(
        pagination
    )
    repo_mock.get_fuel_code_bulletin_rows.assert_awaited_once()
    call_kwargs = repo_mock.get_fuel_code_bulletin_rows.await_args.kwargs
    assert call_kwargs["bulletin_type"] == "current"
    assert call_kwargs["offset"] == 0
    assert call_kwargs["limit"] is None

    headers = await response.body_iterator.__anext__()
    file_content = await response.body_iterator.__anext__()
    assert (
        b"Fuel code,Fuel,Company,Carbon intensity (gCO2e/MJ),Effective date,Expiry date"
        in headers
    )
    assert b"C-BCLCF264.3,CNG,FortisBC,2.89,2025-12-31,2028-12-30" in file_content


@pytest.mark.anyio
@pytest.mark.parametrize("bulletin_type", ["current", "archived"])
async def test_bulletin_excel_preserves_numeric_suffix_order(bulletin_type):
    repo_mock = MagicMock()
    repo_mock.get_fuel_code_bulletin_rows = AsyncMock()
    repo_mock.get_fuel_code_bulletin_pagination_params.return_value = ([], [])
    repo_mock.get_fuel_code_bulletin_rows.return_value = (
        [
            {
                "fuel_code": f"BCLCF{suffix}",
                "fuel": "Renewable diesel",
                "company": "Example Fuel Co",
                "carbon_intensity": 10.0,
                "effective_date": date(2025, 1, 1),
                "expiry_date": None,
            }
            for suffix in ("101.0", "999.0", "1000.0")
        ],
        3,
    )
    exporter = FuelCodeBulletinExporter(repo=repo_mock)

    response = await exporter.export(
        bulletin_type,
        "xlsx",
        PaginationRequestSchema(page=1, size=25, sort_orders=[], filters=[]),
    )
    content = b"".join([chunk async for chunk in response.body_iterator])
    worksheet = load_workbook(BytesIO(content), read_only=True).active
    exported_codes = [
        row[0]
        for row in worksheet.iter_rows(
            min_row=2, min_col=1, max_col=1, values_only=True
        )
        if row[0] is not None
    ]

    assert exported_codes == ["BCLCF101.0", "BCLCF999.0", "BCLCF1000.0"]


@pytest.mark.anyio
async def test_bulletin_export_invalid_format():
    repo_mock = MagicMock()
    exporter = FuelCodeBulletinExporter(repo=repo_mock)

    with pytest.raises(Exception) as exc_info:
        await exporter.export("current", "pdf")

    assert "Export format not supported" in str(exc_info.value)
