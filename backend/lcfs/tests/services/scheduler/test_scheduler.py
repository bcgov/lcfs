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
from lcfs.services.jobs.jobs import check_overdue_supplemental_reports


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

        # Should add the job
        mock_add_job.assert_called_once()
        call_args = mock_add_job.call_args

        # Safely handle call_args
        if not call_args:
            pytest.fail("add_job was called but call_args is None")

        # Check positional args
        assert call_args[0][0] == check_overdue_supplemental_reports

        # Check keyword args - examine what's actually being passed
        if len(call_args) > 1:
            kwargs = call_args[1]
        else:
            kwargs = getattr(call_args, "kwargs", {})

        assert "id" in kwargs
        assert kwargs.get("args") == [mock_app]

        # The scheduler might be using cron trigger instead of date trigger
        # Check for either date trigger or cron-style parameters
        if "trigger" in kwargs:
            assert kwargs.get("trigger") in ["date", "cron"]
        elif "hour" in kwargs or "minute" in kwargs:
            assert isinstance(kwargs.get("hour"), (int, type(None)))
            assert isinstance(kwargs.get("minute"), (int, type(None)))

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
    """Test that the scheduler adds the startup job correctly."""
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

            # Verify the job was added
            mock_add_job.assert_called_once()
            call_args = mock_add_job.call_args

            # Safely handle call_args
            if not call_args:
                pytest.fail("add_job was called but call_args is None")

            # Verify the function is correct
            assert call_args[0][0] == check_overdue_supplemental_reports

            # Handle kwargs safely
            if len(call_args) > 1:
                kwargs = call_args[1]
            else:
                kwargs = getattr(call_args, "kwargs", {})

            # Check for job ID and args
            assert "id" in kwargs
            assert kwargs.get("args") == [mock_app]

            # Verify job configuration based on actual parameters
            if kwargs.get("trigger") == "date":
                # Date trigger - should have run_date
                run_date = kwargs.get("run_date")
                if run_date:
                    now = datetime.now(utc)
                    time_diff = abs((run_date - now).total_seconds())
                    assert time_diff < 5, "Run date should be within 5 seconds of now"
            else:
                # Cron trigger - should have time parameters
                assert (
                    "hour" in kwargs or "minute" in kwargs
                ), "Expected cron-style trigger parameters"
                if "hour" in kwargs:
                    assert isinstance(kwargs.get("hour"), (int, type(None)))
                if "minute" in kwargs:
                    assert isinstance(kwargs.get("minute"), (int, type(None)))

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

        # Verify add_job was called with correct parameters
        mock_scheduler_instance.add_job.assert_called_once()

        call_args = mock_scheduler_instance.add_job.call_args

        # Verify the function and basic parameters
        assert call_args[0][0] == check_overdue_supplemental_reports
        kwargs = call_args[1] if len(call_args) > 1 else call_args.kwargs
        assert kwargs.get("args") == [mock_app]
        assert "id" in kwargs


@pytest.mark.anyio
async def test_scheduler_job_defaults(mock_app):
    """Test that the scheduler has correct job defaults."""
    # Verify scheduler configuration
    assert scheduler._job_defaults["coalesce"] == False
    assert scheduler._job_defaults["max_instances"] == 1
    assert scheduler._job_defaults["misfire_grace_time"] == 600


@pytest.fixture(autouse=True)
def cleanup_scheduler():
    """Ensure scheduler is cleaned up before and after each test."""
    # Cleanup before test
    safe_shutdown_scheduler()
    yield
    # Cleanup after test
    safe_shutdown_scheduler()
