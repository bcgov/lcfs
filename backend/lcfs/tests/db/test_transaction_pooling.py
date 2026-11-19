"""
Scheduled maintenance jobs and the audit username under transaction pooling.

The deployed backend reaches PostgreSQL through PgBouncer in transaction pooling
mode: each transaction may run on a different server connection, and anything
left on a server connection at commit is inherited by the next client. These
tests run every check straight against PostgreSQL and, when
``LCFS_TEST_PGBOUNCER_PORT`` names a PgBouncer in transaction mode in front of
the same PostgreSQL, through PgBouncer as well (see the wiki page "Database
Query Timeouts and Connection Monitoring" for the local setup).
"""

import asyncio
import os
from types import SimpleNamespace

import pytest
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from lcfs.db.dependencies import set_user_context
from lcfs.db.engine_config import build_connect_args, register_statement_timeout
from lcfs.services.jobs import jobs
from lcfs.settings import settings

pytestmark = pytest.mark.anyio

PGBOUNCER_HOST = os.getenv("LCFS_TEST_PGBOUNCER_HOST", "localhost")
PGBOUNCER_PORT = os.getenv("LCFS_TEST_PGBOUNCER_PORT")
SIMULATED_PODS = 3

CURRENT_USERNAME = sa.text("SELECT current_setting('app.username', true)")
TOUCH_COMPLIANCE_PERIOD = sa.text("""
    UPDATE compliance_period
    SET display_order = display_order
    WHERE compliance_period_id = (SELECT min(compliance_period_id) FROM compliance_period)
    """)
FSE_ADVISORY_LOCKS_HELD = sa.text("""
    SELECT count(*)
    FROM pg_locks
    WHERE locktype = 'advisory'
      AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND classid = 0
      AND objid = :lock_id
    """)


@pytest.fixture(params=["postgres", "pgbouncer"])
async def db_url(request, _engine):
    """The test database, directly or through PgBouncer when one is configured."""
    if request.param == "pgbouncer":
        if not PGBOUNCER_PORT:
            pytest.skip("set LCFS_TEST_PGBOUNCER_PORT to run through PgBouncer")
        return settings.db_test_url.with_host(PGBOUNCER_HOST).with_port(
            int(PGBOUNCER_PORT)
        )
    return settings.db_test_url


def _app_engine(url, statement_timeout_ms=0, **kwargs):
    """An engine configured like the deployed ones (lifetime.py)."""
    kwargs.setdefault("poolclass", NullPool)
    engine = create_async_engine(str(url), connect_args=build_connect_args(), **kwargs)
    register_statement_timeout(engine.sync_engine, statement_timeout_ms)
    return engine


class _Pods:
    """Several backend pods, each with its own engine, as the scheduler sees them."""

    def __init__(self, url, count=SIMULATED_PODS, **engine_kwargs):
        self.engines = [_app_engine(url, **engine_kwargs) for _ in range(count)]
        self.apps = [
            SimpleNamespace(state=SimpleNamespace(db_engine=engine))
            for engine in self.engines
        ]

    async def run(self, job):
        return await asyncio.gather(*(job(app) for app in self.apps))

    async def dispose(self):
        for engine in self.engines:
            await engine.dispose()


async def _request_traffic(url, stop: asyncio.Event, leaks: list):
    """Request-like transactions, with and without a user, while jobs run."""
    engine = _app_engine(url)
    try:
        i = 0
        while not stop.is_set():
            i += 1
            async with AsyncSession(engine) as session:
                async with session.begin():
                    await set_user_context(session, f"pooling-traffic-{i}")
            async with engine.begin() as conn:
                value = await conn.scalar(CURRENT_USERNAME)
                if value:
                    leaks.append(value)
            await asyncio.sleep(0)
    finally:
        await engine.dispose()


async def _mark_fse_reporting_dirty(engine) -> int:
    async with engine.begin() as conn:
        return await conn.scalar(sa.text("""
                UPDATE fse_reporting_mv_refresh_state
                SET dirty_generation = GREATEST(dirty_generation, refreshed_generation) + 1
                WHERE id = 1
                RETURNING dirty_generation
                """))


async def _fse_advisory_locks_held(engine) -> int:
    async with engine.connect() as conn:
        return await conn.scalar(
            FSE_ADVISORY_LOCKS_HELD,
            {"lock_id": jobs.FSE_REPORTING_MV_REFRESH_LOCK_ID},
        )


