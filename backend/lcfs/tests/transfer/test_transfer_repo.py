import pytest
from lcfs.web.api.transfer.repo import TransferRepository
from lcfs.tests.transfer.transfer_payloads import transfer_orm_model, transfer_orm_model_2

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
