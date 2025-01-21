import pytest

from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.transfer.TransferHistory import TransferHistory

from unittest.mock import MagicMock, AsyncMock
from lcfs.web.api.transfer.schema import TransferSchema
from datetime import date
from lcfs.db.models.organization import Organization
from lcfs.db.models.transfer import TransferStatus, TransferCategory


@pytest.mark.anyio
async def test_get_all_transfers_success(transfer_repo, mock_db):
    expected_data = []
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = expected_data

    mock_db.execute.return_value = mock_result

    result = await transfer_repo.get_all_transfers()

    mock_db.execute.assert_called_once()
    mock_result.scalars.return_value.all.assert_called_once()
    assert result == expected_data


@pytest.mark.anyio
async def test_get_transfer_by_id_success(transfer_repo, mock_db):
    transfer_id = 1
    expected_data = Transfer(transfer_id=transfer_id)
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = expected_data

    mock_db.execute.return_value = mock_result

    result = await transfer_repo.get_transfer_by_id(transfer_id)

    mock_db.execute.assert_called_once()
    mock_result.scalars.return_value.first.assert_called_once()

    assert result == expected_data
    assert isinstance(result, Transfer)
    assert result.transfer_id == transfer_id


@pytest.mark.anyio
async def test_create_transfer_success(transfer_repo):
    transfer_id = 1
    expected_data = Transfer(
        transfer_id=transfer_id,
        from_organization=Organization(
            organization_id=1,
            name="org1",
        ),
        to_organization=Organization(
            organization_id=2,
            name="org2",
        ),
        agreement_date=date.today(),
        quantity=1,
        price_per_unit=1.99,
        current_status=TransferStatus(transfer_status_id=1, status="status"),
    )

    result = await transfer_repo.create_transfer(expected_data)

    assert result == TransferSchema.from_orm(expected_data)
    assert isinstance(result, TransferSchema)
    assert result.transfer_id == transfer_id


@pytest.mark.anyio
async def test_get_transfer_status_by_name_success(transfer_repo, mock_db):
    status = "Draft"
    mock_db.scalar.return_value = TransferStatus(status=status)
    result = await transfer_repo.get_transfer_status_by_name(status)

    assert isinstance(result, TransferStatus)
    assert result.status == status


@pytest.mark.anyio
async def test_get_transfer_category_by_name_success(transfer_repo, mock_db):
    category = "A"
    mock_db.scalar.return_value = TransferCategory(category=category)
    result = await transfer_repo.get_transfer_category_by_name(category)

    assert isinstance(result, TransferCategory)
    assert result.category == category


@pytest.mark.anyio
async def test_update_transfer_success(transfer_repo):
    transfer_id = 1
    expected_data = Transfer(
        transfer_id=transfer_id,
        from_organization=Organization(
            organization_id=1,
            name="org1",
        ),
        to_organization=Organization(
            organization_id=2,
            name="org2",
        ),
        agreement_date=date.today(),
        quantity=1,
        price_per_unit=2.75,
        current_status=TransferStatus(transfer_status_id=1, status="status"),
    )

    result = await transfer_repo.update_transfer(expected_data)

    assert result == TransferSchema.model_validate(expected_data)
    assert result.transfer_id == transfer_id


@pytest.mark.anyio
async def test_add_transfer_history_success(transfer_repo):

    result = await transfer_repo.add_transfer_history(
        CreateTransferHistorySchema(
            transfer_id=1,
            transfer_status_id=1,
            user_profile_id=1,
            display_name="History User",
        )
    )

    assert isinstance(result, TransferHistory)
    assert result.transfer_id == transfer_id
    assert result.transfer_status_id == transfer_status_id
    assert result.user_profile_id == user_profile_id


@pytest.mark.anyio
async def test_update_transfer_history_success(transfer_repo, mock_db):
    transfer_id = 1
    transfer_status_id = 1
    user_profile_id = 1
    expected_data = TransferHistory(
        transfer_id=transfer_id,
        transfer_status_id=transfer_status_id,
        user_profile_id=user_profile_id,
    )

    mock_db.scalar.return_value = expected_data

    result = await transfer_repo.update_transfer_history(
        transfer_id, transfer_status_id, user_profile_id
    )

    assert isinstance(result, TransferHistory)
    assert result.transfer_id == transfer_id
    assert result.transfer_status_id == transfer_status_id
    assert result.user_profile_id == user_profile_id


@pytest.mark.anyio
async def test_refresh_transfer_success(transfer_repo, mock_db):
    expected_data = Transfer(transfer_id=1)

    result = await transfer_repo.refresh_transfer(expected_data)

    assert result == expected_data
