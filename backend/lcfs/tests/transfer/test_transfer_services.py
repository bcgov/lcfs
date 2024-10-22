import pytest
from unittest.mock import AsyncMock
from lcfs.web.api.transfer.schema import TransferSchema
from datetime import date
from lcfs.db.models.transfer import Transfer
from lcfs.db.models.organization import Organization
from lcfs.db.models.transfer import TransferStatus
from lcfs.web.api.transfer.schema import TransferCreateSchema


@pytest.mark.anyio
async def test_get_all_transfers_success(transfer_service, mock_transfer_repo):

    mock_transfer_repo.get_all_transfers.return_value = [
        {
            "transfer_id": 1,
            "from_organization": {"organization_id": 1, "name": "org1"},
            "to_organization": {"organization_id": 2, "name": "org2"},
            "agreement_date": date.today(),
            "quantity": 1,
            "price_per_unit": 1,
            "current_status": {"transfer_status_id": 1, "status": "status"},
        }
    ]

    result = await transfer_service.get_all_transfers()

    assert isinstance(result[0], TransferSchema)
    mock_transfer_repo.get_all_transfers.assert_called_once()


@pytest.mark.anyio
async def test_get_transfer_success(transfer_service, mock_transfer_repo):
    transfer_id = 1
    mock_transfer_repo.get_transfer_by_id = AsyncMock(
        return_value=Transfer(
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
            price_per_unit=1,
            from_org_comment="comment",
            to_org_comment="comment",
            gov_comment="comment",
            current_status=TransferStatus(transfer_status_id=1, status="status"),
        )
    )

    result = await transfer_service.get_transfer(transfer_id)

    assert result.transfer_id == transfer_id
    assert isinstance(result, TransferSchema)
    mock_transfer_repo.get_transfer_by_id.assert_called_once()


@pytest.mark.anyio
async def test_create_transfer_success(transfer_service, mock_transfer_repo):
    mock_transfer_repo.get_transfer_status_by_name.return_value = TransferStatus(
        transfer_status_id=1, status="status"
    )
    mock_transfer_repo.add_transfer_history.return_value = True
    transfer_id = 1
    transfer = TransferCreateSchema(
        transfer_id=transfer_id,
        from_organization_id=1,
        to_organization_id=2,
    )
    mock_transfer_repo.create_transfer.return_value = transfer

    result = await transfer_service.create_transfer(transfer)

    assert result.transfer_id == transfer_id
    assert isinstance(result, TransferCreateSchema)


@pytest.mark.anyio
async def test_update_transfer_success(
    transfer_service, mock_transfer_repo, mock_request
):
    transfer_status = TransferStatus(transfer_status_id=1, status="status")
    transfer_id = 1
    transfer = Transfer(
        transfer_id=transfer_id,
        from_organization_id=1,
        to_organization_id=2,
        from_transaction_id=1,
        to_transaction_id=2,
        agreement_date=date.today(),
        transaction_effective_date=date.today(),
        price_per_unit=1,
        quantity=1,
        from_org_comment="comment",
        to_org_comment="comment",
        gov_comment="comment",
        transfer_category_id=1,
        current_status_id=1,
        recommendation="Recommended",
        current_status=transfer_status,
    )

    mock_transfer_repo.get_transfer_status_by_name.return_value = transfer_status
    mock_transfer_repo.get_transfer_by_id.return_value = transfer
    mock_transfer_repo.update_transfer.return_value = transfer

    result = await transfer_service.update_transfer(transfer)

    assert result.transfer_id == transfer_id
    assert isinstance(result, Transfer)


@pytest.mark.anyio
async def test_update_category_success(transfer_service, mock_transfer_repo):
    transfer_status = TransferStatus(transfer_status_id=1, status="status")
    transfer_id = 1
    transfer = Transfer(
        transfer_id=transfer_id,
        from_organization_id=1,
        to_organization_id=2,
        from_transaction_id=1,
        to_transaction_id=2,
        agreement_date=date.today(),
        transaction_effective_date=date.today(),
        price_per_unit=1,
        quantity=1,
        from_org_comment="comment",
        to_org_comment="comment",
        gov_comment="comment",
        transfer_category_id=1,
        current_status_id=1,
        recommendation="Recommended",
        current_status=transfer_status,
    )

    mock_transfer_repo.get_transfer_by_id.return_value = transfer

    result = await transfer_service.update_category(transfer_id, None)
    assert result.transfer_id == transfer_id
    assert isinstance(result, Transfer)
