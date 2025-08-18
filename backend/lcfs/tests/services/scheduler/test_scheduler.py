import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime
from pytz import utc
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


@pytest.mark.asyncio
async def test_scheduler_lifecycle(mock_app):
    """Test that the scheduler starts and shuts down correctly."""
    # Ensure scheduler is stopped before test
    if scheduler.running:
        scheduler.shutdown(wait=False)

    with patch.object(scheduler, "add_job") as mock_add_job:
        start_scheduler(mock_app)
        assert scheduler.running, "Scheduler should be running after start"

        # Should add the immediate startup job
        mock_add_job.assert_called_once()
        call_args = mock_add_job.call_args
        assert call_args[0][0] == check_overdue_supplemental_reports
        assert call_args[1]["trigger"] == "date"
        assert call_args[1]["id"] == "check_overdue_supplemental_reports_startup"
        assert call_args[1]["args"] == [mock_app]

        shutdown_scheduler()
        assert not scheduler.running, "Scheduler should not be running after shutdown"


@pytest.mark.asyncio
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


@pytest.mark.asyncio
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


@pytest.mark.asyncio
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


@pytest.mark.asyncio
async def test_scheduler_adds_startup_job(mock_app):
    """Test that the scheduler adds the startup job correctly."""
    # Ensure scheduler is stopped before test
    if scheduler.running:
        scheduler.shutdown(wait=False)

    with patch.object(scheduler, "add_job") as mock_add_job:
        start_scheduler(mock_app)

        # Verify the startup job was added
        mock_add_job.assert_called_once()
        call_args = mock_add_job.call_args

        assert call_args[0][0] == check_overdue_supplemental_reports
        assert call_args[1]["trigger"] == "date"
        assert call_args[1]["id"] == "check_overdue_supplemental_reports_startup"
        assert call_args[1]["args"] == [mock_app]
        # Verify run_date is set to approximately now
        run_date = call_args[1]["run_date"]
        now = datetime.now(utc)
        time_diff = abs((run_date - now).total_seconds())
        assert time_diff < 5, "Run date should be within 5 seconds of now"

        shutdown_scheduler()


@pytest.mark.asyncio
async def test_scheduler_timezone_handling(mock_app):
    """Test that the scheduler uses the correct timezone."""
    # Ensure scheduler is stopped before test
    if scheduler.running:
        scheduler.shutdown(wait=False)

    # Test that scheduler timezone is set to UTC
    assert scheduler.timezone.zone == "UTC"

    with patch.object(scheduler, "add_job") as mock_add_job:
        start_scheduler(mock_app)

        call_args = mock_add_job.call_args
        run_date = call_args[1]["run_date"]

        # Verify the run_date has UTC timezone
        assert run_date.tzinfo == utc

        shutdown_scheduler()


@pytest.mark.asyncio
async def test_scheduler_job_defaults(mock_app):
    """Test that the scheduler has correct job defaults."""
    # Verify scheduler configuration
    assert scheduler._job_defaults["coalesce"] == False
    assert scheduler._job_defaults["max_instances"] == 1
    assert scheduler._job_defaults["misfire_grace_time"] == 600


@pytest.fixture(autouse=True)
def cleanup_scheduler():
    """Ensure scheduler is cleaned up after each test."""
    yield
    if scheduler.running:
        scheduler.shutdown(wait=False)
