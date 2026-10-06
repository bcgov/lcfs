from datetime import date, datetime, timezone
import csv
import io
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
    repo.get_transfer_export_details = AsyncMock(return_value={})
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
@pytest.mark.parametrize("export_format", ["xls", "xlsx"])
async def test_export_transactions_writes_transaction_mv_dates_as_excel_dates(
    transactions_service, export_format
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
    transactions_service.repo.get_transfer_export_details.return_value = {
        99: MagicMock(
            agreement_date=datetime(2026, 2, 9),
            is_a1_category=False,
        )
    }

    with patch(
        "lcfs.web.api.transaction.services.SpreadsheetBuilder.build_spreadsheet",
        return_value=b"dummy-bytes",
    ), patch(
        "lcfs.web.api.transaction.services.SpreadsheetBuilder.add_sheet"
    ) as mock_add_sheet:
        await transactions_service.export_transactions(export_format=export_format)

    row = mock_add_sheet.call_args.kwargs["rows"][0]
    assert row[9:13] == [
        date(2026, 2, 9),
        date(2026, 2, 11),
        date(2026, 2, 11),
        date(2026, 7, 15),
    ]
    assert all(not isinstance(value, datetime) for value in row[9:13])


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


# -- Agreement Date column and A1 category (#5030) -----------------------------


def _view_row(**overrides):
    """An mv_transaction_aggregate row as the export reads it."""
    row = dict(
        transaction_type="Transfer",
        transaction_id=7,
        compliance_period="2026",
        from_organization="Org A",
        to_organization="Org B",
        quantity=100,
        price_per_unit=250.0,
        category="A",
        status="Recorded",
        transaction_effective_date=datetime(2026, 3, 20),
        recorded_date=datetime(2026, 3, 20, 18, 0, 0),
        approved_date=None,
        from_org_comment=None,
        to_org_comment=None,
        government_comment=None,
    )
    row.update(overrides)
    return MagicMock(**row)


def _transfer_details(agreement_date=None, is_a1_category=False):
    return MagicMock(agreement_date=agreement_date, is_a1_category=is_a1_category)


async def _export_csv(transactions_service, rows, transfer_details):
    repo = transactions_service.repo
    repo.get_transactions_paginated.return_value = (rows, len(rows))
    repo.get_transfer_export_details.return_value = transfer_details

    response = await transactions_service.export_transactions(export_format="csv")
    content = b""
    async for chunk in response.body_iterator:
        content += chunk
    return csv.DictReader(io.StringIO(content.decode("utf-8")))


@pytest.mark.anyio
async def test_export_agreement_date_column_sits_with_the_dates(
    transactions_service,
):
    reader = await _export_csv(transactions_service, [], {})

    headers = reader.fieldnames
    status_idx = headers.index("Status")
    assert headers[status_idx : status_idx + 3] == [
        "Status",
        "Agreement Date",
        "Effective Date",
    ]


@pytest.mark.anyio
async def test_export_shows_a1_category_and_agreement_date(transactions_service):
    reader = await _export_csv(
        transactions_service,
        [_view_row(transaction_id=7, category="A")],
        {7: _transfer_details(datetime(2026, 3, 2), is_a1_category=True)},
    )

    (row,) = list(reader)
    assert row["ID"] == "CT7"
    assert row["Category"] == "A1"
    assert row["Agreement Date"] == "2026-03-02"
    assert row["Effective Date"] == "2026-03-20"


@pytest.mark.anyio
async def test_export_keeps_existing_categories(transactions_service):
    reader = await _export_csv(
        transactions_service,
        [
            _view_row(transaction_id=1, category="A"),
            _view_row(transaction_id=2, category="B"),
            _view_row(transaction_id=3, category="C"),
            _view_row(transaction_id=4, category="D"),
            _view_row(transaction_id=5, category=None, status="Submitted"),
            # A flag left on a transfer moved out of Category A stays hidden
            _view_row(transaction_id=6, category="B"),
        ],
        {
            1: _transfer_details(datetime(2026, 1, 5)),
            2: _transfer_details(datetime(2025, 8, 1)),
            3: _transfer_details(datetime(2024, 11, 30)),
            4: _transfer_details(datetime(2026, 2, 14)),
            5: _transfer_details(datetime(2026, 3, 1)),
            6: _transfer_details(datetime(2025, 9, 9), is_a1_category=True),
        },
    )

    rows = {row["ID"]: row for row in reader}
    assert [rows[f"CT{i}"]["Category"] for i in range(1, 7)] == [
        "A",
        "B",
        "C",
        "D",
        "",
        "B",
    ]
    assert rows["CT1"]["Agreement Date"] == "2026-01-05"
    assert rows["CT5"]["Agreement Date"] == "2026-03-01"


@pytest.mark.anyio
async def test_export_agreement_date_blank_when_not_applicable(
    transactions_service,
):
    reader = await _export_csv(
        transactions_service,
        [
            # Legacy transfer recorded without an agreement date
            _view_row(transaction_id=7, category="A"),
            _view_row(transaction_id=8, category="A"),
            # Same ID as transfer 8, but IDs are only unique per type
            _view_row(
                transaction_type="InitiativeAgreement",
                transaction_id=8,
                from_organization=None,
                price_per_unit=None,
                category=None,
                status="Approved",
            ),
            _view_row(
                transaction_type="AdminAdjustment",
                transaction_id=9,
                from_organization=None,
                price_per_unit=None,
                category=None,
                status="Approved",
            ),
        ],
        {
            7: _transfer_details(agreement_date=None),
            8: _transfer_details(datetime(2026, 3, 2), is_a1_category=True),
        },
    )

    rows = {row["ID"]: row for row in reader}
    assert rows["CT7"]["Agreement Date"] == ""
    assert rows["CT7"]["Category"] == "A"
    assert rows["CT8"]["Agreement Date"] == "2026-03-02"
    assert rows["CT8"]["Category"] == "A1"
    assert rows["IA8"]["Agreement Date"] == ""
    assert rows["IA8"]["Category"] == ""
    assert rows["AA9"]["Agreement Date"] == ""

    # Only the transfer rows are looked up
    transactions_service.repo.get_transfer_export_details.assert_awaited_once_with(
        [7, 8]
    )
