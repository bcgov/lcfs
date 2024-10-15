import pytest
from unittest.mock import MagicMock, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.compliance import OtherUses
from lcfs.web.api.other_uses.repo import OtherUsesRepository
from lcfs.web.api.other_uses.schema import OtherUsesSchema
from lcfs.web.api.base import PaginationRequestSchema

@pytest.fixture
def mock_db_session():
    session = MagicMock(spec=AsyncSession)
    execute_result = AsyncMock()
    execute_result.unique = MagicMock(return_value=execute_result)
    execute_result.scalars = MagicMock(return_value=execute_result)
    execute_result.all = MagicMock(return_value=[MagicMock(spec=OtherUses)])
    execute_result.first = MagicMock(return_value=MagicMock(spec=OtherUses))
    session.execute.return_value = execute_result
    return session

@pytest.fixture
def other_uses_repo(mock_db_session):
    repo = OtherUsesRepository(db=mock_db_session)
    repo.fuel_code_repo = MagicMock()
    repo.fuel_code_repo.get_fuel_categories = AsyncMock(return_value=[])
    repo.fuel_code_repo.get_fuel_types = AsyncMock(return_value=[])
    repo.fuel_code_repo.get_expected_use_types = AsyncMock(return_value=[])
    return repo

@pytest.mark.anyio
async def test_get_table_options(other_uses_repo):
    result = await other_uses_repo.get_table_options()

    assert isinstance(result, dict)
    assert "fuel_categories" in result
    assert "fuel_types" in result
    assert "units_of_measure" in result
    assert "expected_uses" in result

@pytest.mark.anyio
async def test_get_other_uses(other_uses_repo, mock_db_session):
    compliance_report_id = 1
    mock_other_use = MagicMock(spec=OtherUses)
    mock_other_use.other_uses_id = 1
    mock_other_use.compliance_report_id = compliance_report_id
    mock_other_use.quantity_supplied = 1000
    mock_other_use.fuel_type.fuel_type = "Gasoline"
    mock_other_use.fuel_category.category = "Petroleum-based"
    mock_other_use.expected_use.name = "Transportation"
    mock_other_use.units = "L"
    mock_other_use.rationale = "Test rationale"
    mock_result = [mock_other_use]
    mock_db_session.execute.return_value.unique.return_value.scalars.return_value.all.return_value = mock_result

    result = await other_uses_repo.get_other_uses(compliance_report_id)

    assert isinstance(result, list)
    assert len(result) == 1
    assert isinstance(result[0], OtherUsesSchema)
    assert result[0].fuel_type == "Gasoline"
    assert result[0].fuel_category == "Petroleum-based"
    assert result[0].expected_use == "Transportation"

@pytest.mark.anyio
async def test_get_other_uses_paginated(other_uses_repo, mock_db_session):
    pagination = PaginationRequestSchema(page=1, size=10)
    compliance_report_id = 1

    # Create a mock OtherUsesSchema instance
    mock_other_use = MagicMock(spec=OtherUsesSchema)
    mock_other_use.other_uses_id = 1
    mock_other_use.compliance_report_id = compliance_report_id
    mock_other_use.quantity_supplied = 1000
    mock_other_use.fuel_type = "Gasoline"
    mock_other_use.fuel_category = "Petroleum-based"
    mock_other_use.expected_use = "Transportation"
    mock_other_use.units = "L"
    mock_other_use.rationale = "Test rationale"
    mock_result = [mock_other_use]

    # Mock the result of the count query
    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = 1

    # Mock the result of the main query
    mock_main_result = MagicMock()
    mock_main_result.unique.return_value.scalars.return_value.all.return_value = mock_result

    # Configure the execute method to return different results based on the call sequence
    mock_db_session.execute = AsyncMock(side_effect=[mock_count_result, mock_main_result])

    # Call the repository method
    result, total_count = await other_uses_repo.get_other_uses_paginated(pagination, compliance_report_id)

    # Assertions
    assert isinstance(result, list)
    assert len(result) == 1
    assert isinstance(result[0], OtherUsesSchema)
    assert result[0].fuel_type == "Gasoline"
    assert result[0].fuel_category == "Petroleum-based"
    assert result[0].expected_use == "Transportation"
    assert isinstance(total_count, int)
    assert total_count == 1

@pytest.mark.anyio
async def test_update_other_use(other_uses_repo, mock_db_session):
    updated_other_use = MagicMock(spec=OtherUses)
    updated_other_use.other_uses_id = 1
    updated_other_use.compliance_report_id = 1
    updated_other_use.quantity_supplied = 2000
    updated_other_use.fuel_type.fuel_type = "Diesel"
    updated_other_use.fuel_category.category = "Petroleum-based"
    updated_other_use.expected_use.name = "Transportation"
    updated_other_use.units = "L"
    updated_other_use.rationale = "Updated rationale"
    mock_db_session.flush = AsyncMock()
    mock_db_session.refresh = AsyncMock()
    mock_db_session.merge.return_value = updated_other_use

    result = await other_uses_repo.update_other_use(updated_other_use)

    assert isinstance(result, OtherUses)
    assert result.fuel_type.fuel_type == "Diesel"
    assert result.fuel_category.category == "Petroleum-based"
    assert result.expected_use.name == "Transportation"

@pytest.mark.anyio
async def test_get_other_use(other_uses_repo, mock_db_session):
    other_uses_id = 1

    # Create a mock OtherUses instance
    mock_result = MagicMock(spec=OtherUses)
    mock_result.other_uses_id = other_uses_id
    mock_result.compliance_report_id = 1
    mock_result.quantity_supplied = 1000
    mock_result.fuel_type.fuel_type = "Gasoline"
    mock_result.fuel_category.category = "Petroleum-based"
    mock_result.expected_use.name = "Transportation"
    mock_result.units = "L"
    mock_result.rationale = "Test rationale"

    # Configure the scalar method to return the mock_result
    mock_db_session.scalar = AsyncMock(return_value=mock_result)

    # Call the repository method
    result = await other_uses_repo.get_other_use(other_uses_id)

    # Assertions
    assert isinstance(result, OtherUses)
    assert result.other_uses_id == other_uses_id
    assert result.fuel_type.fuel_type == "Gasoline"
    assert result.fuel_category.category == "Petroleum-based"
    assert result.expected_use.name == "Transportation"