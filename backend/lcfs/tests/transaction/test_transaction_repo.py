import pytest

from lcfs.db.models import ComplianceReport
from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.tests.transaction.transaction_payloads import *
from lcfs.web.api.base import SortOrder
from lcfs.web.api.transaction.repo import TransactionRepository, EntityType
from lcfs.web.exception.exceptions import DatabaseException


@pytest.fixture
def transaction_repo(dbsession):
    return TransactionRepository(db=dbsession)


@pytest.fixture
async def mock_transactions(dbsession):
    transactions = [
        test_org,
        test_org_2,
        deleted_transfer_orm,
        draft_transfer_orm,
        submitted_transfer_orm,
        sent_transfer_orm,
        recorded_transfer_orm,
        recommended_transfer_orm,
        refused_transfer_orm,
        declined_transfer_orm,
        rescinded_transfer_orm,
        initiative_agreement_orm,
        admin_adjustment_orm,
        adjustment_transaction_orm,
        reserved_transaction_orm,
    ]
    dbsession.add_all(transactions)
    await dbsession.flush()

    return transactions


@pytest.mark.anyio
async def test_calculate_total_balance(dbsession, transaction_repo, mock_transactions):
    total_balance = await transaction_repo.calculate_total_balance(test_org_id)
    assert total_balance == 100


@pytest.mark.anyio
async def test_calculate_reserved_balance(
    dbsession, transaction_repo, mock_transactions
):
    reserved_balance = await transaction_repo.calculate_reserved_balance(test_org_id)
    assert reserved_balance == 100


@pytest.mark.anyio
async def test_calculate_available_balance(
    dbsession, transaction_repo, mock_transactions
):
    available_balance = await transaction_repo.calculate_available_balance(test_org_id)
    assert available_balance == 0


@pytest.mark.anyio
async def test_create_transaction(dbsession, transaction_repo):
    dbsession.add_all([test_org])
    await dbsession.flush()

    new_transaction = await transaction_repo.create_transaction(
        TransactionActionEnum.Adjustment, 100, test_org_id
    )
    assert new_transaction.transaction_action == TransactionActionEnum.Adjustment
    assert new_transaction.compliance_units == 100
    assert new_transaction.organization_id == test_org_id


@pytest.mark.anyio
async def test_reserve_transaction(dbsession, transaction_repo, mock_transactions):
    success = await transaction_repo.reserve_transaction(4)

    assert success == True
    updated_transaction = await dbsession.get(Transaction, 4)
    assert updated_transaction.transaction_action is TransactionActionEnum.Reserved


@pytest.mark.anyio
async def test_release_transaction(dbsession, transaction_repo, mock_transactions):
    success = await transaction_repo.release_transaction(4)
    assert success

    updated_transaction = await dbsession.get(Transaction, 4)
    assert updated_transaction.transaction_action == TransactionActionEnum.Released


@pytest.mark.anyio
async def test_confirm_transaction(dbsession, transaction_repo, mock_transactions):
    success = await transaction_repo.confirm_transaction(4)
    assert success

    updated_transaction = await dbsession.get(Transaction, 4)
    assert updated_transaction.transaction_action == TransactionActionEnum.Adjustment


@pytest.mark.anyio
async def test_transactions_in_have_correct_visibilities(
    dbsession, transaction_repo, mock_transactions
):
    sort_orders = [SortOrder(field="transaction_id", direction="asc")]

    transactions_transferor, total_count_transferor = (
        await transaction_repo.get_transactions_paginated(
            0, 10, [], sort_orders, test_org_id
        )
    )
    transactions_transferee, total_count_transferee = (
        await transaction_repo.get_transactions_paginated(
            0, 10, [], sort_orders, test_org_2_id
        )
    )
    transactions_gov, total_count_gov = (
        await transaction_repo.get_transactions_paginated(0, 10, [], sort_orders)
    )

    assert len(transactions_transferor) == 8
    assert total_count_transferor == 8

    assert len(transactions_transferee) == 7
    assert total_count_transferee == 7

    # No Rescinded transfer shown in the government transactions
    assert len(transactions_gov) == 8
    assert total_count_gov == 8


@pytest.mark.anyio
async def test_get_visible_statuses_invalid_entity_type(transaction_repo):
    with pytest.raises(DatabaseException):
        await transaction_repo.get_visible_statuses("InvalidEntity")


@pytest.mark.anyio
async def test_get_visible_statuses_for_transferor(dbsession, transaction_repo):
    visible_statuses = await transaction_repo.get_visible_statuses(
        EntityType.Transferor
    )
    expected_statuses = [
        TransferStatusEnum.Draft,
        TransferStatusEnum.Sent,
        TransferStatusEnum.Submitted,
        TransferStatusEnum.Recommended,
        TransferStatusEnum.Recorded,
        TransferStatusEnum.Refused,
        TransferStatusEnum.Declined,
        TransferStatusEnum.Rescinded,
    ]

    # Verify that only the expected statuses are returned for a transferor
    assert set(visible_statuses) == set(
        expected_statuses
    ), "Unexpected statuses returned for transferor"


@pytest.mark.anyio
async def test_get_visible_statuses_for_transferee(dbsession, transaction_repo):
    visible_statuses = await transaction_repo.get_visible_statuses(
        EntityType.Transferee
    )
    expected_statuses = [
        TransferStatusEnum.Sent,
        TransferStatusEnum.Submitted,
        TransferStatusEnum.Recommended,
        TransferStatusEnum.Recorded,
        TransferStatusEnum.Refused,
        TransferStatusEnum.Declined,
        TransferStatusEnum.Rescinded,
    ]
    # Verify that only the expected statuses are returned for a transferee
    assert set(visible_statuses) == set(
        expected_statuses
    ), "Unexpected statuses returned for transferee"


@pytest.mark.anyio
async def test_get_visible_statuses_for_government(dbsession, transaction_repo):
    visible_statuses = await transaction_repo.get_visible_statuses(
        EntityType.Government
    )
    expected_statuses = [
        TransferStatusEnum.Submitted,
        TransferStatusEnum.Recommended,
        TransferStatusEnum.Recorded,
        TransferStatusEnum.Refused,
        TransferStatusEnum.Rescinded,
    ]
    # Verify that only the expected statuses are returned for the government
    assert set(visible_statuses) == set(
        expected_statuses
    ), "Unexpected statuses returned for government"


@pytest.mark.anyio
async def test_delete_transaction_success(dbsession, transaction_repo):
    """
    Verify that a transaction is deleted and its associated compliance report
    has its transaction_id set to None.
    """
    # Create and add a Transaction and a ComplianceReport referencing that transaction.
    transaction = Transaction(transaction_id=1000)
    compliance_report = ComplianceReport(
        compliance_report_id=2000,
        transaction_id=1000,
        compliance_period_id=15,
        organization_id=1,
    )
    dbsession.add_all([transaction, compliance_report])
    await dbsession.flush()

    # Call the delete_transaction method.
    await transaction_repo.delete_transaction(1000, 2000)
    await dbsession.commit()

    # Verify the Transaction is deleted.
    deleted_transaction = await dbsession.get(Transaction, 1000)
    assert deleted_transaction is None

    # Verify the ComplianceReport has been updated.
    updated_report = await dbsession.get(ComplianceReport, 2000)
    assert updated_report.transaction_id is None
