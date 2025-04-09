import pytest
from datetime import datetime
from unittest.mock import AsyncMock, ANY
from uuid import uuid4

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance.ComplianceReport import QuantityUnitsEnum
from lcfs.db.models.compliance.FuelExport import FuelExport
from lcfs.web.api.fuel_code.repo import CarbonIntensityResult
from lcfs.web.api.fuel_export.schema import (
    FuelExportCreateUpdateSchema,
    FuelExportSchema,
    DeleteFuelExportResponseSchema,
)


FUEL_EXPORT_EXCLUDE_FIELDS = {
    "id",
    "fuel_export_id",
    "compliance_period",
    "deleted",
    "group_uuid",
    "version",
    "action_type",
    "units",
    "is_new_supplemental_entry",
}

# Example test cases from the dataset
test_cases = [
    {
        "description": "Jet fuel, default carbon intensity, liters",
        "input": {
            "quantity": 100000,
            "units": "L",
            "target_ci": 88.83,
            "ci_of_fuel": 88.83,
            "energy_density": 36,
            "eer": 1,
        },
        "expected_compliance_units": 0,
    },
    {
        "description": "Diesel, prescribed carbon intensity, liters",
        "input": {
            "quantity": 100000,
            "units": "L",
            "target_ci": 79.28,
            "ci_of_fuel": 94.38,
            "energy_density": 38.65,
            "eer": 1,
        },
        "expected_compliance_units": 0,
    },
    {
        "description": "Gasoline, default carbon intensity, liters",
        "input": {
            "quantity": 100000,
            "units": "L",
            "target_ci": 78.68,
            "ci_of_fuel": 93.67,
            "energy_density": 34.69,
            "eer": 1,
        },
        "expected_compliance_units": 0,
    },
    {
        "description": "Diesel, fuel code, kWh",
        "input": {
            "quantity": 100000,
            "units": "kWh",
            "target_ci": 79.28,
            "ci_of_fuel": 12.14,
            "energy_density": 3.6,
            "eer": 2.5,
        },
        "expected_compliance_units": -67,
    },
    {
        "description": "Gasoline, default carbon intensity, m³",
        "input": {
            "quantity": 100000,
            "units": "m³",
            "target_ci": 78.68,
            "ci_of_fuel": 63.91,
            "energy_density": 38.27,
            "eer": 0.9,
        },
        "expected_compliance_units": -26,
    },
]


# Adjusted create_sample_fe_data function (if necessary)
def create_sample_fe_data():
    return FuelExportCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=1,
        fuel_code_id=1,
        compliance_period="2024",  # Schema-only field
        quantity=1000.0,
        units="L",
        energy_density=35.0,
        group_uuid=str(uuid4()),
        version=0,
        provisionOfTheActId=123,
        exportDate=datetime.now().date(),
    )


# Adjusted tests
@pytest.mark.anyio
async def test_create_fuel_export_success(
    fuel_export_action_service, mock_repo, mock_fuel_code_repo
):
    fe_data = create_sample_fe_data()

    mock_repo.get_compliance_period_id = AsyncMock(return_value=1)

    # Mock the response from get_standardized_fuel_data
    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=50.0,
        target_ci=80.0,
        eer=1.0,
        energy_density=35.0,
        uci=None,
    )

    fe_data.fuel_type_id = 3
    fe_data.fuel_category_id = 2
    fe_data.provision_of_the_act_id = 3

    # Exclude invalid fields and set related objects
    fe_data_dict = fe_data.model_dump(exclude=FUEL_EXPORT_EXCLUDE_FIELDS)

    # Mock the created fuel export
    created_export = FuelExport(
        **fe_data_dict,
    )
    created_export.compliance_units = -100
    created_export.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    created_export.fuel_category = {"category": "Diesel"}
    created_export.units = "Litres"
    created_export.provision_of_the_act = {
        "provision_of_the_act_id": 3,
        "name": "Test Provision",
    }
    mock_repo.create_fuel_export.return_value = created_export
    mock_repo.get_fuel_export_by_id = AsyncMock(return_value=created_export)

    # Call the method under test with compliance_period
    result = await fuel_export_action_service.create_fuel_export(fe_data)
    # Assertions
    assert result == FuelExportSchema.model_validate(created_export)
    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once_with(
        fuel_type_id=fe_data.fuel_type_id,
        fuel_category_id=fe_data.fuel_category_id,
        end_use_id=fe_data.end_use_id,
        fuel_code_id=fe_data.fuel_code_id,
        compliance_period=fe_data.compliance_period,
        provision_of_the_act=ANY,
        export_date=ANY,
    )
    mock_repo.create_fuel_export.assert_awaited_once()
    # Ensure compliance units were calculated correctly
    assert result.compliance_units < 0


