import pytest
from lcfs.db.models.Transfer import Transfer
from lcfs.web.api.transfer.repo import TransferRepository

# Assuming `dbsession` is the fixture name in conftest.py that provides an AsyncSession
# No need for async_db_session fixture here anymore, as dbsession from conftest.py will be used

@pytest.fixture
def transfer_repo(dbsession):
    # Utilize the dbsession fixture directly
    return TransferRepository(db=dbsession)

# Example data for testing
@pytest.fixture
def example_transfer_data():
    return Transfer(
        transfer_id=3,
        from_organization_id=1,
        to_organization_id=2,
        agreement_date="2023-01-01",
        quantity=100,
        price_per_unit=10.0,
        signing_authority_declaration=True
    )

# REPOSITORY LAYER TESTS

# Test retrieving all transfers
@pytest.mark.anyio
async def test_get_all_transfers(dbsession, transfer_repo, example_transfer_data):
    dbsession.add(example_transfer_data)
    await dbsession.commit()

    transfers = await transfer_repo.get_all_transfers()
    assert len(transfers) == 3
    assert transfers[0].transfer_id == 1
    assert transfers[2].transfer_id == 3

# Test retrieving a transfer by ID
@pytest.mark.anyio
async def test_get_transfer_by_id(dbsession, transfer_repo, example_transfer_data):
    dbsession.add(example_transfer_data)
    await dbsession.commit()

    transfer = await transfer_repo.get_transfer_by_id(example_transfer_data.transfer_id)
    assert transfer is not None
    assert transfer.transfer_id == example_transfer_data.transfer_id
