import pytest
from lcfs.web.api.base import SortOrder
from lcfs.web.api.transaction.repo import EntityType, TransactionRepository
from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.tests.transaction.transaction_payloads import *


@pytest.fixture
def transaction_repo(dbsession):
    return TransactionRepository(db=dbsession)


@pytest.mark.anyio
async def test_transactions_in_draft_status_are_visible_to_transferor(
    dbsession, transaction_repo
):
    dbsession.add_all([draft_transfer_orm])
    await dbsession.commit()

    conditions = []
    sort_orders = [SortOrder(field="transaction_id", direction="asc")]

    transactions_transferor, total_count_transferor = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 1
        )
    )
    transactions_transferee, total_count_transferee = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 2
        )
    )
    transactions_gov, total_count_gov = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders
        )
    )

    assert len(transactions_transferor) == 1
    assert total_count_transferor == 1

    assert len(transactions_transferee) == 0
    assert total_count_transferee == 0

    assert len(transactions_gov) == 0
    assert total_count_gov == 0


@pytest.mark.anyio
async def test_transactions_in_deleted_status_are_not_visible_to_any_entity(
    dbsession, transaction_repo
):
    dbsession.add_all([deleted_transfer_orm])
    await dbsession.commit()

    conditions = []
    sort_orders = [SortOrder(field="transaction_id", direction="asc")]

    transactions_transferor, total_count_transferor = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 1
        )
    )
    transactions_transferee, total_count_transferee = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 2
        )
    )
    transactions_gov, total_count_gov = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders
        )
    )

    assert len(transactions_transferor) == 0
    assert total_count_transferor == 0

    assert len(transactions_transferee) == 0
    assert total_count_transferee == 0

    assert len(transactions_gov) == 0
    assert total_count_gov == 0


@pytest.mark.anyio
async def test_transactions_in_sent_status_are_visible_to_transferor_and_transferee(
    dbsession, transaction_repo
):
    dbsession.add_all([sent_transfer_orm])
    await dbsession.commit()

    conditions = []
    sort_orders = [SortOrder(field="transaction_id", direction="asc")]

    transactions_transferor, total_count_transferor = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 1
        )
    )
    transactions_transferee, total_count_transferee = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 2
        )
    )
    transactions_gov, total_count_gov = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders
        )
    )

    assert len(transactions_transferor) == 1
    assert total_count_transferor == 1

    assert len(transactions_transferee) == 1
    assert total_count_transferee == 1

    assert len(transactions_gov) == 0
    assert total_count_gov == 0


@pytest.mark.anyio
async def test_transactions_in_submitted_status_are_visible_to_all_entities(
    dbsession, transaction_repo
):
    dbsession.add_all([submitted_transfer_orm])
    await dbsession.commit()

    conditions = []
    sort_orders = [SortOrder(field="transaction_id", direction="asc")]

    transactions_transferor, total_count_transferor = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 1
        )
    )
    transactions_transferee, total_count_transferee = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 2
        )
    )
    transactions_gov, total_count_gov = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders
        )
    )

    assert len(transactions_transferor) == 1
    assert total_count_transferor == 1

    assert len(transactions_transferee) == 1
    assert total_count_transferee == 1

    assert len(transactions_gov) == 1
    assert total_count_gov == 1


@pytest.mark.anyio
async def test_transactions_in_recommended_status_are_visible_to_all_entities(
    dbsession, transaction_repo
):
    dbsession.add_all([recommended_transfer_orm])
    await dbsession.commit()

    conditions = []
    sort_orders = [SortOrder(field="transaction_id", direction="asc")]

    transactions_transferor, total_count_transferor = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 1
        )
    )
    transactions_transferee, total_count_transferee = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 2
        )
    )
    transactions_gov, total_count_gov = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders
        )
    )

    assert len(transactions_transferor) == 1
    assert total_count_transferor == 1

    assert len(transactions_transferee) == 1
    assert total_count_transferee == 1

    assert len(transactions_gov) == 1
    assert total_count_gov == 1


