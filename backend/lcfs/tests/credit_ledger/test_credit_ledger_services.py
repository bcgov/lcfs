from math import ceil
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.responses import StreamingResponse

from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.credit_ledger.schema import CreditLedgerTxnSchema
from lcfs.web.api.credit_ledger.services import CreditLedgerService


@pytest.fixture
def mock_repo():
    repo = MagicMock()
    repo.get_rows_paginated = AsyncMock(return_value=([], 0))
    repo.get_distinct_years = AsyncMock(return_value=[])
    return repo


@pytest.fixture
def credit_ledger_service(mock_repo):
    return CreditLedgerService(repo=mock_repo)


@pytest.mark.anyio
async def test_get_ledger_paginated_success(credit_ledger_service, mock_repo):
    pagination_request = PaginationRequestSchema(
        page=2, size=5, filters=[], sort_orders=[]
    )

    ledger_view = SimpleNamespace(
        transaction_type="ComplianceReport",
        compliance_period="2023",
        organization_id=1,
        compliance_units=10,
        available_balance=10,
        update_date="2024-01-01",
    )
    mock_rows = [(ledger_view, 2)]
    mock_repo.get_rows_paginated.return_value = (mock_rows, 12)

    data = await credit_ledger_service.get_ledger_paginated(
        organization_id=1, pagination=pagination_request
    )

    assert data.pagination.total == 12
    assert data.pagination.total_pages == ceil(12 / 5)
    assert len(data.ledger) == 1
    assert isinstance(data.ledger[0], CreditLedgerTxnSchema)
    assert data.ledger[0].description == "Supplemental 2"


@pytest.mark.anyio
async def test_export_transactions_generates_stream(credit_ledger_service, mock_repo):
    with patch(
        "lcfs.web.api.credit_ledger.services.SpreadsheetBuilder.build_spreadsheet",
        return_value=b"dummy-bytes",
    ), patch(
        "lcfs.web.api.credit_ledger.services.SpreadsheetBuilder.add_sheet"
    ) as mock_add_sheet:
        ledger_view = SimpleNamespace(
            transaction_type="ComplianceReport",
            compliance_period="2023",
            organization_id=1,
            compliance_units=10,
            available_balance=10,
            update_date=datetime(2024, 1, 1),
        )
        mock_repo.get_rows_paginated.return_value = ([(ledger_view, 1)], 1)

        resp = await credit_ledger_service.export_transactions(
            organization_id=1, compliance_year=None, export_format="csv"
        )

        assert isinstance(resp, StreamingResponse)
        assert resp.media_type == "text/csv"
        assert resp.headers["Content-Disposition"].startswith("attachment;")
        assert mock_add_sheet.called
        _, kwargs = mock_add_sheet.call_args
        assert kwargs["rows"][0][3] == "Compliance Report – Supplemental 1"


@pytest.mark.anyio
async def test_get_organization_years_success(credit_ledger_service, mock_repo):
    """Test getting organization years returns years from repo."""
    expected_years = ["2024", "2023", "2022"]
    mock_repo.get_distinct_years.return_value = expected_years

    organization_id = 123
    years = await credit_ledger_service.get_organization_years(
        organization_id=organization_id
    )

    assert years == expected_years
    mock_repo.get_distinct_years.assert_called_once_with(
        organization_id=organization_id
    )


@pytest.mark.anyio
async def test_get_organization_years_empty_list(credit_ledger_service, mock_repo):
    """Test getting organization years returns empty list when no data."""
    mock_repo.get_distinct_years.return_value = []

    organization_id = 456
    years = await credit_ledger_service.get_organization_years(
        organization_id=organization_id
    )

    assert years == []
    mock_repo.get_distinct_years.assert_called_once_with(
        organization_id=organization_id
    )
