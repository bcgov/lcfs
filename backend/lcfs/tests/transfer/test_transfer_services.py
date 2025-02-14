import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date
from lcfs.web.api.transfer.schema import (
    TransferSchema,
    TransferCreateSchema,
    TransferRecommendationEnumSchema,
)
from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.transfer.TransferStatus import TransferStatus
from lcfs.db.models.organization.Organization import Organization


@pytest.mark.anyio
async def test_get_all_transfers_success(transfer_service, mock_transfer_repo):
    """
    Use a MagicMock(Transfer) with valid string fields for .name,
    a valid status, optional category, etc.
    """
    mock_transfer = MagicMock(spec=Transfer)
    mock_transfer.transfer_id = 1

    # from_organization
    mock_transfer.from_organization = MagicMock()
    mock_transfer.from_organization.organization_id = 1
    mock_transfer.from_organization.name = "org1"

    # to_organization
    mock_transfer.to_organization = MagicMock()
    mock_transfer.to_organization.organization_id = 2
    mock_transfer.to_organization.name = "org2"

    # current_status must be valid, e.g., "Draft", "Sent", "Submitted", "Recommended", "Recorded", etc.
    mock_transfer.current_status = MagicMock(spec=TransferStatus)
    mock_transfer.current_status.transfer_status_id = 1
    mock_transfer.current_status.status = "Draft"

    # Optional category
    mock_category = MagicMock()
    mock_category.transfer_category_id = 123
    mock_category.category = "A"
    mock_transfer.transfer_category = mock_category

    # Optional recommendation: "Record", "Refuse", or None
    mock_transfer.recommendation = None

    mock_transfer.agreement_date = date.today()
    mock_transfer.quantity = 1
    mock_transfer.price_per_unit = 1.0
    mock_transfer.transfer_comments = []  # no comments

    mock_transfer_repo.get_all_transfers.return_value = [mock_transfer]

    result = await transfer_service.get_all_transfers()
    assert len(result) == 1
    assert isinstance(result[0], TransferSchema)
    assert result[0].transfer_id == 1
    assert result[0].from_organization.name == "org1"


@pytest.mark.anyio
async def test_get_transfer_success(transfer_service, mock_transfer_repo):
    transfer_id = 1

    from_org = Organization(organization_id=1, name="org1")
    to_org = Organization(organization_id=2, name="org2")
    current_status = TransferStatus(transfer_status_id=1, status="Draft")

    transfer_obj = Transfer(
        transfer_id=transfer_id,
        from_organization=from_org,
        to_organization=to_org,
        agreement_date=date.today(),
        quantity=1,
        price_per_unit=5.75,
        current_status=current_status,
    )
    # relationship list
    transfer_obj.transfer_comments = []

    mock_transfer_repo.get_transfer_by_id.return_value = transfer_obj

    result = await transfer_service.get_transfer(transfer_id)
    assert result.transfer_id == transfer_id
    assert isinstance(result, TransferSchema)
    mock_transfer_repo.get_transfer_by_id.assert_called_once_with(transfer_id)


@pytest.mark.anyio
async def test_create_transfer_success(transfer_service, mock_transfer_repo):
    """
    Ensure we supply a valid status from TransferStatusEnum. E.g. 'Sent', 'Draft', etc.
    """
    mock_transfer_repo.get_transfer_status_by_name.return_value = TransferStatus(
        transfer_status_id=1, status="Sent"
    )
    mock_transfer_repo.add_transfer_history.return_value = True

    transfer_id = 1
    transfer_data = TransferCreateSchema(
        transfer_id=transfer_id,
        from_organization_id=1,
        to_organization_id=2,
        price_per_unit=5.75,
        quantity=10,
        current_status="Sent",  # valid TransferStatusEnum string
    )

    # The repo returns a TransferSchema on create
    mock_transfer_repo.create_transfer.return_value = transfer_data

    with patch.object(transfer_service, "_perform_notification_call", AsyncMock()):
        result = await transfer_service.create_transfer(transfer_data)

        assert result.transfer_id == transfer_id
        assert isinstance(result, TransferCreateSchema)
        transfer_service._perform_notification_call.assert_called_once()


@pytest.mark.anyio
async def test_update_transfer_success(
    transfer_service, mock_transfer_repo, mock_request
):
    """
    DB object is in 'Draft'. We'll move to 'Submitted'.
    We'll also change recommendation from 'Record' to 'Refuse' (both valid).
    """
    # DB current status is "Draft"
    old_status = TransferStatus(transfer_status_id=1, status="Draft")
    transfer_id = 1

    from_org = Organization(organization_id=1, name="org1")
    to_org = Organization(organization_id=2, name="org2")

    transfer_obj = Transfer(
        transfer_id=transfer_id,
        from_organization=from_org,
        to_organization=to_org,
        agreement_date=date.today(),
        quantity=1,
        price_per_unit=7.99,
        current_status=old_status,
        recommendation=TransferRecommendationEnum.Record,
    )
    transfer_obj.transfer_comments = []

    # We'll switch to "Submitted"
    new_status = TransferStatus(transfer_status_id=2, status="Submitted")

    mock_transfer_repo.get_transfer_status_by_name.return_value = new_status
    mock_transfer_repo.get_transfer_by_id.return_value = transfer_obj
    mock_transfer_repo.update_transfer.return_value = transfer_obj

    transfer_service._perform_notification_call = AsyncMock()

    # TransferCreateSchema requires a valid current_status + recommendation
    update_data = TransferCreateSchema(
        transfer_id=transfer_id,
        current_status="Submitted",  # valid
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=date.today(),
        quantity=1,
        price_per_unit=7.99,
        recommendation="Refuse",  # valid
    )

    result = await transfer_service.update_transfer(update_data)
    assert result.transfer_id == transfer_id
    assert isinstance(result, Transfer)

    mock_transfer_repo.get_transfer_by_id.assert_called_once_with(transfer_id)
    mock_transfer_repo.update_transfer.assert_called_once_with(transfer_obj)
    transfer_service._perform_notification_call.assert_awaited_once_with(
        transfer_obj, status="Submitted"
    )


@pytest.mark.anyio
async def test_update_category_success(transfer_service, mock_transfer_repo):
    old_status = TransferStatus(transfer_status_id=1, status="Draft")
    transfer_id = 1

    transfer_obj = Transfer(
        transfer_id=transfer_id,
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=date.today(),
        quantity=1,
        price_per_unit=1.0,
        current_status=old_status,
        recommendation=None,
    )
    transfer_obj.transfer_comments = []

    mock_transfer_repo.get_transfer_by_id.return_value = transfer_obj

    result = await transfer_service.update_category(transfer_id, None)
    assert result.transfer_id == transfer_id
    assert isinstance(result, Transfer)
    mock_transfer_repo.get_transfer_by_id.assert_called_once_with(transfer_id)
