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
import uuid
from datetime import datetime

from sqlalchemy import select, text

from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatus,
    ComplianceReportStatusEnum,
)
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.transfer.TransferStatus import TransferStatus, TransferStatusEnum
from lcfs.web.api.credit_ledger.services import compliance_year_envelope


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


async def _envelope_rows(repo, *, compliance_period, first_assessed_year=None):
    """Call get_period_rows with the envelope the service would compute."""
    start, end = compliance_year_envelope(compliance_period, first_assessed_year)
    return await repo.get_period_rows(
        organization_id=1,
        compliance_period=compliance_period,
        envelope_start=start,
        envelope_end=end,
    )


@pytest.mark.anyio
async def test_get_period_rows_uses_april_to_march_envelope(dbsession, add_models):
    """
    A compliance year runs April 1 – March 31 (#4832), so a transfer dated in
    January–March belongs to the *previous* compliance year, and one dated in
    April starts the next.
    """
    recorded_id = await _transfer_status_id(dbsession, TransferStatusEnum.Recorded)

    await add_models(
        [
            _transfer(770101, recorded_id, datetime(2024, 6, 1)),  # mid-2024
            _transfer(770102, recorded_id, datetime(2025, 2, 15)),  # Jan–Mar tail
            _transfer(770103, recorded_id, datetime(2025, 5, 10)),  # next envelope
        ]
    )
    await dbsession.execute(text("REFRESH MATERIALIZED VIEW mv_transaction_aggregate"))

    repo = CreditLedgerRepository(db=dbsession)

    ids_2024 = {
        r.transaction_id for r, _v in await _envelope_rows(repo, compliance_period=2024)
    }
    assert 770101 in ids_2024
    # The Feb 2025 transfer closes out compliance year 2024, not 2025.
    assert 770102 in ids_2024
    assert 770103 not in ids_2024

    ids_2025 = {
        r.transaction_id for r, _v in await _envelope_rows(repo, compliance_period=2025)
    }
    assert 770103 in ids_2025
    assert 770101 not in ids_2025 and 770102 not in ids_2025


@pytest.mark.anyio
async def test_get_period_rows_first_year_envelope_opens_in_january(
    dbsession, add_models
):
    """
    The first compliance year with an assessed report also picks up January –
    March of that year (#4832): no earlier envelope exists to hold them.
    """
    recorded_id = await _transfer_status_id(dbsession, TransferStatusEnum.Recorded)
    await add_models([_transfer(770201, recorded_id, datetime(2024, 2, 20))])
    await dbsession.execute(text("REFRESH MATERIALIZED VIEW mv_transaction_aggregate"))

    repo = CreditLedgerRepository(db=dbsession)

    # Standard envelope starts April 1, so a February transfer is excluded...
    ids_standard = {
        r.transaction_id for r, _v in await _envelope_rows(repo, compliance_period=2024)
    }
    assert 770201 not in ids_standard

    # ...but is included when 2024 is the organization's first assessed year.
    ids_first = {
        r.transaction_id
        for r, _v in await _envelope_rows(
            repo, compliance_period=2024, first_assessed_year=2024
        )
    }
    assert 770201 in ids_first


@pytest.mark.anyio
async def test_get_period_rows_includes_pending_transfer_by_date(dbsession, add_models):
    """
    Pending transfers carry compliance_period 'N/A' in mv_transaction_aggregate
    until recorded. The date-based envelope picks them up without the special
    case the calendar-year query needed (#4714, #4832).
    """
    submitted_id = await _transfer_status_id(dbsession, TransferStatusEnum.Submitted)
    await add_models([_transfer(770301, submitted_id, datetime(2024, 11, 1))])
    await dbsession.execute(text("REFRESH MATERIALIZED VIEW mv_transaction_aggregate"))

    repo = CreditLedgerRepository(db=dbsession)
    by_id = {
        r.transaction_id: r
        for r, _v in await _envelope_rows(repo, compliance_period=2024)
    }
    assert 770301 in by_id and by_id[770301].status == "Submitted"


