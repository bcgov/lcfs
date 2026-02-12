from datetime import datetime, timezone
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


# -- _to_pacific / recorded-date export tests ----------------------------------


class TestToPacific:
    """Unit tests for TransactionsService._to_pacific."""

    def test_naive_utc_before_midnight_stays_same_day(self):
        """7 AM UTC on Feb 10 = 11 PM PST on Feb 9 — should roll back a day."""
        dt = datetime(2026, 2, 10, 7, 0, 0)  # naive, treated as UTC
        result = TransactionsService._to_pacific(dt)
        assert result.strftime("%Y-%m-%d") == "2026-02-09"

    def test_naive_utc_after_8am_stays_same_day(self):
        """8 AM UTC on Feb 10 = midnight PST on Feb 10 — same calendar day."""
        dt = datetime(2026, 2, 10, 8, 0, 0)
        result = TransactionsService._to_pacific(dt)
        assert result.strftime("%Y-%m-%d") == "2026-02-10"

    def test_naive_utc_midnight_rolls_back(self):
        """Midnight UTC on Feb 11 = 4 PM PST on Feb 10."""
        dt = datetime(2026, 2, 11, 0, 0, 0)
        result = TransactionsService._to_pacific(dt)
        assert result.strftime("%Y-%m-%d") == "2026-02-10"

    def test_aware_utc_midnight_rolls_back(self):
        """Same as above but with an explicit UTC tzinfo."""
        dt = datetime(2026, 2, 11, 0, 0, 0, tzinfo=timezone.utc)
        result = TransactionsService._to_pacific(dt)
        assert result.strftime("%Y-%m-%d") == "2026-02-10"

    def test_naive_utc_late_afternoon_pacific(self):
        """11:59 PM UTC on Feb 10 = 3:59 PM PST on Feb 10 — same day."""
        dt = datetime(2026, 2, 10, 23, 59, 0)
        result = TransactionsService._to_pacific(dt)
        assert result.strftime("%Y-%m-%d") == "2026-02-10"

    def test_pdt_summer_offset(self):
        """During PDT (UTC-7): 6:59 AM UTC on Jul 15 = 11:59 PM PDT on Jul 14."""
        dt = datetime(2026, 7, 15, 6, 59, 0)
        result = TransactionsService._to_pacific(dt)
        assert result.strftime("%Y-%m-%d") == "2026-07-14"

    def test_pdt_summer_after_7am(self):
        """During PDT (UTC-7): 7 AM UTC on Jul 15 = midnight PDT on Jul 15."""
        dt = datetime(2026, 7, 15, 7, 0, 0)
        result = TransactionsService._to_pacific(dt)
        assert result.strftime("%Y-%m-%d") == "2026-07-15"


@pytest.mark.anyio
async def test_export_recorded_date_utc_midnight(transactions_service):
    """A transfer recorded at midnight UTC should export as the previous Pacific day."""
    mock_transactions = [
        MagicMock(
            transaction_type="Transfer",
            transaction_id=99,
            compliance_period="2026",
            from_organization="Org X",
            to_organization="Org Y",
            quantity=4338,
            price_per_unit=189.40,
            category="A",
            status="Recorded",
            transaction_effective_date=datetime(2026, 2, 10, 8, 0, 0),
            # Midnight UTC Feb 11 = 4 PM PST Feb 10
            recorded_date=datetime(2026, 2, 11, 0, 0, 0),
            approved_date=None,
            from_org_comment=None,
            to_org_comment=None,
            government_comment=None,
        )
    ]
    transactions_service.repo.get_transactions_paginated.return_value = (
        mock_transactions,
        1,
    )

    response = await transactions_service.export_transactions(export_format="csv")

    content = b""
    async for chunk in response.body_iterator:
        content += chunk
    content_str = content.decode("utf-8")

    # recorded_date should show Feb 10 (Pacific), not Feb 11 (UTC)
    lines = content_str.strip().split("\n")
    data_line = lines[1]  # first data row after header
    assert "2026-02-10" in data_line
    # Make sure Feb 11 does NOT appear as the recorded date
    # (effective date is also 2026-02-10 so only that date should appear)
    assert "2026-02-11" not in data_line