class TestFseReportingRefresh:
    async def test_one_pod_refreshes_per_run_and_no_lock_remains(self, db_url, _engine):
        pods = _Pods(db_url)
        stop, leaks = asyncio.Event(), []
        traffic = asyncio.create_task(_request_traffic(db_url, stop, leaks))
        try:
            for _ in range(10):
                generation = await _mark_fse_reporting_dirty(_engine)

                results = await pods.run(jobs.refresh_fse_reporting_materialized_views)

                assert results.count(True) == 1, results
                assert await _fse_advisory_locks_held(_engine) == 0
                async with _engine.connect() as conn:
                    refreshed = await conn.scalar(
                        sa.text(
                            "SELECT refreshed_generation FROM fse_reporting_mv_refresh_state WHERE id = 1"
                        )
                    )
                assert refreshed == generation
        finally:
            stop.set()
            await traffic
            await pods.dispose()
        assert leaks == []

    async def test_skips_while_another_transaction_holds_the_lock(
        self, db_url, _engine
    ):
        await _mark_fse_reporting_dirty(_engine)
        app = SimpleNamespace(state=SimpleNamespace(db_engine=_app_engine(db_url)))
        try:
            async with _engine.connect() as holder:
                await holder.execute(
                    sa.text("SELECT pg_advisory_xact_lock(:lock_id)"),
                    {"lock_id": jobs.FSE_REPORTING_MV_REFRESH_LOCK_ID},
                )
                assert await jobs.refresh_fse_reporting_materialized_views(app) is False
                await holder.rollback()

            # The holder's transaction ended, so its lock went with it.
            assert await jobs.refresh_fse_reporting_materialized_views(app) is True
        finally:
            await app.state.db_engine.dispose()

    async def test_background_statement_timeout_applies(self, db_url, _engine):
        """SET LOCAL had no effect while the job ran in AUTOCOMMIT."""
        await _mark_fse_reporting_dirty(_engine)
        engine = _app_engine(db_url, statement_timeout_ms=1)
        app = SimpleNamespace(state=SimpleNamespace(db_engine=engine))
        try:
            with pytest.raises(sa.exc.DBAPIError, match="statement timeout"):
                await jobs.refresh_fse_reporting_materialized_views(app)
        finally:
            await engine.dispose()
        assert await _fse_advisory_locks_held(_engine) == 0


@pytest.fixture
async def no_reindex_lease(_engine, monkeypatch):
    """Reindex one small table, and start and finish with no lease row."""
    monkeypatch.setattr(jobs, "COMPLIANCE_REINDEX_TABLES", ("compliance_period",))
    delete = sa.text("DELETE FROM scheduled_job_lease WHERE job_name = :job_name")
    params = {"job_name": jobs.COMPLIANCE_REINDEX_JOB_NAME}
    async with _engine.begin() as conn:
        await conn.execute(delete, params)
    yield
    async with _engine.begin() as conn:
        await conn.execute(delete, params)


async def _reindex_lease(engine):
    async with engine.connect() as conn:
        return (
            await conn.execute(
                sa.text("""
                    SELECT holder, lease_until > now() AS held
                    FROM scheduled_job_lease
                    WHERE job_name = :job_name
                    """),
                {"job_name": jobs.COMPLIANCE_REINDEX_JOB_NAME},
            )
        ).one_or_none()


