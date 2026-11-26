import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime
from pytz import utc
import time
from lcfs.services.scheduler.scheduler import (
    start_scheduler,
    shutdown_scheduler,
    scheduler,
)
from lcfs.services.jobs import jobs
from lcfs.services.jobs.jobs import (
    check_overdue_supplemental_reports,
    refresh_fse_reporting_materialized_views,
    reindex_compliance_report_tables,
)
from lcfs.settings import settings


@pytest.fixture
def mock_app():
    """Fixture to create a mock FastAPI app with a mock db_session_factory."""
    app = MagicMock()
    app.state.db_session_factory = MagicMock()
    app.state.redis_client = MagicMock()
    return app


def safe_shutdown_scheduler():
    """Safely shutdown the scheduler, ignoring event loop errors."""
    try:
        if scheduler.running:
            scheduler.shutdown(wait=True)
            timeout = 5.0
            start_time = time.time()
            while scheduler.running and (time.time() - start_time) < timeout:
                time.sleep(0.1)
    except (RuntimeError, Exception) as e:
        if "Event loop is closed" in str(e) or "cannot schedule new futures" in str(e):
            scheduler._state = 0  # STATE_STOPPED
        else:
            raise


@pytest.mark.anyio
async def test_scheduler_lifecycle(mock_app):
    """Test that the scheduler starts and shuts down correctly."""
    # Ensure scheduler is stopped before test
    safe_shutdown_scheduler()

    with patch.object(scheduler, "add_job") as mock_add_job:
        start_scheduler(mock_app)
        assert scheduler.running, "Scheduler should be running after start"

        added_job_ids = [call.kwargs["id"] for call in mock_add_job.call_args_list]
        assert "reindex_compliance_report_tables" in added_job_ids
        assert "refresh_fse_reporting_materialized_views" in added_job_ids

        safe_shutdown_scheduler()


@pytest.mark.anyio
async def test_check_overdue_supplemental_reports_job(mock_app):
    """Test the logic of the check_overdue_supplemental_reports job."""
    # Mock the session and result
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [
        MagicMock(compliance_report_id=1),
        MagicMock(compliance_report_id=2),
    ]
    mock_session.execute.return_value = mock_result

    # Make the session factory return the mock session
    mock_app.state.db_session_factory.return_value.__aenter__.return_value = (
        mock_session
    )

    with patch(
        "lcfs.services.jobs.jobs.submit_supplemental_report", new=AsyncMock()
    ) as mock_submit:
        await check_overdue_supplemental_reports(mock_app)

        # Verify that execute was called
        mock_session.execute.assert_called_once()

        # Verify that submit was called for each report
        assert mock_submit.call_count == 2
        mock_submit.assert_any_call(1, mock_app)
        mock_submit.assert_any_call(2, mock_app)


@pytest.mark.anyio
async def test_check_overdue_supplemental_reports_job_no_reports(mock_app):
    """Test the job when there are no overdue reports."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.fetchall.return_value = []  # No reports
    mock_session.execute.return_value = mock_result
    mock_app.state.db_session_factory.return_value.__aenter__.return_value = (
        mock_session
    )

    with patch(
        "lcfs.services.jobs.jobs.submit_supplemental_report", new=AsyncMock()
    ) as mock_submit:
        await check_overdue_supplemental_reports(mock_app)

        mock_session.execute.assert_called_once()
        mock_submit.assert_not_called()


@pytest.mark.anyio
async def test_check_overdue_supplemental_reports_job_single_failure(mock_app):
    """Test that the job continues if one report fails."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [
        MagicMock(compliance_report_id=1),
        MagicMock(compliance_report_id=2),
    ]
    mock_session.execute.return_value = mock_result
    mock_app.state.db_session_factory.return_value.__aenter__.return_value = (
        mock_session
    )

    with patch(
        "lcfs.services.jobs.jobs.submit_supplemental_report", new=AsyncMock()
    ) as mock_submit:
        mock_submit.side_effect = [Exception("Submission failed"), None]

        await check_overdue_supplemental_reports(mock_app)

        assert mock_submit.call_count == 2
        mock_submit.assert_any_call(1, mock_app)
        mock_submit.assert_any_call(2, mock_app)


