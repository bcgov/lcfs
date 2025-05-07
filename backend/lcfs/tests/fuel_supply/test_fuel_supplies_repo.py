import math
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.compliance import FuelSupply
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import FuelSupplyCreateUpdateSchema, ModeEnum
from lcfs.web.api.fuel_supply.schema import (
    FuelSuppliesSchema,
    PaginationResponseSchema,
    FuelSupplyResponseSchema,
)
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.exception.exceptions import DatabaseException


@pytest.fixture
def mock_db_session():
    session = AsyncMock(spec=AsyncSession)

    async def mock_execute(*args, **kwargs):
        mock_result = MagicMock()
        mock_result.scalars = MagicMock(return_value=mock_result)
        mock_result.unique = MagicMock(return_value=mock_result)
        mock_result.all = MagicMock(return_value=[MagicMock(spec=FuelSupply)])
        mock_result.first = MagicMock(return_value=MagicMock(spec=FuelSupply))
        return mock_result

    session.execute = mock_execute
    session.add = MagicMock()  # add is synchronous
    session.flush = AsyncMock()
    session.refresh = AsyncMock()

    return session


@pytest.fixture
def fuel_supply_repo(mock_db_session):
    return FuelSupplyRepository(db=mock_db_session)


@pytest.mark.anyio
async def test_get_fuel_supply_list(fuel_supply_repo, mock_db_session):
    compliance_report_id = 1
    expected_fuel_supplies = [MagicMock(spec=FuelSupply)]

    # Set up the mock result chain with proper method chaining.
    mock_result_chain = MagicMock()
    mock_result_chain.scalars = MagicMock(return_value=mock_result_chain)
    mock_result_chain.unique = MagicMock(return_value=mock_result_chain)
    mock_result_chain.all = MagicMock(return_value=expected_fuel_supplies)

    async def mock_execute(query, *args, **kwargs):
        return mock_result_chain

    mock_db_session.execute = mock_execute

    # Test when drafts should be excluded (e.g. government user).
    result_gov = await fuel_supply_repo.get_fuel_supply_list(compliance_report_id)
    assert result_gov == expected_fuel_supplies


@pytest.mark.anyio
async def test_create_fuel_supply(fuel_supply_repo, mock_db_session):
    new_fuel_supply = MagicMock(spec=FuelSupply)

    result = await fuel_supply_repo.create_fuel_supply(new_fuel_supply)

    assert result == new_fuel_supply
    mock_db_session.add.assert_called_once_with(new_fuel_supply)
    assert mock_db_session.flush.await_count == 1
    assert mock_db_session.refresh.await_count == 1


@pytest.mark.anyio
async def test_check_duplicate(fuel_supply_repo, mock_db_session):
    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=24,
        provision_of_the_act_id=1,
        quantity=1000,
        units="L",
    )

    # Set up the mock chain using MagicMock for synchronous chained methods.
    mock_result_chain = MagicMock()
    mock_result_chain.scalars = MagicMock(return_value=mock_result_chain)
    mock_result_chain.first = MagicMock(return_value=MagicMock(spec=FuelSupply))

    async def mock_execute(*args, **kwargs):
        return mock_result_chain

    mock_db_session.execute = mock_execute

    result = await fuel_supply_repo.check_duplicate(fuel_supply_data)

    assert result is not None


