import pytest
from fastapi import HTTPException, status
from unittest.mock import AsyncMock, MagicMock, patch
from lcfs.web.exception.exceptions import DataNotFoundException

from lcfs.web.api.transfer.services import TransferServices
from lcfs.web.api.transfer.repo import TransferRepository
from lcfs.web.api.organizations.repo import OrganizationRepository
from lcfs.tests.transfer.transfer_payloads import transfer_create_payload, transfer_update_payload

@pytest.fixture
def transfer_repo(dbsession):
    return TransferRepository(db=dbsession)

@pytest.fixture
def org_repo(dbsession):
    return OrganizationRepository(db=dbsession)

@pytest.fixture
def transfer_service(transfer_repo, org_repo):
    return TransferServices(repo=transfer_repo, org_repo=org_repo)

# Test retrieving all transfers
@pytest.mark.anyio
async def test_get_all_transfers(transfer_service):
    transfers = await transfer_service.get_all_transfers()
    assert len(transfers) == 2
    assert transfers[0].transfer_id == 1

# Test retrieving a transfer by ID
@pytest.mark.anyio
async def test_get_transfer(transfer_service, transfer_repo):
    mock_transfer_id = 1
    transfer = await transfer_service.get_transfer(transfer_id=mock_transfer_id)
    assert transfer.transfer_id == mock_transfer_id

@pytest.mark.anyio
async def test_create_transfer(transfer_service, transfer_repo):
    created_transfer = await transfer_service.create_transfer(transfer_create_payload)
    assert created_transfer.comments.comment == transfer_create_payload.comments

# Test updating an existing transfer
@pytest.mark.anyio
async def test_update_transfer(transfer_service, transfer_repo):
    transfer = await transfer_service.update_transfer(transfer_data=transfer_update_payload)
    assert transfer.transfer_id == transfer_update_payload.transfer_id
    assert transfer.from_organization.organization_id == transfer_update_payload.from_organization_id
    assert transfer.to_organization.organization_id == transfer_update_payload.to_organization_id
    assert transfer.quantity == transfer_update_payload.quantity

# Test retrieving a non-existent transfer
@pytest.mark.anyio
async def test_get_transfer_non_existent(transfer_service, transfer_repo):
    transfer_repo.get_transfer_by_id = AsyncMock(return_value=None)
    with pytest.raises(DataNotFoundException) as exc_info:
        await transfer_service.get_transfer(transfer_id=99999)  # Assuming 99999 does not exist
        assert "Transfer with ID 99999 not found" in str(exc_info.value.detail)

# Test updating a non-existent transfer
@pytest.mark.anyio
async def test_update_transfer_non_existent(transfer_service, transfer_repo):
    with pytest.raises(DataNotFoundException) as exc_info:
        transfer_update_payload.transfer_id = 99999
        await transfer_service.update_transfer(
            transfer_data=transfer_update_payload
        )
        assert "Transfer with ID 99999 not found" in str(exc_info.value.detail)

# Test creating a transfer with non-existent organizations
@pytest.mark.anyio
async def test_create_transfer_invalid_organizations(transfer_service, transfer_repo):
    with pytest.raises(DataNotFoundException) as exc_info:
        transfer_data = transfer_create_payload
        transfer_data.to_organization_id = 99999
        await transfer_service.create_transfer(transfer_data)
        assert str(exc_info.value) == "One or more organizations not found"