@pytest.mark.anyio
async def test_update_fuel_export_success_existing_report(
    fuel_export_action_service, mock_repo, mock_fuel_code_repo
):
    fe_data = create_sample_fe_data()

    mock_repo.get_compliance_period_id = AsyncMock(return_value=1)

    # Exclude invalid fields
    fe_data_dict = fe_data.model_dump(exclude=FUEL_EXPORT_EXCLUDE_FIELDS)

    # Mock existing export with matching compliance_report_id
    existing_export = FuelExport(
        **fe_data_dict,
        fuel_export_id=1,
    )
    existing_export.compliance_units = -100
    existing_export.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    existing_export.fuel_category = {"category": "Diesel"}
    existing_export.units = "Litres"
    existing_export.provision_of_the_act = {
        "provision_of_the_act_id": 123,
        "name": "Test Provision",
    }
    mock_repo.get_fuel_export_by_id.return_value = existing_export

    # Mock the response from get_standardized_fuel_data
    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=55.0,
        target_ci=85.0,
        eer=1.2,
        energy_density=36.0,
        uci=None,
    )

    # Mock the updated fuel export
    updated_export = FuelExport(
        **fe_data_dict,
        fuel_export_id=1,
    )
    updated_export.compliance_units = -150
    updated_export.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    updated_export.fuel_category = {"category": "Diesel"}
    updated_export.units = "Litres"

    updated_export.provision_of_the_act = {
        "provision_of_the_act_id": 123,
        "name": "Test Provision",
    }
    mock_repo.update_fuel_export.return_value = updated_export

    # Call the method under test with compliance_period
    result = await fuel_export_action_service.update_fuel_export(fe_data)

    # Assertions
    assert result == FuelExportSchema.model_validate(updated_export)
    mock_repo.get_fuel_export_by_id.assert_awaited_once_with(fe_data.fuel_export_id)
    mock_repo.update_fuel_export.assert_awaited_once()
    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once()
    # Ensure compliance units were updated correctly
    assert result.compliance_units == -150


@pytest.mark.anyio
async def test_update_fuel_export_create_new_version(
    fuel_export_action_service, mock_repo, mock_fuel_code_repo
):
    fe_data = create_sample_fe_data()
    fe_data.compliance_report_id = 2  # Different compliance report ID
    fe_data.fuel_export_id = 3

    # Exclude invalid fields
    fe_data_dict = fe_data.model_dump(exclude=FUEL_EXPORT_EXCLUDE_FIELDS)

    # Mock existing export with different compliance_report_id
    existing_export = FuelExport(
        **fe_data_dict,
        fuel_export_id=1,
    )
    existing_export.compliance_report_id = 1  # Original compliance_report_id
    existing_export.compliance_units = -100
    existing_export.version = 0
    existing_export.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    existing_export.fuel_category = {"category": "Diesel"}
    existing_export.units = "Litres"
    existing_export.provision_of_the_act = {
        "provision_of_the_act_id": 123,
        "name": "Test Provision",
    }
    mock_repo.get_fuel_export_by_id.return_value = existing_export

    # Mock the response from get_standardized_fuel_data
    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=60.0,
        target_ci=90.0,
        eer=1.5,
        energy_density=37.0,
        uci=None,
    )

    mock_repo.get_compliance_period_id = AsyncMock(return_value=1)

    # Mock the newly created export (new version)
    new_export = FuelExport(
        **fe_data_dict,
        fuel_export_id=2,
        version=existing_export.version + 1,
    )
    new_export.compliance_units = -150
    new_export.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    new_export.fuel_category = {"category": "Diesel"}
    new_export.units = "Litres"
    new_export.provision_of_the_act = {
        "provision_of_the_act_id": 123,
        "name": "Test Provision",
    }
    mock_repo.create_fuel_export.return_value = new_export

    # Call the method under test with compliance_period
    result = await fuel_export_action_service.update_fuel_export(fe_data)

    # Assertions
    assert result == FuelExportSchema.model_validate(new_export)
    mock_repo.get_fuel_export_by_id.assert_awaited_once_with(fe_data.fuel_export_id)
    mock_repo.create_fuel_export.assert_awaited_once()
    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once()
    # Ensure compliance units were calculated correctly
    assert result.compliance_units == -150