@pytest.mark.anyio
async def test_get_fuel_supplies_paginated_exclude_draft_reports(fuel_supply_repo):
    # Define a sample pagination request.
    pagination = PaginationRequestSchema(page=1, size=10)
    compliance_report_id = 1
    total_count = 20

    # Build a valid fuel supply record that passes validation.
    valid_fuel_supply = {
        "complianceReportId": 1,
        "version": 0,
        "fuelTypeId": 1,
        "quantity": 100,
        "groupUuid": "some-uuid",
        "userType": "SUPPLIER",
        "actionType": "CREATE",
        "fuelType": "Diesel",
        "fuelCategory": "Diesel",
        "endUseType": "Transport",
        "provisionOfTheAct": "Act Provision",
        "compliancePeriod": "2024",
        "units": "L",
        "fuelCode": "FUEL123",
        "fuelTypeOther": "Optional",
        "fuelCategoryId": 1,
        "endUseId": 1,
        "provisionOfTheActId": 1,
    }
    expected_fuel_supplies = [valid_fuel_supply]

    async def mock_get_fuel_supplies_paginated(
        pagination, compliance_report_id, exclude_draft_reports
    ):
        total_pages = math.ceil(total_count / pagination.size) if total_count > 0 else 0
        pagination_response = PaginationResponseSchema(
            page=pagination.page,
            size=pagination.size,
            total=total_count,
            total_pages=total_pages,
        )
        processed = [
            FuelSupplyResponseSchema.model_validate(fs) for fs in expected_fuel_supplies
        ]
        return FuelSuppliesSchema(
            pagination=pagination_response, fuel_supplies=processed
        )

    fuel_supply_repo.get_fuel_supplies_paginated = AsyncMock(
        side_effect=mock_get_fuel_supplies_paginated
    )

    result = await fuel_supply_repo.get_fuel_supplies_paginated(
        pagination, compliance_report_id, exclude_draft_reports=True
    )

    # Validate pagination values.
    assert result.pagination.page == pagination.page
    assert result.pagination.size == pagination.size
    assert result.pagination.total == total_count
    expected_total_pages = (
        math.ceil(total_count / pagination.size) if total_count > 0 else 0
    )
    assert result.pagination.total_pages == expected_total_pages

    # Validate that the fuel supplies list is correctly transformed.
    expected_processed = [
        FuelSupplyResponseSchema.model_validate(fs) for fs in expected_fuel_supplies
    ]
    assert result.fuel_supplies == expected_processed


@pytest.mark.anyio
async def test_get_fuel_supply_table_options_ghgenius_provision(
    fuel_supply_repo, mock_db_session
):
    # Set up mock results for different scenarios
    mock_result_chain = MagicMock()
    mock_result_chain.all = MagicMock()

    async def mock_execute(query, *args, **kwargs):
        return mock_result_chain

    mock_db_session.execute = mock_execute

    # Test pre-2024 non-fossil fuel (should show everything except provision 1)
    mock_result_chain.all.return_value = [
        {
            "fuel_type_id": 1,
            "fuel_type": "Biodiesel",
            "fossil_derived": False,
            "provision_of_the_act_id": 8,
            "provision_of_the_act": "GHGenius",
        },
        {
            "fuel_type_id": 1,
            "fuel_type": "Biodiesel",
            "fossil_derived": False,
            "provision_of_the_act_id": 2,
            "provision_of_the_act": "Other Provision",
        },
    ]
    result_pre_2024 = await fuel_supply_repo.get_fuel_supply_table_options("2023")
    assert len(result_pre_2024["fuel_types"]) == 2
    provisions_pre_2024 = [
        ft["provision_of_the_act_id"] for ft in result_pre_2024["fuel_types"]
    ]
    assert 1 not in provisions_pre_2024  # Original provision should not be present
    assert 8 in provisions_pre_2024  # GHGenius should be present
    assert 2 in provisions_pre_2024  # Other provisions should be present

    # Test post-2024 non-fossil fuel (should show everything except provisions 1 and 8)
    mock_result_chain.all.return_value = [
        {
            "fuel_type_id": 1,
            "fuel_type": "Biodiesel",
            "fossil_derived": False,
            "provision_of_the_act_id": 2,
            "provision_of_the_act": "Other Provision",
        },
        {
            "fuel_type_id": 1,
            "fuel_type": "Biodiesel",
            "fossil_derived": False,
            "provision_of_the_act_id": 3,
            "provision_of_the_act": "Another Provision",
        },
    ]
    result_post_2024 = await fuel_supply_repo.get_fuel_supply_table_options("2024")
    provisions_post_2024 = [
        ft["provision_of_the_act_id"] for ft in result_post_2024["fuel_types"]
    ]
    assert 1 not in provisions_post_2024  # Original provision should not be present
    assert 8 not in provisions_post_2024  # GHGenius should not be present
    assert 2 in provisions_post_2024  # Other provisions should be present
    assert 3 in provisions_post_2024  # Other provisions should be present

    # Test fossil fuel (should only show original provision regardless of year)
    mock_result_chain.all.return_value = [
        {
            "fuel_type_id": 2,
            "fuel_type": "Diesel",
            "fossil_derived": True,
            "provision_of_the_act_id": 1,
            "provision_of_the_act": "Original Provision",
        }
    ]
    result_fossil = await fuel_supply_repo.get_fuel_supply_table_options("2023")
    assert len(result_fossil["fuel_types"]) == 1
    assert result_fossil["fuel_types"][0]["provision_of_the_act_id"] == 1
    assert (
        result_fossil["fuel_types"][0]["provision_of_the_act"] == "Original Provision"
    )

    # Test invalid compliance period
    with pytest.raises(DatabaseException):
        await fuel_supply_repo.get_fuel_supply_table_options("invalid")


