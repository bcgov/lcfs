import pytest
from math import ceil

from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.transaction.services import TransactionsService
from lcfs.web.api.transaction.schema import TransactionStatusSchema
from lcfs.web.api.transaction.repo import TransactionRepository

@pytest.fixture
def transfer_repo(dbsession):
    return TransactionRepository(db=dbsession)

@pytest.fixture
def transactions_service(transfer_repo):
    return TransactionsService(repo=transfer_repo)

# Test retrieving transactions with filters, sorting, and pagination
@pytest.mark.anyio
async def test_get_transactions(transactions_service):
    # Simulate pagination request schema
    pagination_request = PaginationRequestSchema(
        page=1, size=10, filters=[], sortOrders=[]
    )
    
    transactions_data = await transactions_service.get_transactions_paginated(pagination=pagination_request)
    
    assert transactions_data["pagination"].total == 3
    assert len(transactions_data["transactions"]) == 3
    assert transactions_data["pagination"].total_pages == ceil(2 / 10)

# Test retrieving transaction statuses
@pytest.mark.anyio
async def test_get_transaction_statuses(transactions_service):
    statuses = await transactions_service.get_transaction_statuses()
    
    assert len(statuses) == 9
    assert isinstance(statuses[0], TransactionStatusSchema)
    assert statuses[0].status == "Declined"
    assert statuses[1].status == "Deleted"

# TODO add more detailed filtering tests
