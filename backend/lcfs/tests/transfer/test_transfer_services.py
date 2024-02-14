import pytest
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock

from lcfs.db.models.Transfer import Transfer
from lcfs.db.models.Comment import Comment
from lcfs.web.api.transfer.services import TransferServices
from lcfs.web.api.transfer.repo import TransferRepository
from lcfs.web.api.transfer.schema import TransferCreate

# Fixtures for the database session and dependencies
@pytest.fixture
def mock_db_session():
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock()
    return session

@pytest.fixture
def transfer_repo(mock_db_session):
    return TransferRepository(db=mock_db_session)

@pytest.fixture
def transfer_service(transfer_repo):
    request = MagicMock()
    return TransferServices(request=request, repo=transfer_repo)

# Example Transfer data
transfer_data = TransferCreate(
    from_organization_id=1,
    to_organization_id=2,
    agreement_date="2023-01-01",
    quantity=100,
    price_per_unit=10.0,
    signing_authority_declaration=True
)

# Test retrieving all transfers
@pytest.mark.anyio
async def test_get_all_transfers(transfer_service, transfer_repo):
    mock_transfer = Transfer(**transfer_data.dict(), transfer_id=1)
    transfer_repo.get_all_transfers = AsyncMock(return_value=[mock_transfer])
    transfers = await transfer_service.get_all_transfers()
    assert len(transfers) == 1
    assert transfers[0].transfer_id == 1
    transfer_repo.get_all_transfers.assert_awaited_once()

# Test retrieving a transfer by ID
@pytest.mark.anyio
async def test_get_transfer(transfer_service, transfer_repo):
    mock_transfer_id = 1
    mock_transfer = Transfer(**transfer_data.dict(), transfer_id=mock_transfer_id)
    transfer_repo.get_transfer_by_id = AsyncMock(return_value=mock_transfer)
    transfer = await transfer_service.get_transfer(transfer_id=mock_transfer_id)
    assert transfer.transfer_id == mock_transfer_id
    transfer_repo.get_transfer_by_id.assert_awaited_once_with(mock_transfer_id)

@pytest.mark.anyio
async def test_create_transfer(transfer_service, transfer_repo):
    # Mock TransferCreate data
    transfer_data = TransferCreate(
        from_organization_id=1,
        to_organization_id=2,
        agreement_date="2023-01-01",
        quantity=100,
        price_per_unit=10.0,
        signing_authority_declaration=True,
        comments="Initial Transfer"  # This is just a string here
    )

    # Create a mock Comment model instance
    mock_comment = MagicMock(spec=Comment)
    mock_comment.comment = transfer_data.comments  # Assign the string as the comment text

    # Create a mock Transfer model instance, associating the mock Comment
    mock_transfer = MagicMock(spec=Transfer)
    mock_transfer.from_organization_id = transfer_data.from_organization_id
    mock_transfer.to_organization_id = transfer_data.to_organization_id
    mock_transfer.agreement_date = transfer_data.agreement_date
    mock_transfer.quantity = transfer_data.quantity
    mock_transfer.price_per_unit = transfer_data.price_per_unit
    mock_transfer.signing_authority_declaration = transfer_data.signing_authority_declaration
    mock_transfer.comments = mock_comment  # Associate the mock Comment

    # Mock the repo method to return the mock Transfer when creating a transfer
    transfer_repo.create_transfer = AsyncMock(return_value=mock_transfer)

    # Call the service method to test
    created_transfer = await transfer_service.create_transfer(transfer_data)

    # Assertions to validate behavior
    assert created_transfer.comments.comment == transfer_data.comments
    # Add more assertions as needed to validate the created_transfer object

    # Verify that the repo's create_transfer method was called
    transfer_repo.create_transfer.assert_awaited()

# Test updating an existing transfer
@pytest.mark.anyio
async def test_update_transfer(transfer_service, transfer_repo):
    mock_transfer_id = 1
    updated_transfer_data = TransferCreate(
        from_organization_id=2,
        to_organization_id=3,
        agreement_date="2023-02-02",
        quantity=150,
        price_per_unit=20.0,
        signing_authority_declaration=True
    )
    mock_existing_transfer = Transfer(**transfer_data.dict(), transfer_id=mock_transfer_id)
    mock_updated_transfer = Transfer(**updated_transfer_data.dict(), transfer_id=mock_transfer_id)
    transfer_repo.get_transfer_by_id = AsyncMock(return_value=mock_existing_transfer)
    transfer_repo.update_transfer = AsyncMock(return_value=mock_updated_transfer)

    transfer = await transfer_service.update_transfer(transfer_id=mock_transfer_id, transfer_data=updated_transfer_data)

    assert transfer.transfer_id == mock_transfer_id
    assert transfer.from_organization_id == updated_transfer_data.from_organization_id
    assert transfer.to_organization_id == updated_transfer_data.to_organization_id
    transfer_repo.get_transfer_by_id.assert_awaited_once_with(mock_transfer_id)
    transfer_repo.update_transfer.assert_awaited_once()

# Test retrieving a non-existent transfer
@pytest.mark.anyio
async def test_get_transfer_non_existent(transfer_service, transfer_repo):
    transfer_repo.get_transfer_by_id = AsyncMock(return_value=None)
    with pytest.raises(HTTPException) as exc_info:
        await transfer_service.get_transfer(transfer_id=999)  # Assuming 999 does not exist
    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
    assert "Transfer with ID 999 not found" in str(exc_info.value.detail)

# Test updating a non-existent transfer
@pytest.mark.anyio
async def test_update_transfer_non_existent(transfer_service, transfer_repo):
    transfer_repo.get_transfer_by_id = AsyncMock(return_value=None)
    with pytest.raises(HTTPException) as exc_info:
        await transfer_service.update_transfer(
            transfer_id=999,  # Assuming 999 does not exist
            transfer_data=TransferCreate(
                from_organization_id=2,
                to_organization_id=3,
                agreement_date="2023-02-02",
                quantity=150,
                price_per_unit=20.0,
                signing_authority_declaration=True
            )
        )
    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
    assert "Transfer with ID 999 not found" in str(exc_info.value.detail)

# Test creating a transfer with non-existent organizations
@pytest.mark.anyio
async def test_create_transfer_invalid_organizations(transfer_service, transfer_repo):
    # Mock the organization repo to simulate non-existent organizations
    transfer_service.org_repo.get_organization_lite = AsyncMock(side_effect=[None, None])
    
    with pytest.raises(HTTPException) as exc_info:
        await transfer_service.create_transfer(transfer_data)
    
    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
    assert "One or more organizations not found" in str(exc_info.value.detail)
