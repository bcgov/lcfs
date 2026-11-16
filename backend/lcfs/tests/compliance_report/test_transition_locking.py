"""PostgreSQL regression for competing report transitions."""

import asyncio
from contextlib import suppress

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from lcfs.db.models.compliance import CompliancePeriod, ComplianceReport, ComplianceReportStatus
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository


@pytest.mark.anyio
async def test_waiting_transition_refreshes_after_first_transition_commits(_engine):
    session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    report_id = None
    try:
        async with session_factory() as setup:
            period_id = await setup.scalar(select(CompliancePeriod.compliance_period_id).limit(1))
            draft_id = await setup.scalar(select(ComplianceReportStatus.compliance_report_status_id).where(
                ComplianceReportStatus.status == ComplianceReportStatusEnum.Draft
            ))
            submitted_id = await setup.scalar(select(ComplianceReportStatus.compliance_report_status_id).where(
                ComplianceReportStatus.status == ComplianceReportStatusEnum.Submitted
            ))
            report = ComplianceReport(compliance_period_id=period_id, organization_id=1, current_status_id=draft_id)
            setup.add(report)
            await setup.flush()
            report_id = report.compliance_report_id
            await setup.commit()

        async with session_factory() as first, session_factory() as second:
            first_repo = ComplianceReportRepository(db=first)
            second_repo = ComplianceReportRepository(db=second)
            stale = await second_repo.get_compliance_report_by_id(report_id)
            assert stale.current_status_id == draft_id
            await first_repo.lock_compliance_report_row(report_id)

            started = asyncio.Event()

            async def competing_transition():
                started.set()
                await second_repo.lock_compliance_report_row(report_id)
                return await second_repo.get_compliance_report_by_id(report_id, refresh=True)

            waiting = asyncio.create_task(competing_transition())
            try:
                await started.wait()
                await asyncio.sleep(0.1)
                assert not waiting.done()
                first_report = await first_repo.get_compliance_report_by_id(report_id, refresh=True)
                first_report.current_status_id = submitted_id
                await first.commit()
                refreshed = await asyncio.wait_for(waiting, timeout=5)
                assert refreshed.current_status_id == submitted_id
            finally:
                if not waiting.done():
                    waiting.cancel()
                    with suppress(asyncio.CancelledError):
                        await waiting
    finally:
        # This test creates only the report row, with no dependent history or
        # schedules. Close both transition sessions before deleting it so a
        # failed assertion cannot leave a lock held during cleanup.
        if report_id is not None:
            async with session_factory.begin() as cleanup:
                await cleanup.execute(
                    delete(ComplianceReport).where(ComplianceReport.compliance_report_id == report_id)
                )