@pytest.mark.anyio
async def test_delete_fuel_export_success(fuel_export_action_service, mock_repo):
    fe_data = create_sample_fe_data()

    # Exclude invalid fields
    fe_data_dict = fe_data.model_dump(exclude=FUEL_EXPORT_EXCLUDE_FIELDS)

    # Mock existing export
    existing_export = FuelExport(
        **fe_data_dict,
        fuel_export_id=1,
        version=0,
        action_type=ActionTypeEnum.CREATE,
    )
    mock_repo.get_latest_fuel_export_by_group_uuid.return_value = existing_export

    # Call the method under test
    result = await fuel_export_action_service.delete_fuel_export(fe_data)

    # Assertions
    assert isinstance(result, DeleteFuelExportResponseSchema)
    assert result.message == "Marked as deleted."
    mock_repo.get_latest_fuel_export_by_group_uuid.assert_awaited_once_with(
        fe_data.group_uuid
    )
    mock_repo.delete_fuel_export.assert_awaited_once()


@pytest.mark.anyio
async def test_delete_fuel_export_changelog(fuel_export_action_service, mock_repo):
    fe_data = create_sample_fe_data()

    # Exclude invalid fields
    fe_data_dict = fe_data.model_dump(exclude=FUEL_EXPORT_EXCLUDE_FIELDS)
    fe_data.compliance_report_id = 2

    # Mock existing export
    existing_export = FuelExport(
        **fe_data_dict,
        fuel_export_id=1,
        version=0,
        action_type=ActionTypeEnum.CREATE,
    )
    existing_export.compliance_units = -100
    existing_export.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    existing_export.fuel_category = {"category": "Diesel"}
    existing_export.units = "Litres"
    mock_repo.get_latest_fuel_export_by_group_uuid.return_value = existing_export

    # Mock the deletion export
    deleted_export = FuelExport(
        **fe_data_dict,
        fuel_export_id=2,
        version=1,
        action_type=ActionTypeEnum.DELETE,
    )
    deleted_export.compliance_units = 0
    deleted_export.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    deleted_export.fuel_category = {"category": "Diesel"}
    deleted_export.units = "Litres"
    mock_repo.create_fuel_export.return_value = deleted_export

    # Call the method under test
    result = await fuel_export_action_service.delete_fuel_export(fe_data)

    # Assertions
    assert isinstance(result, DeleteFuelExportResponseSchema)
    assert result.message == "Marked as deleted."
    mock_repo.get_latest_fuel_export_by_group_uuid.assert_awaited_once_with(
        fe_data.group_uuid
    )
    mock_repo.create_fuel_export.assert_awaited_once()


