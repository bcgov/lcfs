from unittest.mock import AsyncMock

import pytest
from starlette.responses import StreamingResponse

from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.export import (
    FuelCodeExporter,
    _format_transport_modes,
)


def _fuel_code_row(**overrides):
    """
    A fuel code as ``FuelCodeRepository.get_fuel_codes_paginated`` returns it:
    a plain dict, with transport modes as ``{"transport_mode", "distance"}``
    dicts (not ORM rows / attribute access).
    """
    row = {
        "fuel_code_id": 1,
        "status": "Draft",
        "prefix": "BCLCF",
        "fuel_suffix": "001.0",
        "carbon_intensity": 10.5,
        "edrms": "EDRMS-123",
        "company": "XYZ Corp",
        "contact_name": "John Doe",
        "contact_email": "john.doe@example.com",
        "application_date": "2023-10-01",
        "approval_date": "2023-11-01",
        "effective_date": "2023-12-01",
        "expiration_date": "2024-01-01",
        "fuel_type": "Diesel",
        "feedstock": "Corn oil",
        "feedstock_location": "Canada",
        "feedstock_misc": None,
        "co_processed": "No",
        "fuel_production_facility_city": "Victoria",
        "fuel_production_facility_province_state": "BC",
        "fuel_production_facility_country": "Canada",
        "facility_nameplate_capacity": 1000,
        "facility_nameplate_capacity_unit": "MW",
        "feedstock_fuel_transport_modes": [
            {"transport_mode": "Pipeline", "distance": 125}
        ],
        "finished_fuel_transport_modes": [
            {"transport_mode": "Truck", "distance": None}
        ],
        "former_company": None,
        "notes": None,
    }
    row.update(overrides)
    return row


@pytest.mark.anyio
async def test_export_success():
    repo_mock = AsyncMock()
    exporter = FuelCodeExporter(repo=repo_mock)
    export_format = "csv"

    repo_mock.get_fuel_codes_paginated.return_value = ([_fuel_code_row()], 1)

    response = await exporter.export(export_format)

    assert isinstance(response, StreamingResponse)
    assert response.media_type == "text/csv"
    assert "attachment; filename=" in response.headers["Content-Disposition"]

    expected_pagination = PaginationRequestSchema(
        page=1, size=10000, filters=[], sort_orders=[]
    )
    repo_mock.get_fuel_codes_paginated.assert_called_once_with(
        expected_pagination,
        exclude_archived=False,
        compliance_period_start=None,
    )

    # Verify file content
    headers = await response.body_iterator.__anext__()
    file_content = await response.body_iterator.__anext__()
    assert (
        b"Status,Prefix,Fuel code,Carbon intensity,EDRMS#,Company,Contact name,Contact email,Application date,Approval date,Effective date,Expiry date,Fuel,Feedstock,Feedstock location,Misc,Co-processed,Fuel production facility city,Fuel production facility province/state,Fuel production facility country,Facility nameplate capacity,Unit,Feedstock transport mode,Finished fuel transport mode,Former company,Notes\n"
        in headers
    )
    assert (
        b"Draft,BCLCF,001.0,10.5,EDRMS-123,XYZ Corp,John Doe,john.doe@example.com,2023-10-01,2023-11-01,2023-12-01,2024-01-01,Diesel,Corn oil,Canada,,No,Victoria,BC,Canada,1000,MW,Pipeline (125 km),Truck,,\n"
        in file_content
    )


@pytest.mark.anyio
async def test_export_handles_plain_transport_mode_names():
    """
    The list view falls back to a plain list of mode names when no distances
    are recorded; the exporter must accept that shape too.
    """
    repo_mock = AsyncMock()
    exporter = FuelCodeExporter(repo=repo_mock)
    repo_mock.get_fuel_codes_paginated.return_value = (
        [
            _fuel_code_row(
                feedstock_fuel_transport_modes=["Pipeline", "Rail"],
                finished_fuel_transport_modes=None,
            )
        ],
        1,
    )

    response = await exporter.export("csv")

    await response.body_iterator.__anext__()  # headers
    file_content = await response.body_iterator.__anext__()
    assert b',1000,MW,"Pipeline, Rail",,,\n' in file_content


@pytest.mark.parametrize(
    ("values", "expected"),
    [
        (None, ""),
        ([], ""),
        (["Truck"], "Truck"),
        (["Truck", "Rail"], "Truck, Rail"),
        ([{"transport_mode": "Truck", "distance": 125}], "Truck (125 km)"),
        ([{"transport_mode": "Truck", "distance": None}], "Truck"),
        (
            [
                {"transport_mode": "Truck", "distance": 125},
                {"transport_mode": "Rail", "distance": 0},
                "Pipeline",
            ],
            "Truck (125 km), Rail (0 km), Pipeline",
        ),
        ([{"transport_mode": "", "distance": 10}, None], ""),
    ],
)
def test_format_transport_modes(values, expected):
    assert _format_transport_modes(values) == expected


@pytest.mark.anyio
async def test_export_invalid_format():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeExporter(repo=repo_mock)
    invalid_format = "pdf"

    # Act & Assert
    with pytest.raises(Exception) as exc_info:
        await service.export(invalid_format)

    assert "Export format not supported" in str(exc_info.value)
