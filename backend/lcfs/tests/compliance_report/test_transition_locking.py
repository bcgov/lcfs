"""PostgreSQL regression for competing report transitions."""

import asyncio
from contextlib import suppress
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from lcfs.db.models.compliance import CompliancePeriod, ComplianceReport, ComplianceReportStatus, ComplianceReportHistory, ComplianceReportSummary
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import ComplianceReportUpdateSchema
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.update_service import ComplianceReportUpdateService


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


@pytest.mark.anyio
async def test_supplemental_creation_blocks_older_version_return(_engine):
    """A return begun while a newer draft is being created sees that draft."""
    session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    group = str(uuid4())
    waiting = None
    try:
        async with session_factory() as setup:
            period_id = await setup.scalar(select(CompliancePeriod.compliance_period_id).limit(1))
            statuses = dict((await setup.execute(select(
                ComplianceReportStatus.status, ComplianceReportStatus.compliance_report_status_id
            ))).all())
            older = ComplianceReport(compliance_period_id=period_id, organization_id=1,
                compliance_report_group_uuid=group, version=0, reporting_frequency=ReportingFrequency.ANNUAL,
                current_status_id=statuses[ComplianceReportStatusEnum.Recommended_by_manager])
            newer = ComplianceReport(compliance_period_id=period_id, organization_id=1,
                compliance_report_group_uuid=group, version=1, reporting_frequency=ReportingFrequency.ANNUAL,
                current_status_id=statuses[ComplianceReportStatusEnum.Submitted])
            setup.add_all([older, newer])
            await setup.flush()
            older_id, newer_id = older.compliance_report_id, newer.compliance_report_id
            await setup.commit()

        user = SimpleNamespace(role_names=[RoleEnum.GOVERNMENT, RoleEnum.ANALYST, RoleEnum.DIRECTOR],
            user_profile_id=1, keycloak_username="test_user", first_name="Test", last_name="User")
        async with session_factory() as creator, session_factory() as updater:
            creator_repo = ComplianceReportRepository(db=creator)
            updater_repo = ComplianceReportRepository(db=updater)
            service = ComplianceReportServices(request=None, repo=creator_repo,
                snapshot_services=AsyncMock(), transaction_repo=AsyncMock())
            update_service = ComplianceReportUpdateService(repo=updater_repo)

            await service.create_government_initiated_supplemental_report(newer_id, user)
            updater_pid = await updater.scalar(select(func.pg_backend_pid()))

            async def attempt_return():
                return await update_service.update_compliance_report(
                    older_id, ComplianceReportUpdateSchema(status="Return to manager"), user
                )

            waiting = asyncio.create_task(attempt_return())
            try:
                async def wait_for_group_lock():
                    while True:
                        blocked = await creator.scalar(text(
                            "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE pid = :pid "
                            "AND locktype = 'advisory' AND NOT granted)"
                        ), {"pid": updater_pid})
                        if blocked:
                            return
                        if waiting.done():
                            raise AssertionError("Return completed before acquiring the group lock")
                        await asyncio.sleep(0.01)

                await asyncio.wait_for(wait_for_group_lock(), timeout=5)
                await creator.commit()
                with pytest.raises(HTTPException) as exc:
                    await asyncio.wait_for(waiting, timeout=5)
                assert exc.value.status_code == 409
                await updater.rollback()
                persisted = await updater.get(ComplianceReport, older_id)
                assert persisted.current_status_id == statuses[ComplianceReportStatusEnum.Recommended_by_manager]
            finally:
                if not waiting.done():
                    waiting.cancel()
                    with suppress(asyncio.CancelledError):
                        await waiting
    finally:
        async with session_factory.begin() as cleanup:
            ids = select(ComplianceReport.compliance_report_id).where(
                ComplianceReport.compliance_report_group_uuid == group
            )
            await cleanup.execute(delete(ComplianceReportHistory).where(ComplianceReportHistory.compliance_report_id.in_(ids)))
            await cleanup.execute(delete(ComplianceReportSummary).where(ComplianceReportSummary.compliance_report_id.in_(ids)))
            await cleanup.execute(delete(ComplianceReport).where(ComplianceReport.compliance_report_group_uuid == group))