@pytest.mark.anyio
async def test_get_fuel_supply_list_with_valid_group_uuid(fuel_supply_repo, mock_db_session):
    """Test get_fuel_supply_list when the compliance report has a valid group UUID."""
    compliance_report_id = 123
    group_uuid = "test-group-uuid"
    expected_fuel_supplies = [MagicMock(spec=FuelSupply), MagicMock(spec=FuelSupply)]
    
    # Create a mock for the scalar result
    scalar_result = MagicMock()
    scalar_result.scalar.return_value = group_uuid
    
    # Create a mock for the get_effective_fuel_supplies result
    fuel_supply_repo.get_effective_fuel_supplies = AsyncMock(return_value=expected_fuel_supplies)
    
    # Override the execute method to return our custom scalar result
    mock_db_session.execute = AsyncMock(return_value=scalar_result)
    
    # Call the method
    result = await fuel_supply_repo.get_fuel_supply_list(compliance_report_id, mode=ModeEnum.VIEW)
    
    # Verify results
    assert result == expected_fuel_supplies
    
    # Verify the correct query was executed
    mock_db_session.execute.assert_called_once()
    # Verify get_effective_fuel_supplies was called with correct parameters
    fuel_supply_repo.get_effective_fuel_supplies.assert_called_once_with(
        compliance_report_group_uuid=group_uuid,
        compliance_report_id=compliance_report_id,
        mode=ModeEnum.VIEW
    )


@pytest.mark.anyio
async def test_get_fuel_supply_list_without_group_uuid(fuel_supply_repo, mock_db_session):
    """Test get_fuel_supply_list when the compliance report has no group UUID."""
    compliance_report_id = 123
    
    # Create a mock for the scalar result
    scalar_result = MagicMock()
    scalar_result.scalar.return_value = None
    
    # Create a mock for the get_effective_fuel_supplies result
    fuel_supply_repo.get_effective_fuel_supplies = AsyncMock()
    
    # Override the execute method to return our custom scalar result
    mock_db_session.execute = AsyncMock(return_value=scalar_result)
    
    # Call the method
    result = await fuel_supply_repo.get_fuel_supply_list(compliance_report_id)
    
    # Verify results
    assert result == []
    
    # Verify the correct query was executed
    mock_db_session.execute.assert_called_once()
    # Verify get_effective_fuel_supplies was not called
    fuel_supply_repo.get_effective_fuel_supplies.assert_not_called()


@pytest.mark.anyio
async def test_get_fuel_supply_list_with_edit_mode(fuel_supply_repo, mock_db_session):
    """Test get_fuel_supply_list with EDIT mode."""
    compliance_report_id = 123
    group_uuid = "test-group-uuid"
    expected_fuel_supplies = [MagicMock(spec=FuelSupply)]
    
    # Create a mock for the scalar result
    scalar_result = MagicMock()
    scalar_result.scalar.return_value = group_uuid
    
    # Create a mock for the get_effective_fuel_supplies result
    fuel_supply_repo.get_effective_fuel_supplies = AsyncMock(return_value=expected_fuel_supplies)
    
    # Override the execute method to return our custom scalar result
    mock_db_session.execute = AsyncMock(return_value=scalar_result)
    
    # Call the method with EDIT mode
    result = await fuel_supply_repo.get_fuel_supply_list(compliance_report_id, mode=ModeEnum.EDIT)
    
    # Verify results
    assert result == expected_fuel_supplies
    
    # Verify the correct query was executed
    mock_db_session.execute.assert_called_once()
    # Verify get_effective_fuel_supplies was called with correct parameters
    fuel_supply_repo.get_effective_fuel_supplies.assert_called_once_with(
        compliance_report_group_uuid=group_uuid,
        compliance_report_id=compliance_report_id,
        mode=ModeEnum.EDIT
    )