@pytest.mark.anyio
async def test_scheduler_adds_startup_job(mock_app):
    """Test that the scheduler starts correctly (job disabled per #3752)."""
    # Ensure scheduler is stopped before test
    safe_shutdown_scheduler()

    # Mock the scheduler's start method to avoid event loop issues
    with patch.object(scheduler, "add_job") as mock_add_job, patch.object(
        scheduler, "start"
    ) as mock_start:

        # Configure the mock to simulate successful start
        mock_start.return_value = None
        scheduler._state = 1  # Set to STATE_RUNNING manually

        try:
            start_scheduler(mock_app)

            # Verify start was called
            mock_start.assert_called_once()

            added_job_ids = [
                call.kwargs["id"] for call in mock_add_job.call_args_list
            ]
            assert "reindex_compliance_report_tables" in added_job_ids
            assert "refresh_fse_reporting_materialized_views" in added_job_ids

            # # Verify the job was added
            # mock_add_job.assert_called_once()
            # call_args = mock_add_job.call_args

            # # Safely handle call_args
            # if not call_args:
            #     pytest.fail("add_job was called but call_args is None")

            # # Verify the function is correct
            # assert call_args[0][0] == check_overdue_supplemental_reports

            # # Handle kwargs safely
            # if len(call_args) > 1:
            #     kwargs = call_args[1]
            # else:
            #     kwargs = getattr(call_args, "kwargs", {})

            # # Check for job ID and args
            # assert "id" in kwargs
            # assert kwargs.get("args") == [mock_app]

            # # Verify job configuration based on actual parameters
            # if kwargs.get("trigger") == "date":
            #     # Date trigger - should have run_date
            #     run_date = kwargs.get("run_date")
            #     if run_date:
            #         now = datetime.now(utc)
            #         time_diff = abs((run_date - now).total_seconds())
            #         assert time_diff < 5, "Run date should be within 5 seconds of now"
            # else:
            #     # Cron trigger - should have time parameters
            #     assert (
            #         "hour" in kwargs or "minute" in kwargs
            #     ), "Expected cron-style trigger parameters"
            #     if "hour" in kwargs:
            #         assert isinstance(kwargs.get("hour"), (int, type(None)))
            #     if "minute" in kwargs:
            #         assert isinstance(kwargs.get("minute"), (int, type(None)))

        finally:
            # Reset scheduler state
            scheduler._state = 0  # STATE_STOPPED
            safe_shutdown_scheduler()


@pytest.mark.anyio
async def test_scheduler_startup_job_essentials(mock_app):
    """Test the essential job setup without complex scheduler lifecycle."""

    with patch(
        "lcfs.services.scheduler.scheduler.scheduler"
    ) as mock_scheduler_instance:
        # Configure mock scheduler
        mock_scheduler_instance.running = False
        mock_scheduler_instance.add_job = MagicMock()
        mock_scheduler_instance.start = MagicMock()

        # Call start_scheduler
        start_scheduler(mock_app)

        # Verify scheduler.start was called
        mock_scheduler_instance.start.assert_called_once()

        added_job_ids = [
            call.kwargs["id"]
            for call in mock_scheduler_instance.add_job.call_args_list
        ]
        assert "reindex_compliance_report_tables" in added_job_ids
        assert "refresh_fse_reporting_materialized_views" in added_job_ids

        # # Verify add_job was called with correct parameters
        # mock_scheduler_instance.add_job.assert_called_once()

        # call_args = mock_scheduler_instance.add_job.call_args

        # # Verify the function and basic parameters
        # assert call_args[0][0] == check_overdue_supplemental_reports
        # kwargs = call_args[1] if len(call_args) > 1 else call_args.kwargs
        # assert kwargs.get("args") == [mock_app]
        # assert "id" in kwargs


@pytest.mark.anyio
async def test_scheduler_adds_one_time_startup_reindex_job_when_enabled(mock_app):
    safe_shutdown_scheduler()

    original_value = settings.compliance_reindex_run_on_startup
    settings.compliance_reindex_run_on_startup = True

    with patch.object(scheduler, "add_job") as mock_add_job, patch.object(
        scheduler, "start"
    ) as mock_start:
        mock_start.return_value = None
        scheduler._state = 1

        try:
            start_scheduler(mock_app)

            added_job_ids = [call.kwargs["id"] for call in mock_add_job.call_args_list]
            assert "reindex_compliance_report_tables" in added_job_ids
            assert "reindex_compliance_report_tables_startup" in added_job_ids
            assert "refresh_fse_reporting_materialized_views" in added_job_ids
        finally:
            settings.compliance_reindex_run_on_startup = original_value
            scheduler._state = 0
            safe_shutdown_scheduler()


