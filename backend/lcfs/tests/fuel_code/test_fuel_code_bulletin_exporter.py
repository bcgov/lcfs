from datetime import date
from unittest.mock import AsyncMock, MagicMock

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
        b"Fuel Code,Fuel,Company,Carbon Intensity (gCO2e/MJ),Effective Date,Expiry Date"
        in headers
    )
    assert b"C-BCLCF264.3,CNG,FortisBC,2.89,2025-12-31,2028-12-30" in file_content


@pytest.mark.anyio
async def test_bulletin_export_invalid_format():
    repo_mock = MagicMock()
    exporter = FuelCodeBulletinExporter(repo=repo_mock)

    with pytest.raises(Exception) as exc_info:
        await exporter.export("current", "pdf")

    assert "Export format not supported" in str(exc_info.value)
