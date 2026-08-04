from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock

from lcfs.web.api.base import SortOrder
from lcfs.web.api.credit_ledger.repo import CreditLedgerRepository


@pytest.fixture()
def mock_session() -> MagicMock:
    session = MagicMock()
    session.execute = AsyncMock()
    session.scalar = AsyncMock()
    return session


@pytest.fixture()
def repo(mock_session: MagicMock) -> CreditLedgerRepository:
    return CreditLedgerRepository(db=mock_session)


@pytest.mark.anyio
async def test_get_rows_default_sort(
    repo: CreditLedgerRepository, mock_session: MagicMock
):
    # Row has _wf_total for the window-function count; repo strips it and returns
    # 2-tuples so callers can still unpack as (ledger_view, version).
    fake_row = MagicMock()
    fake_row._wf_total = 1
    execute_result = MagicMock()
    execute_result.all.return_value = [fake_row]

    mock_session.execute.return_value = execute_result

    rows, total = await repo.get_rows_paginated(
        offset=0,
        limit=10,
        conditions=[],
        sort_orders=[],
    )

    assert len(rows) == 1
    assert rows[0] == (fake_row[0], fake_row[1])
    assert total == 1
    # Single execute; scalar no longer called (count from window function)
    mock_session.execute.assert_called_once()
    mock_session.scalar.assert_not_called()


@pytest.mark.anyio
async def test_get_rows_with_sort_and_paging(
    repo: CreditLedgerRepository, mock_session: MagicMock
):
    row1, row2 = MagicMock(), MagicMock()
    row1._wf_total = 2
    row2._wf_total = 2
    execute_result = MagicMock()
    execute_result.all.return_value = [row1, row2]

    mock_session.execute.return_value = execute_result

    sort_orders = [SortOrder(field="update_date", direction="desc")]

    rows, total = await repo.get_rows_paginated(
        offset=15,
        limit=5,
        conditions=[],
        sort_orders=sort_orders,
    )

    assert len(rows) == 2
    assert rows[0] == (row1[0], row1[1])
    assert rows[1] == (row2[0], row2[1])
    assert total == 2
    mock_session.execute.assert_called_once()
    mock_session.scalar.assert_not_called()


@pytest.mark.anyio
async def test_get_distinct_years(
    repo: CreditLedgerRepository, mock_session: MagicMock
):
    """Test getting distinct years for an organization."""
    fake_years = ["2024", "2023", "2022"]
    execute_result = MagicMock()
    execute_result.scalars.return_value.all.return_value = fake_years

    mock_session.execute.return_value = execute_result

    organization_id = 123
    years = await repo.get_distinct_years(organization_id=organization_id)

    assert years == fake_years
    mock_session.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_distinct_years_filters_nulls(
    repo: CreditLedgerRepository, mock_session: MagicMock
):
    """Test that get_distinct_years filters out null years."""
    fake_years_with_nulls = ["2024", None, "2023", "", "2022"]
    expected_years = ["2024", "2023", "2022"]

    execute_result = MagicMock()
    execute_result.scalars.return_value.all.return_value = fake_years_with_nulls

    mock_session.execute.return_value = execute_result

    organization_id = 123
    years = await repo.get_distinct_years(organization_id=organization_id)

    assert years == expected_years
    mock_session.execute.assert_called_once()


# ---------------------------------------------------------------------------
# Integration tests — real test database + materialized view (#4714)
# ---------------------------------------------------------------------------
from datetime import datetime, timezone

from sqlalchemy import select, text

from lcfs.db.models.transaction.Transaction import (
    Transaction,
    TransactionActionEnum,
)
from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.transfer.TransferStatus import TransferStatus, TransferStatusEnum


async def _transfer_status_id(dbsession, status_enum) -> int:
    return (
        await dbsession.execute(
            select(TransferStatus.transfer_status_id).where(
                TransferStatus.status == status_enum
            )
        )
    ).scalar_one()


def _transfer(transfer_id, status_id, effective_date, quantity=100):
    return Transfer(
        transfer_id=transfer_id,
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=effective_date,
        transaction_effective_date=effective_date,
        price_per_unit=1.0,
        quantity=quantity,
        transfer_category_id=1,
        current_status_id=status_id,
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True,
    )


@pytest.mark.anyio
async def test_get_period_rows_pending_transfer_falls_back_to_effective_year(
    dbsession, add_models
):
    """Regression (#4714): pending transfers carry compliance_period 'N/A' in
    mv_transaction_aggregate until recorded, so the period query must fall back
    to the transaction's effective-date year — otherwise the 'show pending'
    toggle can never surface them."""
    recorded_id = await _transfer_status_id(dbsession, TransferStatusEnum.Recorded)
    submitted_id = await _transfer_status_id(dbsession, TransferStatusEnum.Submitted)

    await add_models(
        [
            _transfer(770001, recorded_id, datetime(2024, 6, 1)),
            _transfer(770002, submitted_id, datetime(2024, 11, 1)),
        ]
    )
    # Refresh runs inside the test transaction, so it sees the flushed rows
    # and is rolled back with everything else afterwards.
    await dbsession.execute(text("REFRESH MATERIALIZED VIEW mv_transaction_aggregate"))

    repo = CreditLedgerRepository(db=dbsession)
    rows_2024 = await repo.get_period_rows(organization_id=1, compliance_period=2024)
    by_id = {row.transaction_id: row for row, _version in rows_2024}

    # Recorded transfer attributed via its compliance_period column.
    assert 770001 in by_id and by_id[770001].status == "Recorded"
    # Pending transfer surfaced via the effective-date-year fallback.
    assert 770002 in by_id and by_id[770002].status == "Submitted"

    # The fallback respects the year: neither row belongs to 2023.
    rows_2023 = await repo.get_period_rows(organization_id=1, compliance_period=2023)
    ids_2023 = {row.transaction_id for row, _version in rows_2023}
    assert 770001 not in ids_2023 and 770002 not in ids_2023


@pytest.mark.anyio
async def test_get_period_assessed_balance_is_not_floored(dbsession, add_models):
    """The assessed-balance helper must return raw (possibly negative) values
    so deficits can be displayed — unlike calculate_available_balance_for_period,
    which floors at zero. Uses a 1990 period so seeded present-day transactions
    (create_date = now) fall outside the March 31, 1991 cut-off."""
    await add_models(
        [
            Transaction(
                compliance_units=-200,
                organization_id=2,
                transaction_action=TransactionActionEnum.Adjustment,
                create_date=datetime(1990, 6, 1, tzinfo=timezone.utc),
                effective_status=True,
            )
        ]
    )

    repo = CreditLedgerRepository(db=dbsession)
    # Negative comes back negative (no max(…, 0) floor).
    assert (
        await repo.get_period_assessed_balance(
            organization_id=2, compliance_period=1990
        )
        == -200
    )
    # Cut-off respected: the 1990-06 transaction is after March 31, 1990.
    assert (
        await repo.get_period_assessed_balance(
            organization_id=2, compliance_period=1989
        )
        == 0
    )