@pytest.mark.anyio
async def test_scheduler_adds_monthly_credit_market_report_when_enabled(mock_app):
    safe_shutdown_scheduler()

    original_value = settings.credit_market_report_enabled
    settings.credit_market_report_enabled = True

    with patch.object(scheduler, "add_job") as mock_add_job, patch.object(
        scheduler, "start"
    ) as mock_start:
        mock_start.return_value = None
        scheduler._state = 1

        try:
            start_scheduler(mock_app)

            added_job_ids = [call.kwargs["id"] for call in mock_add_job.call_args_list]
            assert "send_monthly_credit_market_report" in added_job_ids
            assert "send_monthly_credit_market_report_startup" not in added_job_ids
        finally:
            settings.credit_market_report_enabled = original_value
            scheduler._state = 0
            safe_shutdown_scheduler()


@pytest.mark.anyio
async def test_scheduler_job_defaults(mock_app):
    """Test that the scheduler has correct job defaults."""
    # Verify scheduler configuration
    assert scheduler._job_defaults["coalesce"] == False
    assert scheduler._job_defaults["max_instances"] == 1
    assert scheduler._job_defaults["misfire_grace_time"] == 600


def _fse_refresh_engine(scalar_results):
    """
    An engine whose begin() yields one connection; scalar() answers the refresh
    job in order: the advisory lock, the refresh objects check, then the
    dirty_generation reads.
    """
    conn = AsyncMock()
    conn.scalar.side_effect = scalar_results
    app = MagicMock()
    app.state.db_engine.begin.return_value.__aenter__.return_value = conn
    app.state.db_engine.begin.return_value.__aexit__.return_value = False
    return app, conn


def _fse_refresh_connection(dirty_generations):
    return _fse_refresh_engine([True, True, *dirty_generations])


def _sql(call):
    return str(call.args[0])


def _refreshed_generations(conn):
    return [
        call.args[1]["dirty_generation"]
        for call in conn.execute.call_args_list
        if len(call.args) > 1 and "dirty_generation" in call.args[1]
    ]


def _refresh_count(conn):
    return sum(
        "REFRESH MATERIALIZED VIEW CONCURRENTLY" in _sql(call)
        for call in conn.execute.call_args_list
    )


@pytest.mark.anyio
async def test_refresh_fse_reporting_mvs_skips_when_nothing_is_dirty():
    app, conn = _fse_refresh_connection([None])

    assert await refresh_fse_reporting_materialized_views(app) is False

    assert _refresh_count(conn) == 0
    app.state.db_engine.begin.return_value.__aexit__.assert_awaited_once()


@pytest.mark.anyio
async def test_refresh_fse_reporting_mvs_leaves_writes_made_during_a_refresh():
    # Generation 5 is refreshed; a save lands meanwhile (7). Only the captured
    # generation is marked refreshed, so 7 stays dirty for the next run.
    app, conn = _fse_refresh_connection([5, 7])

    assert await refresh_fse_reporting_materialized_views(app) is True

    assert _refresh_count(conn) == 1
    assert _refreshed_generations(conn) == [5]
    # The lock, the refresh objects check and one dirty_generation read.
    assert conn.scalar.await_count == 3


@pytest.mark.anyio
async def test_refresh_fse_reporting_mvs_uses_one_transaction_and_a_transaction_lock():
    """Behind PgBouncer transaction pooling a session lock and its unlock can
    land on different server connections, so the lock must end with the
    transaction and the job must not run in AUTOCOMMIT."""
    app, conn = _fse_refresh_connection([5])

    assert await refresh_fse_reporting_materialized_views(app) is True

    app.state.db_engine.begin.assert_called_once_with()
    app.state.db_engine.connect.assert_not_called()
    conn.execution_options.assert_not_called()
    assert "pg_try_advisory_xact_lock" in _sql(conn.scalar.call_args_list[0])
    statements = [_sql(call) for call in conn.execute.call_args_list]
    assert not any("pg_advisory_unlock" in sql for sql in statements)


@pytest.mark.anyio
async def test_refresh_fse_reporting_mvs_skips_when_another_run_holds_the_lock():
    app, conn = _fse_refresh_engine([False])

    assert await refresh_fse_reporting_materialized_views(app) is False

    assert _refresh_count(conn) == 0
    assert conn.scalar.await_count == 1


@pytest.mark.anyio
async def test_refresh_fse_reporting_mvs_failure_rolls_back_and_reraises():
    app, conn = _fse_refresh_connection([5])
    conn.execute.side_effect = RuntimeError("refresh failed")

    with pytest.raises(RuntimeError, match="refresh failed"):
        await refresh_fse_reporting_materialized_views(app)

    # The transaction context saw the error, so it rolls back and the
    # transaction-scoped lock goes with it.
    exc_type = app.state.db_engine.begin.return_value.__aexit__.await_args.args[0]
    assert exc_type is RuntimeError


