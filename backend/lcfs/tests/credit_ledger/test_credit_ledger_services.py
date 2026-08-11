from math import ceil
import io
from datetime import datetime, date, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import openpyxl
import pytest
from starlette.responses import StreamingResponse

from lcfs.utils.constants import LCFS_Constants
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.credit_ledger.schema import CreditLedgerTxnSchema
from lcfs.web.api.credit_ledger.services import CreditLedgerService


@pytest.fixture
def mock_repo():
    repo = MagicMock()
    repo.get_rows_paginated = AsyncMock(return_value=([], 0))
    repo.get_distinct_years = AsyncMock(return_value=[])
    repo.get_period_rows = AsyncMock(return_value=[])
    repo.get_assessed_line_22 = AsyncMock(return_value=None)
    repo.get_first_assessed_year = AsyncMock(return_value=None)
    return repo


def _txn(
    *,
    transaction_id,
    transaction_type,
    status,
    quantity,
    to_org=1,
    from_org=None,
    effective_date=None,
    version=None,
):
    """Build a mv_transaction_aggregate-like row (+ compliance report version)."""
    row = SimpleNamespace(
        transaction_id=transaction_id,
        transaction_type=transaction_type,
        status=status,
        quantity=quantity,
        to_organization_id=to_org,
        from_organization_id=from_org,
        transaction_effective_date=effective_date,
        recorded_date=None,
        approved_date=None,
        create_date=effective_date,
    )
    return (row, version)


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
            organization_id=1, export_format="csv"
        )

        assert isinstance(resp, StreamingResponse)
        assert resp.media_type == "text/csv"
        assert resp.headers["Content-Disposition"].startswith("attachment;")
        assert mock_add_sheet.called
        _, kwargs = mock_add_sheet.call_args
        assert kwargs["rows"][0][3] == "Compliance Report – Supplemental 1"
        _, repo_kwargs = mock_repo.get_rows_paginated.call_args
        assert len(repo_kwargs["conditions"]) == 1


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


# ---------------------------------------------------------------------------
# Compliance-period ledger (#4714)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_period_ledger_running_balance_and_units(
    credit_ledger_service, mock_repo
):
    """Units in/out follow the org's perspective and the running balance
    accumulates chronologically within the period."""
    mock_repo.get_period_rows.return_value = [
        _txn(
            transaction_id=43,
            transaction_type="InitiativeAgreement",
            status="Approved",
            quantity=10000,
            to_org=1,
            effective_date=datetime(2024, 4, 3),
        ),
        _txn(
            transaction_id=243,
            transaction_type="Transfer",
            status="Recorded",
            quantity=5000,
            from_org=1,
            to_org=2,
            effective_date=datetime(2024, 4, 12),
        ),
        _txn(
            transaction_id=79,
            transaction_type="ComplianceReport",
            status="Assessed",
            quantity=-50,
            to_org=1,
            effective_date=datetime(2025, 5, 5),
            version=0,
        ),
    ]
    mock_repo.get_assessed_line_22.side_effect = [1850, 1000]  # current, prev

    data = await credit_ledger_service.get_period_ledger(
        organization_id=1, compliance_period=2024
    )

    # Chronological order, running balance = 10000, 5000, 4950
    assert [t.transaction_id for t in data.transactions] == [43, 243, 79]
    assert [t.units_in for t in data.transactions] == [10000, 0, 0]
    assert [t.units_out for t in data.transactions] == [0, 5000, 50]
    assert [t.running_balance for t in data.transactions] == [10000, 5000, 4950]
    # Compliance report "Original" description
    assert data.transactions[2].description == "Original"


@pytest.mark.anyio
async def test_period_ledger_excludes_pending_by_default(
    credit_ledger_service, mock_repo
):
    mock_repo.get_period_rows.return_value = [
        _txn(
            transaction_id=1,
            transaction_type="Transfer",
            status="Recorded",
            quantity=100,
            to_org=1,
            effective_date=datetime(2024, 4, 1),
        ),
        _txn(
            transaction_id=2,
            transaction_type="Transfer",
            status="Submitted",
            quantity=50,
            from_org=1,
            to_org=2,
            effective_date=datetime(2024, 4, 2),
        ),
    ]

    data = await credit_ledger_service.get_period_ledger(
        organization_id=1, compliance_period=2024
    )
    assert [t.transaction_id for t in data.transactions] == [1]
    assert data.transactions[0].is_pending is False


