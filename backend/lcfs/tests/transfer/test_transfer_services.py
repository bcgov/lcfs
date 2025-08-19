import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date, datetime, timedelta
from types import SimpleNamespace

from lcfs.db.models import UserProfile
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.transfer.schema import (
    TransferSchema,
    TransferCreateSchema,
)
from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.transfer.TransferStatus import TransferStatus
from lcfs.db.models.organization.Organization import Organization


@pytest.fixture
def dummy_transfer():
    from types import SimpleNamespace

    transfer = SimpleNamespace(
        transfer_id="t1",
        from_transaction=object(),  # non-None so that check passes
        from_transaction_id="ft1",
        transfer_category=SimpleNamespace(),  # No 'category' attribute by default.
        agreement_date=datetime.now(),
        quantity=100,
        to_organization_id="org2",
        to_transaction=None,
        category="Existing",
    )
    return transfer


@pytest.fixture
def mock_director():
    mock_user = MagicMock(spec=UserProfile)
    mock_user.role_names = [RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR]
    mock_user.first_name = "First Name"
    mock_user.last_name = "Last Name"
    return mock_user


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

    result = await transfer_service.get_transfer(UserProfile(), transfer_id)
    assert result.transfer_id == transfer_id
    assert isinstance(result, TransferSchema)
    mock_transfer_repo.get_transfer_by_id.assert_called_once_with(transfer_id)


@pytest.mark.anyio
async def test_create_transfer_success(
    transfer_service, mock_transfer_repo, mock_director
):
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
        result = await transfer_service.create_transfer(transfer_data, mock_director)

        assert result.transfer_id == transfer_id
        assert isinstance(result, TransferCreateSchema)
        transfer_service._perform_notification_call.assert_called_once()


