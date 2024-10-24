import pytest
from lcfs.web.api.transfer.repo import TransferRepository
from lcfs.tests.payloads import test_transfer
from lcfs.db.models.transfer.Transfer import Transfer
from datetime import datetime
from lcfs.db.models.user.UserProfile import UserProfile


@pytest.fixture
def transfer_repo(dbsession):
    return TransferRepository(db=dbsession)


@pytest.mark.skip(reason="Feature not currently working")
async def test_create_transfer_sets_auditable_fields(dbsession, transfer_repo):
    new_transfer = Transfer(**test_transfer)
    await transfer_repo.create_transfer(new_transfer)

    added_transfer = await transfer_repo.get_transfer_by_id(new_transfer.transfer_id)
    assert added_transfer is not None
    assert added_transfer.create_user == dbsession.info["user"].keycloak_username
    assert added_transfer.update_user == dbsession.info["user"].keycloak_username
    assert isinstance(added_transfer.create_date, datetime)
    assert isinstance(added_transfer.update_date, datetime)


@pytest.mark.skip(reason="Feature not currently working")
async def test_update_transfer_updates_update_user(dbsession, transfer_repo):
    # Create a transfer with one user
    new_transfer = Transfer(**test_transfer)
    await transfer_repo.create_transfer(new_transfer)

    # Change the user in the session info to simulate a different updating user
    dbsession.info["user"] = UserProfile(
        user_profile_id=2, keycloak_username="test_user_2"
    )  # Different user ID

    # Update the transfer
    transfer_to_update = await transfer_repo.get_transfer_by_id(
        new_transfer.transfer_id
    )
    transfer_to_update.current_status_id = 2
    await transfer_repo.update_transfer(transfer_to_update)

    # Fetch the updated transfer
    updated_transfer = await transfer_repo.get_transfer_by_id(new_transfer.transfer_id)

    # Assert the update_user is set to the new user
    assert updated_transfer.update_user == "test_user_2"
    assert updated_transfer.create_user != updated_transfer.update_user
