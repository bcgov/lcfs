from datetime import date, datetime
from math import ceil
from unittest.mock import AsyncMock, MagicMock, patch

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


# -- export date tests ---------------------------------------------------------


@pytest.mark.anyio
async def test_export_recorded_date_utc_midnight(transactions_service):
    """The transaction MV already emits Vancouver-local dates for export."""
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

    lines = content_str.strip().split("\n")
    data_line = lines[1]  # first data row after header
    assert "2026-02-11" in data_line


@pytest.mark.anyio
async def test_export_transactions_writes_transaction_mv_dates_as_excel_dates(
    transactions_service,
):
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
            transaction_effective_date=date(2026, 2, 11),
            recorded_date=datetime(2026, 2, 11, 0, 0),
            approved_date=datetime(2026, 7, 15, 6, 59),
            from_org_comment=None,
            to_org_comment=None,
            government_comment=None,
        )
    ]
    transactions_service.repo.get_transactions_paginated.return_value = (
        mock_transactions,
        1,
    )

    with patch(
        "lcfs.web.api.transaction.services.SpreadsheetBuilder.build_spreadsheet",
        return_value=b"dummy-bytes",
    ), patch(
        "lcfs.web.api.transaction.services.SpreadsheetBuilder.add_sheet"
    ) as mock_add_sheet:
        await transactions_service.export_transactions(export_format="xlsx")

    row = mock_add_sheet.call_args.kwargs["rows"][0]
    assert row[9:12] == [
        date(2026, 2, 11),
        date(2026, 2, 11),
        date(2026, 7, 15),
    ]
    assert all(not isinstance(value, datetime) for value in row[9:12])


# A government export scoped to an organisation must not go through the
# repository's supplier visibility rules — those restrict non-transfer rows to
# Approved/Assessed and so silently drop legacy ("Recorded") transactions that
# the analyst can see in the grid (#4809).
@pytest.mark.anyio
async def test_export_transactions_government_org_keeps_government_visibility(
    transactions_service,
):
    await transactions_service.export_transactions(
        export_format="csv",
        pagination=None,
        organization_id=42,
        is_government=True,
    )

    args, _ = transactions_service.repo.get_transactions_paginated.call_args
    offset, limit, conditions, _sort_orders, repo_organization_id = args

    # organization_id withheld from the repo so the government branch applies…
    assert repo_organization_id is None
    # …and the organisation scope applied as an explicit condition instead.
    assert any("from_organization_id" in str(c) for c in conditions)
    assert any("to_organization_id" in str(c) for c in conditions)
    assert offset == 0
    assert limit is None


# A supplier export must keep the repository's role-based visibility rules.
@pytest.mark.anyio
async def test_export_transactions_supplier_keeps_role_visibility(
    transactions_service,
):
    await transactions_service.export_transactions(
        export_format="csv",
        pagination=None,
        organization_id=42,
    )

    args, _ = transactions_service.repo.get_transactions_paginated.call_args
    assert args[4] == 42


# The all-transactions government export has no organisation to scope by.
@pytest.mark.anyio
async def test_export_transactions_government_all_orgs(transactions_service):
    await transactions_service.export_transactions(
        export_format="csv",
        pagination=None,
        is_government=True,
    )

    args, _ = transactions_service.repo.get_transactions_paginated.call_args
    assert args[4] is None
