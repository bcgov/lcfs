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
    fake_row = MagicMock()
    execute_result = MagicMock()
    execute_result.all.return_value = [fake_row]

    mock_session.execute.return_value = execute_result
    mock_session.scalar.return_value = 1

    rows, total = await repo.get_rows_paginated(
        offset=0,
        limit=10,
        conditions=[],
        sort_orders=[],
    )

    assert rows == [fake_row]
    assert total == 1

    mock_session.execute.assert_called_once()
    mock_session.scalar.assert_called_once()


@pytest.mark.anyio
async def test_get_rows_with_sort_and_paging(
    repo: CreditLedgerRepository, mock_session: MagicMock
):
    fake_rows = [MagicMock(), MagicMock()]
    execute_result = MagicMock()
    execute_result.all.return_value = fake_rows

    mock_session.execute.return_value = execute_result
    mock_session.scalar.return_value = 2

    sort_orders = [SortOrder(field="update_date", direction="desc")]

    rows, total = await repo.get_rows_paginated(
        offset=15,
        limit=5,
        conditions=[],
        sort_orders=sort_orders,
    )

    assert rows == fake_rows
    assert total == 2

    mock_session.execute.assert_called_once()
    mock_session.scalar.assert_called_once()


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