@pytest.mark.anyio
async def test_period_ledger_includes_pending_when_requested(
    credit_ledger_service, mock_repo
):
    mock_repo.get_period_rows.return_value = [
        _txn(
            transaction_id=1,
            transaction_type="Transfer",
            status="Recorded",
            quantity=100,
            to_org=1,
            effective_date=datetime(2024, 4, 1),
        ),
        _txn(
            transaction_id=2,
            transaction_type="Transfer",
            status="Submitted",
            quantity=50,
            from_org=1,
            to_org=2,
            effective_date=datetime(2024, 4, 2),
        ),
        _txn(
            transaction_id=3,
            transaction_type="Transfer",
            status="Draft",
            quantity=999,
            from_org=1,
            to_org=2,
            effective_date=datetime(2024, 4, 3),
        ),
    ]

    data = await credit_ledger_service.get_period_ledger(
        organization_id=1, compliance_period=2024, include_pending=True
    )
    # Recorded + Submitted included; Draft excluded (not a balance-affecting state)
    assert [t.transaction_id for t in data.transactions] == [1, 2]
    assert data.transactions[1].is_pending is True
    # Running balance includes the pending out: 100, then 50
    assert [t.running_balance for t in data.transactions] == [100, 50]


@pytest.mark.anyio
async def test_period_ledger_totals_by_type(credit_ledger_service, mock_repo):
    mock_repo.get_period_rows.return_value = [
        _txn(
            transaction_id=1,
            transaction_type="Transfer",
            status="Recorded",
            quantity=5000,
            from_org=1,
            to_org=2,
            effective_date=datetime(2024, 4, 12),
        ),
        _txn(
            transaction_id=2,
            transaction_type="Transfer",
            status="Recorded",
            quantity=1000,
            from_org=1,
            to_org=2,
            effective_date=datetime(2024, 5, 5),
        ),
        _txn(
            transaction_id=3,
            transaction_type="InitiativeAgreement",
            status="Approved",
            quantity=10000,
            to_org=1,
            effective_date=datetime(2024, 4, 3),
        ),
    ]

    data = await credit_ledger_service.get_period_ledger(
        organization_id=1, compliance_period=2024
    )
    totals = {t.transaction_type: t for t in data.totals_by_type}
    assert totals["Transfer"].units_out == 6000
    assert totals["Transfer"].net == -6000
    assert totals["InitiativeAgreement"].units_in == 10000
    assert totals["InitiativeAgreement"].net == 10000
    assert data.total_units_in == 10000
    assert data.total_units_out == 6000
    assert data.total_net == 4000


@pytest.mark.anyio
async def test_period_ledger_assessed_balance_prev_and_current(
    credit_ledger_service, mock_repo
):
    mock_repo.get_period_rows.return_value = []
    mock_repo.get_assessed_line_22.side_effect = [750, 1850]  # current, prev

    data = await credit_ledger_service.get_period_ledger(
        organization_id=1, compliance_period=2025
    )
    assert data.assessed_balance.current_year == 2025
    assert data.assessed_balance.current_balance == 750
    assert data.assessed_balance.previous_year == 2024
    assert data.assessed_balance.previous_balance == 1850
    mock_repo.get_assessed_line_22.assert_any_await(
        organization_id=1, compliance_period=2025
    )
    mock_repo.get_assessed_line_22.assert_any_await(
        organization_id=1, compliance_period=2024
    )


@pytest.mark.anyio
async def test_period_ledger_supplemental_is_separate_row(
    credit_ledger_service, mock_repo
):
    """A supplemental report is its own ledger row and does not alter the
    original's row (no daisy-chain recalculation)."""
    mock_repo.get_period_rows.return_value = [
        _txn(
            transaction_id=79,
            transaction_type="ComplianceReport",
            status="Assessed",
            quantity=400,
            to_org=1,
            effective_date=datetime(2025, 5, 5),
            version=0,
        ),
        _txn(
            transaction_id=231,
            transaction_type="ComplianceReport",
            status="Assessed",
            quantity=-50,
            to_org=1,
            effective_date=datetime(2026, 1, 22),
            version=1,
        ),
    ]

    data = await credit_ledger_service.get_period_ledger(
        organization_id=1, compliance_period=2024
    )
    assert data.transactions[0].description == "Original"
    assert data.transactions[0].units_in == 400
    assert data.transactions[1].description == "Supplemental 1"
    assert data.transactions[1].units_out == 50
    # Original row unchanged by the supplemental; running balance is cumulative.
    assert data.transactions[0].running_balance == 400
    assert data.transactions[1].running_balance == 350


