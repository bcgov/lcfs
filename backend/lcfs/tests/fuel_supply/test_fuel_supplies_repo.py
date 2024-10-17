import pytest
from unittest.mock import MagicMock, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.compliance import FuelSupply
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import FuelSupplyCreateUpdateSchema


@pytest.fixture
def mock_db_session():
    # Create a mock for the AsyncSession
    session = MagicMock(spec=AsyncSession)

    # Mock the execute method to return a mock with the expected chain of methods
    execute_result = AsyncMock()
    execute_result.unique = MagicMock(return_value=execute_result)  # Allow chaining
    execute_result.scalars = MagicMock(return_value=execute_result)
    execute_result.all = MagicMock(return_value=[MagicMock(spec=FuelSupply)])
    execute_result.first = MagicMock(return_value=MagicMock(spec=FuelSupply))

    session.execute.return_value = execute_result

    return session


@pytest.fixture
def fuel_supply_repo(mock_db_session):
    return FuelSupplyRepository(db=mock_db_session)


@pytest.mark.anyio
async def test_get_fuel_supply_list(fuel_supply_repo, mock_db_session):
    compliance_report_id = 1
    mock_result = [MagicMock(spec=FuelSupply)]
    mock_db_session.execute.return_value.unique.return_value.scalars.return_value.all.return_value = (
        mock_result
    )

    result = await fuel_supply_repo.get_fuel_supply_list(compliance_report_id)

    assert result == mock_result
    mock_db_session.execute.assert_called_once()


@pytest.mark.anyio
async def test_create_fuel_supply(fuel_supply_repo, mock_db_session):
    new_fuel_supply = MagicMock(spec=FuelSupply)
    mock_db_session.flush = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    result = await fuel_supply_repo.create_fuel_supply(new_fuel_supply)

    assert result == new_fuel_supply
    mock_db_session.add.assert_called_once_with(new_fuel_supply)
    mock_db_session.flush.assert_awaited_once()
    mock_db_session.refresh.assert_awaited_once_with(
        new_fuel_supply,
        [
            "fuel_category",
            "fuel_type",
            "fuel_code",
            "provision_of_the_act",
            "custom_fuel_type",
            "end_use_type",
        ],
    )


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
    result = await fuel_supply_repo.check_duplicate(fuel_supply_data)

    assert result is not None
    mock_db_session.execute.assert_called_once()
