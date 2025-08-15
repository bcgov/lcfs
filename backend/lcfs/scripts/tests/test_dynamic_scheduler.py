import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
import asyncio

from lcfs.scripts.dynamic_scheduler import DynamicTaskScheduler, TaskStatus
from lcfs.db.models.tasks import ScheduledTask


@pytest.fixture
def mock_settings():
    with patch("lcfs.scripts.dynamic_scheduler.settings") as mock:
        mock.db_url = "postgresql+asyncpg://test:test@localhost/test"
        yield mock


@pytest.fixture
def scheduler(mock_settings):
    with patch("lcfs.scripts.dynamic_scheduler.create_async_engine"), patch(
        "lcfs.scripts.dynamic_scheduler.sessionmaker"
    ):
        return DynamicTaskScheduler(dry_run=True)


@pytest.fixture
def mock_task():
    return ScheduledTask(
        id=1,
        name="test_task",
        task_function="test_function",
        schedule="0 * * * *",  # Every hour
        is_enabled=True,
        last_run=None,
        timeout_seconds=300,
    )


@pytest.mark.anyio
async def test_get_worker_id(scheduler):
    with patch.dict("os.environ", {"HOSTNAME": "test-pod"}):
        worker_id = scheduler._get_worker_id()
        assert "test-pod" in worker_id
        assert scheduler.execution_start.strftime("%Y%m%d%H%M%S") in worker_id


@pytest.mark.anyio
async def test_get_enabled_tasks_exception(scheduler):
    mock_session = AsyncMock()

    async def mock_execute_error(*args, **kwargs):
        raise Exception("DB Error")

    mock_session.execute = mock_execute_error
    scheduler.session = lambda: mock_session

    tasks = await scheduler.get_enabled_tasks()
    assert tasks == []


@pytest.mark.anyio
async def test_should_execute_task_invalid_cron(scheduler, mock_task):
    task = mock_task
    task.schedule = "invalid cron"

    result = scheduler.should_execute_task(task, datetime.now())
    assert result is False


@pytest.mark.anyio
async def test_should_execute_task_never_run_within_window(scheduler, mock_task):
    task = mock_task
    task.last_run = None
    current_time = datetime.now()

    with patch("lcfs.scripts.dynamic_scheduler.croniter") as mock_croniter:
        mock_croniter.is_valid.return_value = True
        mock_cron = MagicMock()
        mock_cron.get_prev.return_value = current_time - timedelta(minutes=30)
        mock_croniter.return_value = mock_cron

        result = scheduler.should_execute_task(task, current_time)
        assert result is True


@pytest.mark.anyio
async def test_should_execute_task_never_run_outside_window(scheduler, mock_task):
    task = mock_task
    task.last_run = None
    current_time = datetime.now()

    with patch("lcfs.scripts.dynamic_scheduler.croniter") as mock_croniter:
        mock_croniter.is_valid.return_value = True
        mock_cron = MagicMock()
        mock_cron.get_prev.return_value = current_time - timedelta(hours=2)
        mock_croniter.return_value = mock_cron

        result = scheduler.should_execute_task(task, current_time)
        assert result is False


@pytest.mark.anyio
async def test_should_execute_task_should_run(scheduler, mock_task):
    task = mock_task
    task.last_run = datetime.now() - timedelta(hours=2)
    current_time = datetime.now()

    with patch("lcfs.scripts.dynamic_scheduler.croniter") as mock_croniter:
        mock_croniter.is_valid.return_value = True
        mock_cron = MagicMock()
        mock_cron.get_prev.return_value = current_time - timedelta(minutes=30)
        mock_croniter.return_value = mock_cron

        result = scheduler.should_execute_task(task, current_time)
        assert result is True


@pytest.mark.anyio
async def test_get_task_function_full_path(scheduler):
    mock_function = AsyncMock()

    with patch("importlib.import_module") as mock_import:
        mock_module = MagicMock()
        mock_module.test_func = mock_function
        mock_import.return_value = mock_module

        result = await scheduler.get_task_function("tasks.module.test_func")
        assert result == mock_function


@pytest.mark.anyio
async def test_get_task_function_not_found(scheduler):
    with patch("importlib.import_module", side_effect=ImportError("Module not found")):
        result = await scheduler.get_task_function("nonexistent.function")
        assert result is None


@pytest.mark.anyio
async def test_execute_task_success(scheduler, mock_task):
    task = mock_task
    mock_function = AsyncMock(return_value=True)

    with patch.object(scheduler, "get_task_function", return_value=mock_function):
        result = await scheduler.execute_task(task)

        assert result["success"] is True
        assert "start_time" in result
        assert "end_time" in result


@pytest.mark.anyio
async def test_execute_task_function_not_found(scheduler, mock_task):
    task = mock_task

    with patch.object(scheduler, "get_task_function", return_value=None):
        result = await scheduler.execute_task(task)

        assert result["success"] is False
        assert "not found" in result["error_message"]


@pytest.mark.anyio
async def test_execute_task_dry_run(scheduler, mock_task):
    task = mock_task
    scheduler.dry_run = True
    mock_function = AsyncMock()

    with patch.object(scheduler, "get_task_function", return_value=mock_function):
        result = await scheduler.execute_task(task)

        assert result["success"] is True
        assert "DRY RUN" in result["result_message"]


@pytest.mark.anyio
async def test_execute_tasks_with_timeout_success(scheduler, mock_task):
    task = mock_task

    with patch.object(scheduler, "execute_task") as mock_execute:
        mock_execute.return_value = {"success": True}

        result = await scheduler.execute_tasks_with_timeout(task)
        assert result["success"] is True


@pytest.mark.anyio
async def test_execute_tasks_with_timeout_timeout(scheduler, mock_task):
    task = mock_task
    task.timeout_seconds = 1

    async def slow_task(task_arg):
        await asyncio.sleep(2)
        return {"success": True}

    with patch.object(scheduler, "execute_task", side_effect=slow_task):
        result = await scheduler.execute_tasks_with_timeout(task)

        assert result["success"] is False
        assert "timed out" in result["error_message"]


@pytest.mark.anyio
async def test_run_scheduler_cycle_no_tasks(scheduler):
    with patch.object(scheduler, "get_enabled_tasks", return_value=[]):
        summary = await scheduler.run_scheduler_cycle()

        assert summary["tasks_checked"] == 0
        assert summary["tasks_executed"] == 0


@pytest.mark.anyio
async def test_verify_task_update_not_found(scheduler):
    mock_session = AsyncMock()

    # Make get return an awaitable that returns None
    async def mock_get(*args, **kwargs):
        return None

    mock_session.get = mock_get
    scheduler.session = lambda: mock_session

    result = await scheduler.verify_task_update(1, TaskStatus.SUCCESS)
    assert result is False


@pytest.mark.anyio
async def test_cleanup(scheduler):
    mock_engine = AsyncMock()
    scheduler.engine = mock_engine

    await scheduler.cleanup()
    mock_engine.dispose.assert_called_once()
