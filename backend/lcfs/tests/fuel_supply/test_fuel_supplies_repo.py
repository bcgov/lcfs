import pytest
from unittest.mock import MagicMock, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.compliance import FuelSupply
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import FuelSupplyCreateUpdateSchema


@pytest.fixture
def mock_db_session():
    session = AsyncMock(spec=AsyncSession)

    # Create a mock that properly mimics SQLAlchemy's async result chain
    async def mock_execute(*args, **kwargs):
        mock_result = (
            MagicMock()
        )  # Changed to MagicMock since the chained methods are sync
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
    mock_result = [MagicMock(spec=FuelSupply)]

    # Set up the mock to return our desired result
    mock_result_chain = MagicMock()
    mock_result_chain.scalars = MagicMock(return_value=mock_result_chain)
    mock_result_chain.unique = MagicMock(return_value=mock_result_chain)
    mock_result_chain.all = MagicMock(return_value=mock_result)

    async def mock_execute(*args, **kwargs):
        return mock_result_chain

    mock_db_session.execute = mock_execute

    result = await fuel_supply_repo.get_fuel_supply_list(compliance_report_id)

    assert result == mock_result


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
        provision_of_the_act_id=1,
        quantity=1000,
        units="L",
    )

    # Set up the mock chain using regular MagicMock since the chained methods are sync
    mock_result_chain = MagicMock()
    mock_result_chain.scalars = MagicMock(return_value=mock_result_chain)
    mock_result_chain.first = MagicMock(return_value=MagicMock(spec=FuelSupply))

    # Define an async execute function that returns our mock chain
    async def mock_execute(*args, **kwargs):
        return mock_result_chain

    # Replace the session's execute with our new mock
    mock_db_session.execute = mock_execute

    result = await fuel_supply_repo.check_duplicate(fuel_supply_data)

    assert result is not None
