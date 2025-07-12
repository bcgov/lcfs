from unittest.mock import AsyncMock, MagicMock

import pytest
from starlette.responses import StreamingResponse

from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.export import FuelCodeExporter


@pytest.mark.anyio
async def test_export_success():
    repo_mock = AsyncMock()
    exporter = FuelCodeExporter(repo=repo_mock)
    export_format = "csv"

    mock_fuel_codes = [
        MagicMock(
            fuel_code_status=MagicMock(status=FuelCodeStatusEnum.Draft),
            fuel_code_prefix=MagicMock(prefix="BCLCF"),
            fuel_suffix="001.0",
            carbon_intensity=10.5,
            edrms="EDRMS-123",
            company="XYZ Corp",
            contact_name="John Doe",
            contact_email="john.doe@example.com",
            application_date="2023-10-01",
            approval_date="2023-11-01",
            effective_date="2023-12-01",
            expiration_date="2024-01-01",
            fuel_type=MagicMock(fuel_type="Diesel"),
            feedstock="Corn oil",
            feedstock_location="Canada",
            feedstock_misc=None,
            fuel_production_facility_city="Victoria",
            fuel_production_facility_province_state="BC",
            fuel_production_facility_country="Canada",
            facility_nameplate_capacity=1000,
            facility_nameplate_capacity_unit=MagicMock(value="MW"),
            feedstock_fuel_transport_modes=[
                MagicMock(
                    feedstock_fuel_transport_mode=MagicMock(transport_mode="Pipeline")
                )
            ],
            finished_fuel_transport_modes=[
                MagicMock(
                    finished_fuel_transport_mode=MagicMock(transport_mode="Truck")
                )
            ],
            former_company=None,
            notes=None,
        )
    ]
    repo_mock.get_fuel_codes_paginated.return_value = (mock_fuel_codes, 1)

    response = await exporter.export(export_format)

    assert isinstance(response, StreamingResponse)
    assert response.media_type == "text/csv"
    assert "attachment; filename=" in response.headers["Content-Disposition"]

    expected_pagination = PaginationRequestSchema(
        page=1, size=10000, filters=[], sort_orders=[]
    )
    repo_mock.get_fuel_codes_paginated.assert_called_once_with(expected_pagination)

    # Verify file content
    headers = await response.body_iterator.__anext__()
    file_content = await response.body_iterator.__anext__()
    assert (
        b"Status,Prefix,Fuel code,Carbon intensity,EDRMS#,Company,Contact name,Contact email,Application date,Approval date,Effective date,Expiry date,Fuel,Feedstock,Feedstock location,Misc,Fuel production facility city,Fuel production facility province/state,Fuel production facility country,Facility nameplate capacity,Unit,Feedstock transport mode,Finished fuel transport mode,Former company,Notes\n"
        in headers
    )
    assert (
        b"Draft,BCLCF,001.0,10.5,EDRMS-123,XYZ Corp,John Doe,john.doe@example.com,2023-10-01,2023-11-01,2023-12-01,2024-01-01,Diesel,Corn oil,Canada,,Victoria,BC,Canada,1000,MW,Pipeline,Truck,,\n"
        in file_content
    )


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