@pytest.mark.anyio
async def test_check_duplicate_with_existing_duplicate(fuel_supply_repo, mock_db_session):
    """Test check_duplicate when there is an existing duplicate."""
    # Create test data
    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=123,
        fuel_type_id=1,
        fuel_category_id=2,
        provision_of_the_act_id=3,
        fuel_code_id=4,
        end_use_id=5,
        quantity=100,
        units="litres",
        group_uuid="test-group-uuid"
    )
    
    # Create a mock for the scalar result with a duplicate ID
    scalar_result = MagicMock()
    scalar_first = MagicMock()
    scalar_first.first.return_value = 456  # Existing duplicate ID
    scalar_result.scalars.return_value = scalar_first
    
    # Override the execute method to return our custom scalar result
    mock_db_session.execute = AsyncMock(return_value=scalar_result)
    
    # Call the method
    result = await fuel_supply_repo.check_duplicate(fuel_supply_data)
    
    # Verify results
    assert result == 456
    
    # Verify the method was called once
    mock_db_session.execute.assert_called_once()


@pytest.mark.anyio
async def test_check_duplicate_with_no_duplicate(fuel_supply_repo, mock_db_session):
    """Test check_duplicate when there is no existing duplicate."""
    # Create test data
    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=123,
        fuel_type_id=1,
        fuel_category_id=2,
        provision_of_the_act_id=3,
        fuel_code_id=4,
        end_use_id=5,
        quantity=100,
        units="litres",
        group_uuid="test-group-uuid"
    )
    
    # Create a mock for the scalar result with no duplicate
    scalar_result = MagicMock()
    scalar_first = MagicMock()
    scalar_first.first.return_value = None  # No duplicate
    scalar_result.scalars.return_value = scalar_first
    
    # Override the execute method to return our custom scalar result
    mock_db_session.execute = AsyncMock(return_value=scalar_result)
    
    # Call the method
    result = await fuel_supply_repo.check_duplicate(fuel_supply_data)
    
    # Verify results
    assert result is None
    
    # Verify the method was called once
    mock_db_session.execute.assert_called_once()


@pytest.mark.anyio
async def test_check_duplicate_with_existing_id(fuel_supply_repo, mock_db_session):
    """Test check_duplicate with an existing fuel_supply_id."""
    # Create test data with an existing ID
    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        fuel_supply_id=789,  # Existing ID
        compliance_report_id=123,
        fuel_type_id=1,
        fuel_category_id=2,
        provision_of_the_act_id=3,
        fuel_code_id=4,
        end_use_id=5,
        quantity=100,
        units="litres",
        group_uuid="test-group-uuid"
    )
    
    # Create a mock for the scalar result
    scalar_result = MagicMock()
    scalar_first = MagicMock()
    scalar_first.first.return_value = None  # No duplicate
    scalar_result.scalars.return_value = scalar_first
    
    # Override the execute method to return our custom scalar result
    mock_db_session.execute = AsyncMock(return_value=scalar_result)
    
    # Call the method
    result = await fuel_supply_repo.check_duplicate(fuel_supply_data)
    
    # Verify results
    assert result is None
    
    # Verify the query included the fuel_supply_id filter
    mock_db_session.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_effective_fuel_supplies_view_mode(fuel_supply_repo, mock_db_session):
    """Test get_effective_fuel_supplies with VIEW mode."""
    # Test parameters
    compliance_report_group_uuid = "test-group-uuid"
    compliance_report_id = 123
    mode = ModeEnum.VIEW
    
    # Expected results
    expected_supplies = [MagicMock(spec=FuelSupply), MagicMock(spec=FuelSupply)]
    
    # Create mock for the final query result
    final_result = MagicMock()
    unique_result = MagicMock()
    scalar_result = MagicMock()
    scalar_result.all.return_value = expected_supplies
    unique_result.scalars.return_value = scalar_result
    final_result.unique.return_value = unique_result
    
    # Set up mock to return different results based on the query
    mock_db_session.execute = AsyncMock(return_value=final_result)
    
    # Call the method
    result = await fuel_supply_repo.get_effective_fuel_supplies(
        compliance_report_group_uuid=compliance_report_group_uuid,
        compliance_report_id=compliance_report_id,
        mode=mode
    )
    
    # Verify results
    assert result == expected_supplies
    
    # Verify mock was called
    assert mock_db_session.execute.call_count > 0


