import pytest
from unittest.mock import AsyncMock
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatus, FuelCodeStatusEnum
from lcfs.web.api.base import PaginationRequestSchema
from sqlalchemy.ext.asyncio import AsyncSession


# Custom mock classes to simulate SQLAlchemy result objects
class MockScalarsResult:
    def __init__(self, data):
        self.data = data

    def all(self):
        return self.data


class MockUniqueResult:
    def __init__(self, data):
        self.data = data

    def scalars(self):
        return MockScalarsResult(self.data)


class MockExecuteResult:
    def __init__(self, data):
        self.data = data

    def unique(self):
        return MockUniqueResult(self.data)

    def scalar(self):
        return self.data  # Make scalar() a synchronous method


@pytest.fixture
def mock_db():
    """Fixture for mocking the database session."""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def fuel_code_repo(mock_db):
    """Fixture for creating a repository with a mocked database."""
    repo = FuelCodeRepository()
    repo.db = mock_db
    return repo


@pytest.mark.anyio
async def test_get_fuel_codes_paginated(fuel_code_repo, mock_db):
    # Prepare mock data
    fuel_code_1 = FuelCode(fuel_code_id=1, fuel_suffix="101.0", company="Company A")
    fuel_code_2 = FuelCode(fuel_code_id=2, fuel_suffix="102.0", company="Company B")
    fuel_codes = [fuel_code_1, fuel_code_2]
    total_count = 2

    # Mock the get_fuel_status_by_status method
    delete_status = FuelCodeStatus(
        fuel_code_status_id=99, status=FuelCodeStatusEnum.Deleted
    )
    fuel_code_repo.get_fuel_status_by_status = AsyncMock(return_value=delete_status)

    # Use a counter to determine which call is the count query and which is the data query
    call_count = 0

    async def mock_execute(query):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # First call is the count query
            return MockExecuteResult(total_count)
        elif call_count == 2:
            # Second call is the data query
            return MockExecuteResult(fuel_codes)
        else:
            # Additional calls if any
            return MockExecuteResult(None)

    mock_db.execute.side_effect = mock_execute

    # Prepare pagination and conditions
    pagination = PaginationRequestSchema(page=1, size=10, sort_orders=[], filters=[])
    conditions = [FuelCode.company == "Company A"]  # Example condition

    # Call the repository method
    result_fuel_codes, result_total_count = (
        await fuel_code_repo.get_fuel_codes_paginated(pagination, conditions)
    )

    # Assert that the result matches the expected output
    assert result_fuel_codes == fuel_codes
    assert result_total_count == total_count

    # Ensure the database query was called the expected number of times
    assert mock_db.execute.call_count == 2  # Once for count, once for data

    # Check that get_fuel_status_by_status was called
    fuel_code_repo.get_fuel_status_by_status.assert_called_once_with("Deleted")


@pytest.mark.anyio
async def test_get_fuel_codes_paginated_no_results(fuel_code_repo, mock_db):
    # Mock data with no fuel codes
    fuel_codes = []
    total_count = 0

    # Mock the get_fuel_status_by_status method
    delete_status = FuelCodeStatus(
        fuel_code_status_id=99, status=FuelCodeStatusEnum.Deleted
    )
    fuel_code_repo.get_fuel_status_by_status = AsyncMock(return_value=delete_status)

    # Use a counter to determine which call is the count query and which is the data query
    call_count = 0

    async def mock_execute(query):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # First call is the count query
            return MockExecuteResult(total_count)
        elif call_count == 2:
            # Second call is the data query
            return MockExecuteResult(fuel_codes)
        else:
            # Additional calls if any
            return MockExecuteResult(None)

    mock_db.execute.side_effect = mock_execute

    # Prepare pagination and conditions
    pagination = PaginationRequestSchema(page=1, size=10, sort_orders=[], filters=[])
    conditions = [FuelCode.company == "Non-Existent Company"]

    # Call the repository method
    result_fuel_codes, result_total_count = (
        await fuel_code_repo.get_fuel_codes_paginated(pagination, conditions)
    )

    # Assert that the result is an empty list and total count is zero
    assert result_fuel_codes == fuel_codes  # Should be an empty list
    assert result_total_count == total_count  # Should be zero

    # Ensure the database query was called the expected number of times
    assert mock_db.execute.call_count == 2  # Once for count, once for data

    # Check that get_fuel_status_by_status was called
    fuel_code_repo.get_fuel_status_by_status.assert_called_once_with("Deleted")