@pytest.mark.anyio
async def test_update_transfer_success(
    transfer_service, mock_transfer_repo, mock_director
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

    result = await transfer_service.update_transfer(update_data, mock_director)
    assert result.transfer_id == transfer_id
    assert isinstance(result, Transfer)

    mock_transfer_repo.get_transfer_by_id.assert_called_once_with(transfer_id)
    mock_transfer_repo.update_transfer.assert_called_once_with(transfer_obj)
    transfer_service._perform_notification_call.assert_awaited_once_with(
        transfer_obj, status="Submitted", user=mock_director
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


@pytest.mark.anyio
@pytest.mark.parametrize(
    "days_diff, expected_category",
    [
        (1, "A"),  # Less than six months → Category "A"
        (200, "B"),  # Between six months and one year → Category "B"
        (400, "C"),  # More than one year → Category "C"
    ],
)
async def test_update_category_flow(
    transfer_service, dummy_transfer, days_diff, expected_category, mock_director
):
    dummy_transfer.agreement_date = datetime.now() - timedelta(days=days_diff)
    transfer_service.dummy_transfer = dummy_transfer

    async def dummy_update_category_fn(transfer_id, category):
        dummy_transfer.called_category = category
        return dummy_transfer

    transfer_service.update_category = dummy_update_category_fn

    async def confirm_success(tx_id):
        return True

    transfer_service.transaction_repo.confirm_transaction = confirm_success

    async def dummy_adjust_balance_fn(
        *, transaction_action, compliance_units, organization_id
    ):
        return SimpleNamespace(transaction_id=123)

    transfer_service.org_service.adjust_balance = dummy_adjust_balance_fn

    await transfer_service.director_record_transfer(dummy_transfer, mock_director)

    assert getattr(dummy_transfer, "called_category", None) == expected_category
    assert dummy_transfer.to_transaction.transaction_id == 123


@pytest.mark.anyio
async def test_no_category_update_when_category_exists(
    transfer_service, dummy_transfer, mock_director
):
    # Pre-set a category on the transfer_category attribute.
    dummy_transfer.transfer_category.category = "Existing"

    async def confirm_success(tx_id):
        return True

    transfer_service.transaction_repo.confirm_transaction = confirm_success

    async def dummy_adjust_balance_fn(
        *, transaction_action, compliance_units, organization_id
    ):
        return SimpleNamespace(transaction_id=123)

    transfer_service.org_service.adjust_balance = dummy_adjust_balance_fn

    async def should_not_be_called(*args, **kwargs):
        raise Exception("update_category should not be called")

    transfer_service.update_category = should_not_be_called

    await transfer_service.director_record_transfer(dummy_transfer, mock_director)

    assert dummy_transfer.to_transaction.transaction_id == 123
    assert dummy_transfer.category == "Existing"


@pytest.mark.anyio
async def test_director_record_transfer_with_none_category(
    transfer_service, dummy_transfer, mock_director
):
    """
    Test that director_record_transfer correctly assigns a category
    when transfer_category is None. This tests the bug fix for the
    case where hasattr(None, 'category') would raise an AttributeError.
    """
    # Set transfer_category to None to simulate the bug scenario
    dummy_transfer.transfer_category = None
    dummy_transfer.agreement_date = datetime.now() - timedelta(
        days=10
    )  # Recent agreement date for category A

    # Track if update_category was called
    category_updated = False

    async def dummy_update_category_fn(transfer_id, category):
        nonlocal category_updated
        category_updated = True
        dummy_transfer.called_category = category
        dummy_transfer.transfer_category = SimpleNamespace(category=category)
        return dummy_transfer

    transfer_service.update_category = dummy_update_category_fn

    async def confirm_success(tx_id):
        return True

    transfer_service.transaction_repo.confirm_transaction = confirm_success

    async def dummy_adjust_balance_fn(
        *, transaction_action, compliance_units, organization_id
    ):
        return SimpleNamespace(transaction_id=123)

    transfer_service.org_service.adjust_balance = dummy_adjust_balance_fn

    # Mock repo.refresh_transfer to do nothing
    async def mock_refresh(transfer):
        return

    transfer_service.repo.refresh_transfer = mock_refresh
    transfer_service.repo.update_transfer = AsyncMock(return_value=dummy_transfer)

    await transfer_service.director_record_transfer(dummy_transfer, mock_director)

    # Verify that update_category was called and with the correct category
    assert category_updated is True
    assert getattr(dummy_transfer, "called_category", None) == "A"
    assert dummy_transfer.to_transaction.transaction_id == 123


@pytest.mark.anyio
async def test_director_record_transfer_persists_to_transaction_id(
    transfer_service, mock_director
):
    """
    This test simulates the bug where `to_transaction_id` is not persisted.
    It mocks `refresh_transfer` to simulate reloading the state from the
    database, which would be missing the un-persisted `to_transaction_id`.
    This test should fail on the current codebase.
    """
    # Create a transfer object that looks like it's ready to be recorded.
    from_transaction = SimpleNamespace(transaction_id=101)
    transfer = SimpleNamespace(
        transfer_id=1,
        from_transaction=from_transaction,
        from_transaction_id=from_transaction.transaction_id,
        transfer_category=SimpleNamespace(category="A"),
        agreement_date=datetime.now(),
        quantity=100,
        to_organization_id=2,
        to_transaction=None,
        to_transaction_id=None,  # It starts as None
        from_organization=SimpleNamespace(organization_id=1, name="From Org"),
        to_organization=SimpleNamespace(organization_id=2, name="To Org"),
    )

    # Mock the creation of the receiving transaction
    to_transaction = SimpleNamespace(transaction_id=102)
    transfer_service.org_service.adjust_balance = AsyncMock(
        return_value=to_transaction
    )

    # Mock other repo calls that are part of the flow
    transfer_service.transaction_repo.confirm_transaction = AsyncMock(return_value=True)
    transfer_service.repo.update_transfer = AsyncMock()

    # Mock refresh_transfer to do nothing, simulating a successful persistence
    # where the in-memory object state is not lost.
    transfer_service.repo.refresh_transfer = AsyncMock()

    # We also need to mock the update_transfer call, as it's called in the flow
    transfer_service.repo.update_transfer = AsyncMock()

    # Execute the service method
    await transfer_service.director_record_transfer(transfer, mock_director)

    # Check if the to_transaction_id survived the refresh
    # With the bug, this assertion will fail because buggy_refresh sets it to None.
    assert (
        transfer.to_transaction_id is not None
    ), "to_transaction_id was not persisted and was lost on refresh"
    assert transfer.to_transaction_id == to_transaction.transaction_id