@pytest.mark.anyio
async def test_populate_fuel_export_fields(
    fuel_export_action_service, mock_fuel_code_repo
):
    fe_data = create_sample_fe_data()

    # Exclude invalid fields
    fe_data_dict = fe_data.model_dump(exclude=FUEL_EXPORT_EXCLUDE_FIELDS)

    # Create a FuelExport instance without populated fields
    fuel_export = FuelExport(**fe_data_dict)

    # Mock standardized fuel data
    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=50.0,
        target_ci=80.0,
        eer=1.0,
        energy_density=fe_data.energy_density,
        uci=None,
    )

    # Call the method under test
    populated_export = await fuel_export_action_service._populate_fuel_export_fields(
        fuel_export, fe_data
    )

    # Assertions
    assert populated_export.units == QuantityUnitsEnum(fe_data.units)
    assert populated_export.ci_of_fuel == 50.0
    assert populated_export.target_ci == 80.0
    assert populated_export.eer == 1  # Default EER
    assert populated_export.energy_density == fe_data.energy_density
    # Energy calculation
    assert populated_export.energy == round(fe_data.energy_density * fe_data.quantity)
    # Compliance units calculation (should be negative)
    assert populated_export.compliance_units < 0

    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once_with(
        fuel_type_id=fuel_export.fuel_type_id,
        fuel_category_id=fuel_export.fuel_category_id,
        end_use_id=fuel_export.end_use_id,
        fuel_code_id=fuel_export.fuel_code_id,
        compliance_period=fe_data.compliance_period,
        provision_of_the_act=ANY,
        export_date=ANY,
    )


@pytest.mark.anyio
@pytest.mark.parametrize("case", test_cases)
async def test_compliance_units_calculation(
    case, fuel_export_action_service, mock_repo, mock_fuel_code_repo
):
    # Mock repository methods
    mock_repo.create_fuel_export = AsyncMock()
    mock_repo.get_fuel_export_by_id = AsyncMock()

    # Create input data
    fe_data = FuelExportCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=3,
        fuel_category_id=2,
        end_use_id=1,
        fuel_code_id=1,
        compliance_period="2024",
        quantity=case["input"]["quantity"],
        units=case["input"]["units"],
        energy_density=case["input"]["energy_density"],
        group_uuid=str(uuid4()),
        version=0,
        provisionOfTheActId=123,
        provisionOfTheAct="Test Provision",
        exportDate=datetime.now().date(),
    )

    # Mock standardized fuel data
    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=case["input"]["ci_of_fuel"],
        target_ci=case["input"]["target_ci"],
        eer=case["input"]["eer"],
        energy_density=case["input"]["energy_density"],
        uci=None,
    )

    # Create a complete mock FuelExport instance
    async def create_fuel_export_side_effect(fuel_export: FuelExport):
        """Simulate repository behavior with complete object"""
        mock_export = FuelExport(
            fuel_export_id=1,
            compliance_report_id=fe_data.compliance_report_id,
            fuel_type_id=fe_data.fuel_type_id,
            fuel_category_id=fe_data.fuel_category_id,
            end_use_id=fe_data.end_use_id,
            fuel_code_id=fe_data.fuel_code_id,
            quantity=fe_data.quantity,
            units=fe_data.units,
            energy_density=fe_data.energy_density,
            group_uuid=fe_data.group_uuid,
            version=0,
            provision_of_the_act_id=fe_data.provision_of_the_act_id,  # Use the correct field name
            export_date=fe_data.export_date,
            ci_of_fuel=case["input"]["ci_of_fuel"],
            target_ci=case["input"]["target_ci"],
            eer=case["input"]["eer"],
            energy=round(fe_data.energy_density * fe_data.quantity),
            compliance_units=case["expected_compliance_units"],
        )

        # Add related objects
        mock_export.fuel_type = {
            "fuel_type_id": fe_data.fuel_type_id,
            "fuel_type": "Electricity",
            "units": "kWh",
        }
        mock_export.fuel_category = {
            "fuel_category_id": fe_data.fuel_category_id,
            "category": "Diesel",
        }
        mock_export.provision_of_the_act = {
            "provision_of_the_act_id": fe_data.provision_of_the_act_id,
            "name": "Test Provision",
        }

        return mock_export

    # Set up repository mocks
    mock_created_export = await create_fuel_export_side_effect(FuelExport())
    mock_repo.create_fuel_export.return_value = mock_created_export

    # Call service method
    result = await fuel_export_action_service.create_fuel_export(fe_data)

    # Assertions
    assert result.compliance_units == case["expected_compliance_units"]
    assert result.fuel_type_id == fe_data.fuel_type_id
    assert result.fuel_category_id == fe_data.fuel_category_id
    assert (
        result.provision_of_the_act_id == fe_data.provision_of_the_act_id
    )  # Use correct field name
    assert result.quantity == fe_data.quantity

    # Verify mock calls
    mock_repo.create_fuel_export.assert_awaited_once()
    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once_with(
        fuel_type_id=fe_data.fuel_type_id,
        fuel_category_id=fe_data.fuel_category_id,
        end_use_id=fe_data.end_use_id,
        fuel_code_id=fe_data.fuel_code_id,
        compliance_period=fe_data.compliance_period,
        provision_of_the_act=ANY,
        export_date=ANY,
    )
    mock_repo.create_fuel_export.assert_awaited_once()