@pytest.mark.usefixtures("no_reindex_lease")
class TestComplianceReindexLease:
    async def test_exactly_one_pod_claims_the_lease(self, db_url):
        pods = _Pods(db_url, count=5)
        try:
            claims = await asyncio.gather(
                *(
                    jobs._claim_job_lease(
                        engine, jobs.COMPLIANCE_REINDEX_JOB_NAME, f"pod-{i}", 60
                    )
                    for i, engine in enumerate(pods.engines)
                )
            )
        finally:
            await pods.dispose()
        assert claims.count(True) == 1

    async def test_one_pod_reindexes_and_the_lease_is_freed(
        self, db_url, _engine, monkeypatch
    ):
        # Hold every claim until all pods have tried, so the winner cannot
        # finish and free the lease before a slower pod gets to claim.
        barrier = asyncio.Barrier(SIMULATED_PODS)
        claim = jobs._claim_job_lease

        async def claim_then_wait(*args):
            claimed = await claim(*args)
            await barrier.wait()
            return claimed

        monkeypatch.setattr(jobs, "_claim_job_lease", claim_then_wait)
        pods = _Pods(db_url)
        try:
            results = await pods.run(jobs.reindex_compliance_report_tables)
        finally:
            await pods.dispose()

        assert results.count(True) == 1
        lease = await _reindex_lease(_engine)
        assert lease is not None and lease.held is False

    async def test_skips_while_another_pod_holds_the_lease(self, db_url, _engine):
        engine = _app_engine(db_url)
        app = SimpleNamespace(state=SimpleNamespace(db_engine=engine))
        try:
            assert await jobs._claim_job_lease(
                engine, jobs.COMPLIANCE_REINDEX_JOB_NAME, "other-pod", 60
            )
            assert await jobs.reindex_compliance_report_tables(app) is False
            assert (await _reindex_lease(_engine)).holder == "other-pod"
        finally:
            await engine.dispose()

    async def test_an_expired_lease_does_not_block_the_next_run(self, db_url, _engine):
        """A pod that died mid-run leaves its lease; it expires on its own."""
        async with _engine.begin() as conn:
            await conn.execute(
                sa.text("""
                    INSERT INTO scheduled_job_lease (job_name, holder, lease_until)
                    VALUES (:job_name, 'dead-pod', now() - interval '1 second')
                    """),
                {"job_name": jobs.COMPLIANCE_REINDEX_JOB_NAME},
            )
        engine = _app_engine(db_url)
        try:
            app = SimpleNamespace(state=SimpleNamespace(db_engine=engine))
            assert await jobs.reindex_compliance_report_tables(app) is True
        finally:
            await engine.dispose()

    async def test_a_failed_run_frees_the_lease(self, db_url, _engine, monkeypatch):
        monkeypatch.setattr(
            jobs, "COMPLIANCE_REINDEX_TABLES", ("table_that_does_not_exist",)
        )
        engine = _app_engine(db_url)
        app = SimpleNamespace(state=SimpleNamespace(db_engine=engine))
        try:
            with pytest.raises(Exception, match="does not exist"):
                await jobs.reindex_compliance_report_tables(app)
            assert (await _reindex_lease(_engine)).held is False

            monkeypatch.setattr(
                jobs, "COMPLIANCE_REINDEX_TABLES", ("compliance_period",)
            )
            assert await jobs.reindex_compliance_report_tables(app) is True
        finally:
            await engine.dispose()


async def _audit_users_since(engine, audit_log_id):
    async with engine.connect() as conn:
        return (
            await conn.scalars(
                sa.text("""
                    SELECT create_user
                    FROM audit_log
                    WHERE audit_log_id > :audit_log_id
                      AND table_name = 'compliance_period'
                    ORDER BY audit_log_id
                    """),
                {"audit_log_id": audit_log_id},
            )
        ).all()


class TestAuditUsername:
    async def test_username_does_not_outlive_its_transaction(self, db_url):
        # One pooled connection, so every transaction reuses the same server
        # connection, as PgBouncer hands it from one client to the next.
        engine = _app_engine(db_url, poolclass=None, pool_size=1, max_overflow=0)
        try:
            for username in ("pooling-test-a", "pooling-test-o'brien"):
                async with AsyncSession(engine) as session:
                    async with session.begin():
                        await set_user_context(session, username)
                        assert await session.scalar(CURRENT_USERNAME) == username
                async with engine.begin() as conn:
                    assert await conn.scalar(CURRENT_USERNAME) in (None, "")
        finally:
            await engine.dispose()

    async def test_audit_trigger_records_the_username_on_each_transaction(
        self, db_url, _engine
    ):
        engine = _app_engine(db_url, poolclass=None, pool_size=1, max_overflow=0)
        async with _engine.connect() as conn:
            before = await conn.scalar(
                sa.text("SELECT coalesce(max(audit_log_id), 0) FROM audit_log")
            )
        try:
            async with AsyncSession(engine) as session:
                async with session.begin():
                    await set_user_context(session, "pooling-test-auditor")
                    await session.execute(TOUCH_COMPLIANCE_PERIOD)
                # A later transaction of the same session, as after a commit
                # inside a request.
                async with session.begin():
                    await session.execute(TOUCH_COMPLIANCE_PERIOD)
            # A transaction that never sets a user (a scheduled job, say).
            async with engine.begin() as conn:
                await conn.execute(TOUCH_COMPLIANCE_PERIOD)

            users = await _audit_users_since(_engine, before)
            assert users[:2] == ["pooling-test-auditor", "pooling-test-auditor"]
            assert len(users) == 3 and users[2] in (None, "")
        finally:
            await engine.dispose()
            async with _engine.begin() as conn:
                await conn.execute(
                    sa.text("""
                        DELETE FROM audit_log
                        WHERE audit_log_id > :audit_log_id
                          AND table_name = 'compliance_period'
                        """),
                    {"audit_log_id": before},
                )