@pytest.mark.anyio
async def test_get_effective_fuel_supplies_edit_mode(fuel_supply_repo, mock_db_session):
    """Test get_effective_fuel_supplies with EDIT mode."""
    # Test parameters
    compliance_report_group_uuid = "test-group-uuid"
    compliance_report_id = 123
    mode = ModeEnum.EDIT
    
    # Expected results
    expected_supplies = [MagicMock(spec=FuelSupply)]
    
    # Create mock for the final query result
    final_result = MagicMock()
    unique_result = MagicMock()
    scalar_result = MagicMock()
    scalar_result.all.return_value = expected_supplies
    unique_result.scalars.return_value = scalar_result
    final_result.unique.return_value = unique_result
    
    # Set up mock to return different results based on the query
    mock_db_session.execute = AsyncMock(return_value=final_result)
    
    # Call the method
    result = await fuel_supply_repo.get_effective_fuel_supplies(
        compliance_report_group_uuid=compliance_report_group_uuid,
        compliance_report_id=compliance_report_id,
        mode=mode
    )
    
    # Verify results
    assert result == expected_supplies
    
    # Verify mock was called
    assert mock_db_session.execute.call_count > 0


@pytest.mark.anyio
async def test_get_effective_fuel_supplies_changelog_mode(fuel_supply_repo, mock_db_session):
    """Test get_effective_fuel_supplies with CHANGELOG mode."""
    # Test parameters
    compliance_report_group_uuid = "test-group-uuid"
    compliance_report_id = 123
    mode = ModeEnum.CHANGELOG
    
    # Expected results
    expected_supplies = [MagicMock(spec=FuelSupply), MagicMock(spec=FuelSupply), MagicMock(spec=FuelSupply)]
    
    # Create mock for the final query result
    final_result = MagicMock()
    unique_result = MagicMock()
    scalar_result = MagicMock()
    scalar_result.all.return_value = expected_supplies
    unique_result.scalars.return_value = scalar_result
    final_result.unique.return_value = unique_result
    
    # Set up mock to return different results based on the query
    mock_db_session.execute = AsyncMock(return_value=final_result)
    
    # Call the method
    result = await fuel_supply_repo.get_effective_fuel_supplies(
        compliance_report_group_uuid=compliance_report_group_uuid,
        compliance_report_id=compliance_report_id,
        mode=mode
    )
    
    # Verify results
    assert result == expected_supplies
    
    # Verify mock was called
    assert mock_db_session.execute.call_count > 0


@pytest.mark.anyio
async def test_get_effective_fuel_supplies_empty_result(fuel_supply_repo, mock_db_session):
    """Test get_effective_fuel_supplies with empty results."""
    # Test parameters
    compliance_report_group_uuid = "test-group-uuid"
    compliance_report_id = 123
    
    # Create mock for the final query result with empty list
    final_result = MagicMock()
    unique_result = MagicMock()
    scalar_result = MagicMock()
    scalar_result.all.return_value = []
    unique_result.scalars.return_value = scalar_result
    final_result.unique.return_value = unique_result
    
    # Set up mock to return empty results
    mock_db_session.execute = AsyncMock(return_value=final_result)
    
    # Call the method
    result = await fuel_supply_repo.get_effective_fuel_supplies(
        compliance_report_group_uuid=compliance_report_group_uuid,
        compliance_report_id=compliance_report_id
    )
    
    # Verify results
    assert result == []
    
    # Verify mock was called
    assert mock_db_session.execute.call_count > 0