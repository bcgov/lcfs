import pytest
from lcfs.web.api.fuel_export.schema import (
    FuelExportSchema,
    FuelTypeSchema,
    FuelCategoryResponseSchema,
    FuelExportsSchema,
    FuelTypeOptionsResponse,
)
from datetime import date
from unittest.mock import MagicMock, patch
from lcfs.web.api.fuel_export.services import FuelExportServices
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.db.models.compliance.FuelExport import FuelExport

# Mock common fuel type and fuel category for reuse
fuel_type = FuelTypeSchema(
    fuel_type_id=1,
    fuel_type="Diesel",
    fossil_derived=True,
    provision_1_id=None,
    provision_2_id=None,
    default_carbon_intensity=10.5,
    units="L",
)

fuel_category = FuelCategoryResponseSchema(
    fuel_category_id=1,
    category="Diesel",
)


@pytest.mark.anyio
async def test_get_fuel_export_options_success(fuel_export_service, mock_repo):
    mock_repo.get_fuel_export_table_options.return_value = []

    result = await fuel_export_service.get_fuel_export_options("2024")

    assert isinstance(result, FuelTypeOptionsResponse)


# get_fuel_export_list
@pytest.mark.anyio
async def test_get_fuel_export_list_success(fuel_export_service, mock_repo):
    mock_repo.get_fuel_export_list.return_value = []

    result = await fuel_export_service.get_fuel_export_list(1)

    assert isinstance(result, FuelExportsSchema)


# get_fuel_exports_paginated
@pytest.mark.anyio
async def test_get_fuel_exports_paginated_success(fuel_export_service, mock_repo):
    mock_repo.get_fuel_exports_paginated.return_value = ([], 0)

    pagination_mock = MagicMock()
    pagination_mock.page = 1
    pagination_mock.size = 10

    result = await fuel_export_service.get_fuel_exports_paginated(pagination_mock, 1)

    assert isinstance(result, FuelExportsSchema)
    assert result.pagination.total == 0
    assert result.pagination.page == 1
    assert result.pagination.size == 10


# update_fuel_export
@pytest.mark.anyio
async def test_update_fuel_export_success(fuel_export_service, mock_repo):
    mock_repo.get_fuel_export_by_id.return_value = FuelExportSchema(
        fuel_export_id=1,
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_type=fuel_type,
        fuel_category_id=1,
        fuel_category=fuel_category,
        quantity=100,
        units="L",
        export_date=date.today(),
    )
    mock_repo.update_fuel_export.return_value = FuelExportSchema(
        fuel_export_id=1,
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_type=fuel_type,
        fuel_category_id=1,
        fuel_category=fuel_category,
        quantity=200,
        units="L",
        export_date=date.today(),
    )

    with patch.object(
        fuel_export_service, "validate_and_calculate_compliance_units"
    ) as mock_validate:
        mock_validate.return_value = FuelExportSchema(
            fuel_export_id=1,
            compliance_report_id=1,
            fuel_type_id=1,
            fuel_type=fuel_type,
            fuel_category_id=1,
            fuel_category=fuel_category,
            quantity=200,
            units="L",
            export_date=date.today(),
        )

        data = FuelExportSchema(
            fuel_export_id=1,
            compliance_report_id=1,
            fuel_type_id=1,
            fuel_type=fuel_type,
            fuel_category_id=1,
            fuel_category=fuel_category,
            quantity=200,
            units="L",
            export_date=date.today(),
        )

        result = await fuel_export_service.update_fuel_export(data)

        assert isinstance(result, FuelExportSchema)
        assert result.quantity == 200
        mock_validate.assert_called_once_with(data)


# create_fuel_export
@pytest.mark.anyio
async def test_create_fuel_export_success(
    fuel_export_service: FuelExportServices, mock_repo: FuelExportRepository
):
    input_data = FuelExportSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_type=fuel_type,
        fuel_category_id=1,
        fuel_category=fuel_category,
        quantity=100,
        units="L",
        export_date=date.today(),
    )

    processed_data = FuelExportSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_type=fuel_type,
        fuel_category_id=1,
        fuel_category=fuel_category,
        quantity=100,
        units="L",
        export_date=date.today(),
        compliance_units=50,
        target_ci=10.0,
        ci_of_fuel=10.5,
        energy_density=45.0,
        eer=1.2,
        energy=4500,
    )

    with patch.object(
        fuel_export_service, "validate_and_calculate_compliance_units"
    ) as mock_validate:
        mock_validate.return_value = processed_data

        mock_created_fuel_export = FuelExport(
            fuel_export_id=1,
            compliance_report_id=processed_data.compliance_report_id,
            fuel_type_id=processed_data.fuel_type_id,
            fuel_category_id=processed_data.fuel_category_id,
            quantity=processed_data.quantity,
            units=processed_data.units,
            export_date=processed_data.export_date,
            compliance_units=processed_data.compliance_units,
            target_ci=processed_data.target_ci,
            ci_of_fuel=processed_data.ci_of_fuel,
            energy_density=processed_data.energy_density,
            eer=processed_data.eer,
            energy=processed_data.energy,
            fuel_type=fuel_type,
            fuel_category=fuel_category,
        )

        mock_repo.create_fuel_export.return_value = mock_created_fuel_export

        # Call the service method
        result = await fuel_export_service.create_fuel_export(input_data)

        # Assertions
        assert isinstance(
            result, FuelExportSchema
        ), "Result should be an instance of FuelExportSchema"

        # Ensure `validate_and_calculate_compliance_units` was called once with `input_data`
        mock_validate.assert_called_once_with(input_data)

        # Ensure `create_fuel_export` was called once with the processed FuelExport data
        mock_repo.create_fuel_export.assert_called_once()


# delete_fuel_export
@pytest.mark.anyio
async def test_delete_fuel_export_success(fuel_export_service, mock_repo):
    mock_repo.delete_fuel_export.return_value = "deleted"

    result = await fuel_export_service.delete_fuel_export(1)

    assert result == "deleted"