@pytest.mark.anyio
async def test_period_ledger_sorts_mixed_date_types(credit_ledger_service, mock_repo):
    """Real mv_transaction_aggregate rows mix ``date``, tz-aware and naive
    ``datetime`` effective dates; the ledger must order them without raising
    (regression for a date/datetime comparison error found against real data)."""
    mock_repo.get_period_rows.return_value = [
        _txn(
            transaction_id=3,
            transaction_type="Transfer",
            status="Recorded",
            quantity=30,
            to_org=1,
            effective_date=datetime(2024, 6, 1, 12, 0, tzinfo=timezone.utc),
        ),
        _txn(
            transaction_id=1,
            transaction_type="Transfer",
            status="Recorded",
            quantity=10,
            to_org=1,
            effective_date=date(2024, 4, 1),
        ),
        _txn(
            transaction_id=2,
            transaction_type="Transfer",
            status="Recorded",
            quantity=20,
            to_org=1,
            effective_date=datetime(2024, 5, 1, 9, 0),
        ),
    ]

    data = await credit_ledger_service.get_period_ledger(
        organization_id=1, compliance_period=2024
    )
    # Ordered April -> May -> June regardless of the source date type.
    assert [t.transaction_id for t in data.transactions] == [1, 2, 3]
    assert [t.running_balance for t in data.transactions] == [10, 30, 60]


@pytest.mark.anyio
async def test_period_ledger_blank_assessed_balance_when_no_assessed_report(
    credit_ledger_service, mock_repo
):
    """
    A year with no assessed report has no assessed balance at all (#4831) —
    None rather than 0, so the UI leaves it blank instead of implying the
    organization ended the year at nil.
    """
    mock_repo.get_period_rows.return_value = []
    mock_repo.get_assessed_line_22.side_effect = [None, 1200]  # current, prev

    data = await credit_ledger_service.get_period_ledger(
        organization_id=1, compliance_period=2025
    )

    assert data.assessed_balance.current_balance is None
    assert data.assessed_balance.previous_balance == 1200


@pytest.mark.anyio
async def test_period_ledger_requests_april_to_march_envelope(
    credit_ledger_service, mock_repo
):
    """The repo is asked for the April 1 – March 31 envelope (#4832)."""
    mock_repo.get_period_rows.return_value = []
    mock_repo.get_first_assessed_year.return_value = 2019

    await credit_ledger_service.get_period_ledger(
        organization_id=1, compliance_period=2024
    )

    mock_repo.get_period_rows.assert_awaited_once_with(
        organization_id=1,
        compliance_period=2024,
        envelope_start=date(2024, 4, 1),
        envelope_end=date(2025, 3, 31),
    )


@pytest.mark.anyio
async def test_period_ledger_first_assessed_year_envelope_opens_in_january(
    credit_ledger_service, mock_repo
):
    """The organization's first assessed year also covers January–March (#4832)."""
    mock_repo.get_period_rows.return_value = []
    mock_repo.get_first_assessed_year.return_value = 2024

    await credit_ledger_service.get_period_ledger(
        organization_id=1, compliance_period=2024
    )

    mock_repo.get_period_rows.assert_awaited_once_with(
        organization_id=1,
        compliance_period=2024,
        envelope_start=date(2024, 1, 1),
        envelope_end=date(2025, 3, 31),
    )


@pytest.mark.anyio
async def test_export_period_ledger_matches_the_on_screen_rows(
    credit_ledger_service, mock_repo
):
    """
    The period export is built from get_period_ledger, so it carries the same
    envelope, rows and running balance as the screen (#4832) — ids and type
    labels formatted the way the ledger displays them.
    """
    mock_repo.get_first_assessed_year.return_value = 2019
    mock_repo.get_period_rows.return_value = [
        _txn(
            transaction_id=43,
            transaction_type="InitiativeAgreement",
            status="Approved",
            quantity=10000,
            to_org=1,
            effective_date=date(2024, 4, 3),
        ),
        _txn(
            transaction_id=79,
            transaction_type="ComplianceReport",
            status="Assessed",
            quantity=-50,
            to_org=1,
            effective_date=date(2025, 2, 5),
            version=1,
        ),
    ]

    with patch(
        "lcfs.web.api.credit_ledger.services.SpreadsheetBuilder.build_spreadsheet",
        return_value=b"dummy-bytes",
    ), patch(
        "lcfs.web.api.credit_ledger.services.SpreadsheetBuilder.add_sheet"
    ) as mock_add_sheet:
        resp = await credit_ledger_service.export_period_ledger(
            organization_id=1, compliance_year=2024, export_format="xlsx"
        )

    assert isinstance(resp, StreamingResponse)
    # The export asks for the same April–March envelope the screen renders.
    mock_repo.get_period_rows.assert_awaited_once_with(
        organization_id=1,
        compliance_period=2024,
        envelope_start=date(2024, 4, 1),
        envelope_end=date(2025, 3, 31),
    )

    _, kwargs = mock_add_sheet.call_args
    rows = kwargs["rows"]
    assert [r[0] for r in rows] == ["IA43", "CR79"]
    assert rows[0][2] == "Initiative Agreement"
    assert rows[1][2] == "Compliance Report - Supplemental 1"
    # Units in / out / running balance, same as the on-screen columns.
    assert rows[0][3:] == [10000, 0, 10000]
    assert rows[1][3:] == [0, 50, 9950]


