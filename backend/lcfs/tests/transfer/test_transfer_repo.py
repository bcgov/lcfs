import pytest
from lcfs.web.api.transfer.repo import TransferRepository
from lcfs.tests.transfer.transfer_payloads import transfer_orm_model, transfer_orm_model_2, transfer_orm_fields
from lcfs.db.models.Transfer import Transfer
from datetime import datetime


@pytest.fixture
def transfer_repo(dbsession):
    return TransferRepository(db=dbsession)

# REPOSITORY LAYER TESTS

# Test retrieving all transfers


@pytest.mark.anyio
async def test_get_all_transfers(dbsession, transfer_repo):
    dbsession.add(transfer_orm_model)
    await dbsession.commit()
    transfers = await transfer_repo.get_all_transfers()
    assert len(transfers) == 3

# Test retrieving a transfer by ID


@pytest.mark.anyio
async def test_get_transfer_by_id(dbsession, transfer_repo):
    dbsession.add(transfer_orm_model_2)
    await dbsession.commit()
    new_transfer = await transfer_repo.get_transfer_by_id(transfer_orm_model_2.transfer_id)
    assert new_transfer is not None
    assert new_transfer.transfer_id == transfer_orm_model_2.transfer_id


@pytest.mark.anyio
async def test_create_transfer(dbsession, transfer_repo):
    new_transfer = Transfer(**transfer_orm_fields)
    dbsession.add(new_transfer)
    await dbsession.commit()
    added_transfer = await transfer_repo.get_transfer_by_id(new_transfer.transfer_id)
    assert added_transfer is not None
    assert added_transfer.transfer_id == new_transfer.transfer_id


@pytest.mark.anyio
async def test_update_transfer(dbsession, transfer_repo):
    # Create and add a new transfer
    new_transfer = Transfer(**transfer_orm_fields)
    dbsession.add(new_transfer)
    await dbsession.commit()

    # Retrieve the added transfer
    added_transfer = await transfer_repo.get_transfer_by_id(new_transfer.transfer_id)

    # Check initial state (optional but recommended)
    assert added_transfer is not None
    # Assuming '2' is not the initial status
    assert added_transfer.current_status_id != 2

    # Update the transfer
    added_transfer.current_status_id = 2
    await dbsession.commit()

    # Refresh object from database (if your ORM supports this)
    await dbsession.refresh(added_transfer)

    # Assert the updated state
    assert added_transfer.current_status_id == 2