@pytest.mark.anyio
async def test_create_fuel_export_unknown_provision_no_ci_found(
    fuel_export_action_service, mock_fuel_code_repo
):
    export_date = datetime.now().date()
    fe_data = FuelExportCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=1,
        compliance_period="2024",
        quantity=5000,
        units="L",
        energy_density=35.0,
        group_uuid=str(uuid4()),
        version=0,
        provisionOfTheActId=999,
        provisionOfTheAct="unknown",  # triggers unknown branch
        exportDate=export_date,
    )

    # Simulate that the repository cannot find any active fuel codes in the last 12 months.
    mock_fuel_code_repo.get_standardized_fuel_data.side_effect = ValueError(
        "No active fuel codes found within the last 12 months for 'unknown' provision_of_the_act."
    )

    with pytest.raises(
        ValueError, match="No active fuel codes found within the last 12 months"
    ):
        await fuel_export_action_service.create_fuel_export(fe_data)


@pytest.mark.anyio
async def test_create_fuel_export_unknown_provision_happy_path(
    fuel_export_action_service, mock_fuel_code_repo, mock_repo
):
    export_date = datetime.now().date()
    fe_data = FuelExportCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=1,
        fuel_code_id=None,
        compliance_period="2024",
        quantity=2000,
        units="L",
        energy_density=30.0,
        group_uuid=str(uuid4()),
        version=0,
        provision_of_the_act_id=123,
        provision_of_the_act="unknown",
        export_date=export_date,
    )

    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=42.0,
        target_ci=80.0,
        eer=1.0,
        energy_density=30.0,
        uci=None,
    )

    created_export = FuelExport(
        fuel_export_id=1,
        compliance_report_id=fe_data.compliance_report_id,
        fuel_type_id=fe_data.fuel_type_id,
        fuel_category_id=fe_data.fuel_category_id,
        end_use_id=fe_data.end_use_id,
        fuel_code_id=fe_data.fuel_code_id,
        quantity=fe_data.quantity,
        units=fe_data.units,
        energy_density=fe_data.energy_density,
        group_uuid=fe_data.group_uuid,
        version=0,
        provision_of_the_act_id=fe_data.provision_of_the_act_id,
        export_date=fe_data.export_date,
        ci_of_fuel=42.0,
        target_ci=80.0,
        eer=1.0,
        energy=round(fe_data.energy_density * fe_data.quantity),
        compliance_units=-42,
    )

    created_export.fuel_type = {
        "fuel_type_id": fe_data.fuel_type_id,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    created_export.fuel_category = {
        "fuel_category_id": fe_data.fuel_category_id,
        "category": "Diesel",
    }
    created_export.provision_of_the_act = {
        "provision_of_the_act_id": fe_data.provision_of_the_act_id,
        "name": "unknown",
    }
    mock_repo.create_fuel_export.return_value = created_export

    result = await fuel_export_action_service.create_fuel_export(fe_data)

    assert isinstance(result, FuelExportSchema)
    assert result.ci_of_fuel == 42.0
    assert result.quantity == 2000

    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once_with(
        fuel_type_id=fe_data.fuel_type_id,
        fuel_category_id=fe_data.fuel_category_id,
        end_use_id=fe_data.end_use_id,
        fuel_code_id=None,
        compliance_period=fe_data.compliance_period,
        provision_of_the_act="unknown",
        export_date=export_date,
    )

    mock_repo.create_fuel_export.assert_awaited_once()