@pytest.mark.anyio
async def test_export_period_ledger_passes_pending_toggle_through(
    credit_ledger_service, mock_repo
):
    """Downloading with 'show pending' on includes those rows."""
    mock_repo.get_period_rows.return_value = [
        _txn(
            transaction_id=91,
            transaction_type="Transfer",
            status="Submitted",
            quantity=200,
            to_org=1,
            effective_date=date(2024, 9, 9),
        )
    ]

    with patch(
        "lcfs.web.api.credit_ledger.services.SpreadsheetBuilder.build_spreadsheet",
        return_value=b"dummy-bytes",
    ), patch(
        "lcfs.web.api.credit_ledger.services.SpreadsheetBuilder.add_sheet"
    ) as mock_add_sheet:
        await credit_ledger_service.export_period_ledger(
            organization_id=1,
            compliance_year=2024,
            include_pending=True,
            export_format="xlsx",
        )
    assert [r[0] for r in mock_add_sheet.call_args[1]["rows"]] == ["CT91"]

    # ...and with the toggle off the same pending row is left out.
    with patch(
        "lcfs.web.api.credit_ledger.services.SpreadsheetBuilder.build_spreadsheet",
        return_value=b"dummy-bytes",
    ), patch(
        "lcfs.web.api.credit_ledger.services.SpreadsheetBuilder.add_sheet"
    ) as mock_add_sheet:
        await credit_ledger_service.export_period_ledger(
            organization_id=1,
            compliance_year=2024,
            include_pending=False,
            export_format="xlsx",
        )
    assert mock_add_sheet.call_args[1]["rows"] == []


@pytest.mark.anyio
async def test_export_period_ledger_rejects_unsupported_format(
    credit_ledger_service, mock_repo
):
    with pytest.raises(ValueError):
        await credit_ledger_service.export_period_ledger(
            organization_id=1, compliance_year=2024, export_format="pdf"
        )


@pytest.mark.anyio
async def test_export_period_ledger_handles_timezone_aware_dates(
    credit_ledger_service, mock_repo
):
    """
    Regression: openpyxl refuses tz-aware datetimes ("Excel does not support
    datetimes with timezones") and mv_transaction_aggregate emits a mix of
    date, naive and tz-aware values, so writing them through unchanged failed
    the whole download. Builds a real spreadsheet — no mocked builder — so the
    serialization is actually exercised.
    """
    mock_repo.get_period_rows.return_value = [
        _txn(
            transaction_id=1,
            transaction_type="Transfer",
            status="Recorded",
            quantity=10,
            to_org=1,
            effective_date=datetime(2024, 4, 3, 9, 30, tzinfo=timezone.utc),
        ),
        _txn(
            transaction_id=2,
            transaction_type="Transfer",
            status="Recorded",
            quantity=20,
            to_org=1,
            effective_date=date(2024, 5, 1),
        ),
        _txn(
            transaction_id=3,
            transaction_type="Transfer",
            status="Recorded",
            quantity=30,
            to_org=1,
            effective_date=datetime(2024, 6, 1, 12, 0),
        ),
    ]

    resp = await credit_ledger_service.export_period_ledger(
        organization_id=1, compliance_year=2024, export_format="xlsx"
    )
    assert isinstance(resp, StreamingResponse)

    # Every effective date reaches the sheet as a plain, tz-free date.
    with patch(
        "lcfs.web.api.credit_ledger.services.SpreadsheetBuilder.build_spreadsheet",
        return_value=b"dummy-bytes",
    ), patch(
        "lcfs.web.api.credit_ledger.services.SpreadsheetBuilder.add_sheet"
    ) as mock_add_sheet:
        await credit_ledger_service.export_period_ledger(
            organization_id=1, compliance_year=2024, export_format="xlsx"
        )
    dates = [r[1] for r in mock_add_sheet.call_args[1]["rows"]]
    assert dates == [date(2024, 4, 3), date(2024, 5, 1), date(2024, 6, 1)]
    assert all(not isinstance(d, datetime) for d in dates)
