import pytest
from datetime import datetime
from unittest.mock import AsyncMock

from lcfs.web.utils.transaction_windows import calculate_transaction_period_dates


@pytest.mark.anyio
async def test_transaction_window_first_report():
    repo = AsyncMock()
    repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=None)

    start, end = await calculate_transaction_period_dates(
        compliance_year=2024, organization_id=1, repo=repo, exclude_report_id=123
    )

    assert start == datetime(2024, 1, 1, 0, 0, 0)
    assert end == datetime(2025, 3, 31, 23, 59, 59)
    repo.get_assessed_compliance_report_by_period.assert_awaited_once_with(
        1, 2023, 123
    )


@pytest.mark.anyio
async def test_transaction_window_with_previous_assessed():
    repo = AsyncMock()
    repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=object())

    start, end = await calculate_transaction_period_dates(
        compliance_year=2025, organization_id=9, repo=repo, exclude_report_id=None
    )

    assert start == datetime(2025, 4, 1, 0, 0, 0)
    assert end == datetime(2026, 3, 31, 23, 59, 59)
    repo.get_assessed_compliance_report_by_period.assert_awaited_once_with(
        9, 2024, None
    )
