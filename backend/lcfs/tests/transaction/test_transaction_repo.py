import pytest
from sqlalchemy import text
from lcfs.web.api.transaction.repo import TransactionRepository  # Ensure this path is correct
from lcfs.tests.transaction.transaction_payloads import (
    transaction_orm_model, transaction_orm_model_2
)
from lcfs.web.api.base import SortOrder

@pytest.fixture
def transaction_repo(dbsession):
    return TransactionRepository(db=dbsession)

# Test retrieving paginated transactions
@pytest.mark.anyio
async def test_get_transactions_paginated(dbsession, transaction_repo):
    # Add test transactions to the session
    dbsession.add_all([transaction_orm_model, transaction_orm_model_2])
    await dbsession.commit()
    
    conditions = []
    sort_orders = [SortOrder(field='transaction_id', direction='asc')]
    
    transactions, total_count = await transaction_repo.get_transactions_paginated(0, 10, conditions, sort_orders)
    
    assert len(transactions) >= 2
    assert total_count >= 2
    assert transactions[0].transaction_id < transactions[1].transaction_id  # Ascending order check


# Test retrieving transaction statuses
@pytest.mark.anyio
async def test_get_transaction_statuses(dbsession, transaction_repo):
    statuses = await transaction_repo.get_transaction_statuses()
    # Assert based on expected outcomes
    assert len(statuses) > 0  # Assuming there's at least one status in your test DB
