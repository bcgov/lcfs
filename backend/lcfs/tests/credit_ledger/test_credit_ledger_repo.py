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
