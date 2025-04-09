import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import MagicMock, AsyncMock

from lcfs.db.models.compliance import NotionalTransfer
from lcfs.tests.notional_transfer.conftest import create_mock_entity
from lcfs.web.api.notional_transfer.repo import NotionalTransferRepository
from lcfs.web.api.notional_transfer.schema import NotionalTransferSchema


@pytest.fixture
def mock_db_session():
    session = MagicMock(spec=AsyncSession)
    execute_result = AsyncMock()
    execute_result.unique = MagicMock(return_value=execute_result)
    execute_result.scalars = MagicMock(return_value=execute_result)
    execute_result.all = MagicMock(return_value=[MagicMock(spec=NotionalTransfer)])
    execute_result.first = MagicMock(return_value=MagicMock(spec=NotionalTransfer))
    session.execute.return_value = execute_result
    return session


@pytest.fixture
def notional_transfer_repo(mock_db_session):
    repo = NotionalTransferRepository(db=mock_db_session)
    repo.fuel_code_repo = MagicMock()
    repo.fuel_code_repo.get_fuel_categories = AsyncMock(return_value=[])
    return repo


@pytest.mark.anyio
async def test_get_table_options(notional_transfer_repo):
    result = await notional_transfer_repo.get_table_options()

    assert isinstance(result, dict)
    assert "fuel_categories" in result
    assert "received_or_transferred" in result


@pytest.mark.anyio
async def test_get_notional_transfers(notional_transfer_repo, mock_db_session):
    compliance_report_id = 1
    mock_notional_transfer = create_mock_entity({})
    mock_result_notional_transfers = [mock_notional_transfer]
    mock_compliance_report_uuid = "test_group_uuid"

    # Mock the first db.execute call for fetching compliance report group UUID
    mock_first_execute = MagicMock()
    mock_first_execute.scalar.return_value = mock_compliance_report_uuid

    # Mock the second db.execute call for fetching notional transfers
    mock_second_execute = MagicMock()
    mock_second_execute.unique.return_value.scalars.return_value.all.return_value = (
        mock_result_notional_transfers
    )

    # Assign side effects to return these mocked execute calls in sequence
    mock_db_session.execute = AsyncMock(
        side_effect=[mock_first_execute, mock_second_execute]
    )

    result = await notional_transfer_repo.get_notional_transfers(compliance_report_id)

    assert isinstance(result, list)
    assert len(result) == 1
    assert isinstance(result[0], NotionalTransferSchema)
    assert result[0].fuel_category == "Gasoline"
    assert result[0].legal_name == "Test Legal Name"


@pytest.mark.anyio
async def test_get_latest_notional_transfer_by_group_uuid(
    notional_transfer_repo, mock_db_session
):
    group_uuid = "test-group-uuid"
    mock_notional_transfer_gov = MagicMock(spec=NotionalTransfer)
    mock_notional_transfer_gov.version = 2

    mock_notional_transfer_supplier = MagicMock(spec=NotionalTransfer)
    mock_notional_transfer_supplier.version = 3

    # Mock response with both government and supplier versions
    mock_db_session.execute.return_value.scalars.return_value.first.side_effect = [
        mock_notional_transfer_gov,
        mock_notional_transfer_supplier,
    ]

    result = await notional_transfer_repo.get_latest_notional_transfer_by_group_uuid(
        group_uuid
    )

    assert result.version == 2


@pytest.mark.anyio
async def test_update_notional_transfer(notional_transfer_repo, mock_db_session):
    updated_notional_transfer = create_mock_entity({})
    updated_notional_transfer.quantity = 2000
    updated_notional_transfer.legal_name = "Updated Legal Name"
    updated_notional_transfer.address_for_service = "Updated Address"

    mock_db_session.flush = AsyncMock()
    mock_db_session.refresh = AsyncMock()
    mock_db_session.merge.return_value = updated_notional_transfer

    result = await notional_transfer_repo.update_notional_transfer(
        updated_notional_transfer
    )

    # Assertions
    assert isinstance(result, NotionalTransfer)
    assert mock_db_session.flush.call_count == 1