def _reindex_app():
    driver_connection = AsyncMock()
    raw_connection = MagicMock(driver_connection=driver_connection)
    conn = AsyncMock()
    conn.get_raw_connection.return_value = raw_connection
    app = MagicMock()
    app.state.db_engine.connect.return_value.__aenter__.return_value = conn
    app.state.db_engine.connect.return_value.__aexit__.return_value = False
    return app, driver_connection


def _reindexed_tables(driver_connection):
    return [
        call.args[0].removeprefix("REINDEX TABLE CONCURRENTLY ")
        for call in driver_connection.execute.call_args_list
    ]


@pytest.mark.anyio
async def test_reindex_skips_when_another_run_holds_the_lease():
    app, driver_connection = _reindex_app()
    with (
        patch.object(jobs, "_claim_job_lease", AsyncMock(return_value=False)),
        patch.object(jobs, "_release_job_lease", AsyncMock()) as release,
    ):
        assert await reindex_compliance_report_tables(app) is False

    driver_connection.execute.assert_not_called()
    release.assert_not_called()


@pytest.mark.anyio
async def test_reindex_runs_each_table_as_a_simple_query_and_releases_the_lease():
    app, driver_connection = _reindex_app()
    with (
        patch.object(jobs, "_claim_job_lease", AsyncMock(return_value=True)),
        patch.object(jobs, "_renew_job_lease", AsyncMock(return_value=True)) as renew,
        patch.object(jobs, "_release_job_lease", AsyncMock()) as release,
    ):
        assert await reindex_compliance_report_tables(app) is True

    # Driver-level execute() with no arguments is the simple query protocol:
    # no prepared statement to lose between server connections.
    calls = driver_connection.execute.call_args_list
    assert _reindexed_tables(driver_connection) == list(jobs.COMPLIANCE_REINDEX_TABLES)
    assert all(len(call.args) == 1 for call in calls)
    assert renew.await_count == len(jobs.COMPLIANCE_REINDEX_TABLES)
    release.assert_awaited_once()


@pytest.mark.anyio
async def test_reindex_failure_releases_the_lease():
    app, driver_connection = _reindex_app()
    driver_connection.execute.side_effect = RuntimeError("reindex failed")
    with (
        patch.object(jobs, "_claim_job_lease", AsyncMock(return_value=True)),
        patch.object(jobs, "_release_job_lease", AsyncMock()) as release,
    ):
        with pytest.raises(RuntimeError, match="reindex failed"):
            await reindex_compliance_report_tables(app)

    release.assert_awaited_once()


@pytest.mark.anyio
async def test_reindex_claim_failure_is_raised_without_a_release():
    app, driver_connection = _reindex_app()
    claim_fails = AsyncMock(side_effect=RuntimeError("database unavailable"))
    with (
        patch.object(jobs, "_claim_job_lease", claim_fails),
        patch.object(jobs, "_release_job_lease", AsyncMock()) as release,
    ):
        with pytest.raises(RuntimeError, match="database unavailable"):
            await reindex_compliance_report_tables(app)

    driver_connection.execute.assert_not_called()
    release.assert_not_called()


@pytest.mark.anyio
async def test_reindex_stops_when_the_lease_is_taken_over():
    app, driver_connection = _reindex_app()
    with (
        patch.object(jobs, "_claim_job_lease", AsyncMock(return_value=True)),
        patch.object(jobs, "_renew_job_lease", AsyncMock(return_value=False)),
        patch.object(jobs, "_release_job_lease", AsyncMock()),
    ):
        assert await reindex_compliance_report_tables(app) is False

    assert _reindexed_tables(driver_connection) == [jobs.COMPLIANCE_REINDEX_TABLES[0]]


@pytest.mark.anyio
async def test_reindex_lease_release_failure_does_not_mask_the_result():
    app, _ = _reindex_app()
    release_fails = AsyncMock(side_effect=RuntimeError("db gone"))
    with (
        patch.object(jobs, "_claim_job_lease", AsyncMock(return_value=True)),
        patch.object(jobs, "_renew_job_lease", AsyncMock(return_value=True)),
        patch.object(jobs, "_release_job_lease", release_fails),
    ):
        assert await reindex_compliance_report_tables(app) is True


@pytest.fixture(autouse=True)
def cleanup_scheduler():
    """Ensure scheduler is cleaned up before and after each test."""
    # Cleanup before test
    safe_shutdown_scheduler()
    yield
    # Cleanup after test
    safe_shutdown_scheduler()
