import pytest
from unittest.mock import AsyncMock
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.db.models.fuel.TransportMode import TransportMode


@pytest.fixture
def mock_db():
    """Fixture for mocking the database session."""
    return AsyncMock()


@pytest.fixture
def fuel_code_repo(mock_db):
    """Fixture for creating a repository with a mocked database."""
    repo = FuelCodeRepository()
    repo.db = mock_db
    return repo


@pytest.mark.anyio
async def test_get_transport_mode_by_name(fuel_code_repo, mock_db):
    # Define the test transport mode
    transport_mode_name = "Truck"
    mock_transport_mode = TransportMode(transport_mode_id=1, transport_mode="Truck")
    
    # Mock the database query result
    mock_db.execute.return_value.scalar_one_or_none = AsyncMock()
    mock_db.execute.return_value.scalar_one_or_none.return_value = mock_transport_mode

    # Call the repository method
    result = await fuel_code_repo.get_transport_mode_by_name(transport_mode_name)

    # Assert the result matches the mock data
    assert result == mock_transport_mode

    # Ensure the database query was called
    mock_db.execute.assert_called_once()