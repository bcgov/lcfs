from datetime import datetime
from math import ceil
from unittest.mock import AsyncMock, MagicMock

import pytest
from starlette.responses import StreamingResponse

from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.transaction.schema import (
    TransactionStatusSchema,
    TransactionViewSchema,
)
from lcfs.web.api.transaction.services import TransactionsService


@pytest.fixture
def mock_repo():
    repo = MagicMock()
    repo.get_transactions_paginated = AsyncMock(return_value=([], 0))
    repo.get_transaction_statuses = AsyncMock(return_value=[])
    return repo


@pytest.fixture
def transactions_service(mock_repo):
    return TransactionsService(repo=mock_repo)


# Test retrieving transactions with filters, sorting, and pagination
@pytest.mark.anyio
async def test_get_transactions(transactions_service):
    pagination_request = PaginationRequestSchema(
        page=1, size=10, filters=[], sort_orders=[]
    )

    mock_transactions = [
        MagicMock(spec=TransactionViewSchema),
        MagicMock(spec=TransactionViewSchema),
        MagicMock(spec=TransactionViewSchema),
    ]
    transactions_service.repo.get_transactions_paginated.return_value = (
        mock_transactions,
        3,
    )

    transactions_data = await transactions_service.get_transactions_paginated(
        pagination=pagination_request
    )

    assert transactions_data["pagination"].total == 3
    assert len(transactions_data["transactions"]) == 3
    assert transactions_data["pagination"].total_pages == ceil(3 / 10)


# Test retrieving transaction statuses
@pytest.mark.anyio
async def test_get_transaction_statuses(transactions_service):
    # Mock data returned by the repository
    mock_statuses = [
        TransactionStatusSchema(status="Declined"),
        TransactionStatusSchema(status="Deleted"),
    ]
    transactions_service.repo.get_transaction_statuses.return_value = mock_statuses

    statuses = await transactions_service.get_transaction_statuses()

    assert len(statuses) == 2
    assert isinstance(statuses[0], TransactionStatusSchema)
    assert statuses[0].status == "Declined"
    assert statuses[1].status == "Deleted"


# Test exporting transactions
@pytest.mark.anyio
async def test_export_transactions(transactions_service):
    # Mock data returned by the repository
    mock_transactions = [
        MagicMock(
            transaction_type="Transfer",
            transaction_id=1,
            compliance_period="2023",
            from_organization="Org A",
            to_organization="Org B",
            quantity=100,
            price_per_unit=10,
            category="Category A",
            status="Approved",
            transaction_effective_date=datetime.now(),
            recorded_date=datetime.now(),
            approved_date=datetime.now(),
            from_org_comment="From Org Comment",
            to_org_comment="To Org Comment",
            government_comment="Government Comment",
        )
    ]
    transactions_service.repo.get_transactions_paginated.return_value = (
        mock_transactions,
        1,
    )

    response = await transactions_service.export_transactions(export_format="csv")

    assert isinstance(response, StreamingResponse)
    assert response.headers["Content-Disposition"].startswith('attachment; filename="')

    # Collect the streamed content
    content = b""
    async for chunk in response.body_iterator:
        content += chunk

    # Convert bytes to string for easier assertion (assuming CSV format)
    content_str = content.decode("utf-8")

    # Check if the content contains expected data
    assert "CT1" in content_str  # Check for transaction ID with prefix
    assert "Org A" in content_str
    assert "Org B" in content_str
    assert "100" in content_str
    assert "10" in content_str
    assert "Category A" in content_str
    assert "Approved" in content_str
    assert "From Org Comment" in content_str
    assert "To Org Comment" in content_str
    assert "Government Comment" in content_str