@pytest.mark.anyio
async def test_get_assessed_line_22_uses_latest_assessed_version(dbsession, add_models):
    """
    The assessed balance is Line 22 of the highest assessed version for the
    year — a later supplemental supersedes the original (#4831).
    """
    period_id = (
        await dbsession.execute(
            select(CompliancePeriod.compliance_period_id).where(
                CompliancePeriod.description == "2024"
            )
        )
    ).scalar_one()
    assessed_id = (
        await dbsession.execute(
            select(ComplianceReportStatus.compliance_report_status_id).where(
                ComplianceReportStatus.status == ComplianceReportStatusEnum.Assessed
            )
        )
    ).scalar_one()
    draft_id = (
        await dbsession.execute(
            select(ComplianceReportStatus.compliance_report_status_id).where(
                ComplianceReportStatus.status == ComplianceReportStatusEnum.Draft
            )
        )
    ).scalar_one()

    group = str(uuid.uuid4())
    await add_models(
        [
            ComplianceReport(
                compliance_report_id=880001,
                compliance_period_id=period_id,
                organization_id=1,
                current_status_id=assessed_id,
                compliance_report_group_uuid=group,
                version=0,
            ),
            ComplianceReport(
                compliance_report_id=880002,
                compliance_period_id=period_id,
                organization_id=1,
                current_status_id=assessed_id,
                compliance_report_group_uuid=group,
                version=1,
            ),
            # A newer draft must never be used as the source.
            ComplianceReport(
                compliance_report_id=880003,
                compliance_period_id=period_id,
                organization_id=1,
                current_status_id=draft_id,
                compliance_report_group_uuid=group,
                version=2,
            ),
        ]
    )
    await add_models(
        [
            ComplianceReportSummary(
                compliance_report_id=880001,
                line_22_compliance_units_issued=1000,
            ),
            ComplianceReportSummary(
                compliance_report_id=880002,
                line_22_compliance_units_issued=1750,
            ),
            ComplianceReportSummary(
                compliance_report_id=880003,
                line_22_compliance_units_issued=9999,
            ),
        ]
    )

    repo = CreditLedgerRepository(db=dbsession)
    assert (
        await repo.get_assessed_line_22(organization_id=1, compliance_period=2024)
        == 1750
    )
    # A year with no assessed report has no assessed balance at all.
    assert (
        await repo.get_assessed_line_22(organization_id=1, compliance_period=2023)
        is None
    )


@pytest.mark.anyio
async def test_get_first_assessed_year(dbsession, add_models):
    """The earliest assessed year drives the widened first envelope (#4832)."""
    repo = CreditLedgerRepository(db=dbsession)
    assert await repo.get_first_assessed_year(organization_id=1) is None

    assessed_id = (
        await dbsession.execute(
            select(ComplianceReportStatus.compliance_report_status_id).where(
                ComplianceReportStatus.status == ComplianceReportStatusEnum.Assessed
            )
        )
    ).scalar_one()
    period_ids = {
        desc: pid
        for pid, desc in (
            await dbsession.execute(
                select(
                    CompliancePeriod.compliance_period_id,
                    CompliancePeriod.description,
                ).where(CompliancePeriod.description.in_(["2023", "2024"]))
            )
        ).all()
    }

    await add_models(
        [
            ComplianceReport(
                compliance_report_id=880101,
                compliance_period_id=period_ids["2024"],
                organization_id=1,
                current_status_id=assessed_id,
                compliance_report_group_uuid=str(uuid.uuid4()),
                version=0,
            ),
            ComplianceReport(
                compliance_report_id=880102,
                compliance_period_id=period_ids["2023"],
                organization_id=1,
                current_status_id=assessed_id,
                compliance_report_group_uuid=str(uuid.uuid4()),
                version=0,
            ),
        ]
    )

    assert await repo.get_first_assessed_year(organization_id=1) == 2023