@pytest.mark.anyio
async def test_transactions_in_recorded_status_are_visible_to_all_entities(
    dbsession, transaction_repo
):
    dbsession.add_all([recorded_transfer_orm])
    await dbsession.commit()

    conditions = []
    sort_orders = [SortOrder(field="transaction_id", direction="asc")]

    transactions_transferor, total_count_transferor = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 1
        )
    )
    transactions_transferee, total_count_transferee = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 2
        )
    )
    transactions_gov, total_count_gov = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders
        )
    )

    assert len(transactions_transferor) == 1
    assert total_count_transferor == 1

    assert len(transactions_transferee) == 1
    assert total_count_transferee == 1

    assert len(transactions_gov) == 1
    assert total_count_gov == 1


@pytest.mark.anyio
async def test_transactions_in_refused_status_are_visible_to_all_entities(
    dbsession, transaction_repo
):
    dbsession.add_all([refused_transfer_orm])
    await dbsession.commit()

    conditions = []
    sort_orders = [SortOrder(field="transaction_id", direction="asc")]

    transactions_transferor, total_count_transferor = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 1
        )
    )
    transactions_transferee, total_count_transferee = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 2
        )
    )
    transactions_gov, total_count_gov = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders
        )
    )

    assert len(transactions_transferor) == 1
    assert total_count_transferor == 1

    assert len(transactions_transferee) == 1
    assert total_count_transferee == 1

    assert len(transactions_gov) == 1
    assert total_count_gov == 1


@pytest.mark.anyio
async def test_transactions_in_declined_status_are_visible_to_transferor_and_transferee(
    dbsession, transaction_repo
):
    dbsession.add_all([declined_transfer_orm])
    await dbsession.commit()

    conditions = []
    sort_orders = [SortOrder(field="transaction_id", direction="asc")]

    transactions_transferor, total_count_transferor = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 1
        )
    )
    transactions_transferee, total_count_transferee = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 2
        )
    )
    transactions_gov, total_count_gov = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders
        )
    )

    assert len(transactions_transferor) == 1
    assert total_count_transferor == 1

    assert len(transactions_transferee) == 1
    assert total_count_transferee == 1

    assert len(transactions_gov) == 0
    assert total_count_gov == 0


@pytest.mark.anyio
async def test_transactions_in_rescinded_status_are_visible_to_all_entities(
    dbsession, transaction_repo
):
    dbsession.add_all([rescinded_transfer_orm])
    await dbsession.commit()

    conditions = []
    sort_orders = [SortOrder(field="transaction_id", direction="asc")]

    transactions_transferor, total_count_transferor = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 1
        )
    )
    transactions_transferee, total_count_transferee = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 2
        )
    )
    transactions_gov, total_count_gov = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders
        )
    )

    assert len(transactions_transferor) == 1
    assert total_count_transferor == 1

    assert len(transactions_transferee) == 1
    assert total_count_transferee == 1

    assert len(transactions_gov) == 1
    assert total_count_gov == 1


@pytest.mark.anyio
async def test_initiative_agreement_transactions_visible(dbsession, transaction_repo):
    dbsession.add_all([initiative_agreement_status_orm, initiative_agreement_orm])
    await dbsession.commit()

    conditions = []
    sort_orders = [SortOrder(field="transaction_id", direction="asc")]

    transactions_transferor, total_count_transferor = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 1
        )
    )
    transactions_transferee, total_count_transferee = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 2
        )
    )
    transactions_gov, total_count_gov = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders
        )
    )

    assert len(transactions_transferor) == 1
    assert total_count_transferor == 1

    assert len(transactions_transferee) == 0
    assert total_count_transferee == 0

    assert len(transactions_gov) == 1
    assert total_count_gov == 1


@pytest.mark.anyio
async def test_admin_adjustment_transactions_visible(dbsession, transaction_repo):
    dbsession.add_all([admin_adjustment_status_orm, admin_adjustment_orm])
    await dbsession.commit()

    conditions = []
    sort_orders = [SortOrder(field="transaction_id", direction="asc")]

    transactions_transferor, total_count_transferor = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 1
        )
    )
    transactions_transferee, total_count_transferee = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders, 2
        )
    )
    transactions_gov, total_count_gov = (
        await transaction_repo.get_transactions_paginated(
            0, 10, conditions, sort_orders
        )
    )

    assert len(transactions_transferor) == 1
    assert total_count_transferor == 1

    assert len(transactions_transferee) == 0
    assert total_count_transferee == 0

    assert len(transactions_gov) == 1
    assert total_count_gov == 1


# description
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
