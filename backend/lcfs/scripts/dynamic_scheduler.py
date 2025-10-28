#!/usr/bin/env python3
"""
Dynamic Task Scheduler for OpenShift CronJob

This script:
1. Connects to the database to fetch enabled tasks
2. Checks which tasks should run based on their cron schedule
3. Executes the tasks and updates their status
4. Handles errors and logging appropriately

Usage:
    python dynamic_scheduler.py [--dry-run] [--verbose]
"""

import asyncio
import argparse
from enum import Enum
import logging
import sys
import os
import traceback
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
from pathlib import Path
from zoneinfo import ZoneInfo

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Add current directory to Python path to import local tasks modules
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Add tasks directory to Python path
tasks_dir = Path(__file__).parent / "tasks"
sys.path.insert(0, str(tasks_dir))

# Ensure tasks directory exists
tasks_dir.mkdir(exist_ok=True)

try:
    from croniter import croniter
    from sqlalchemy import create_engine, select
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker

    # Import your application modules
    from lcfs.db.models.tasks import ScheduledTask, TaskExecution

    class TaskStatus(str, Enum):
        """Task execution status"""

        PENDING = "pending"
        RUNNING = "running"
        SUCCESS = "success"
        FAILURE = "failure"
        DISABLED = "disabled"

    from lcfs.settings import settings

except ImportError as e:
    print(f"Failed to import required modules: {e}")
    print("Make sure all dependencies are installed and PYTHONPATH is set correctly")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],  # Only use stdout to avoid duplicates
)
logger = logging.getLogger(__name__)


class DynamicTaskScheduler:
    """
    Dynamic task scheduler that loads configuration from database
    """

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.execution_start = datetime.now(timezone.utc)
        self.worker_id = self._get_worker_id()
        self.app_version = os.getenv("APP_VERSION", "unknown")

        # Initialize async database engine and session factory
        self.engine = create_async_engine(str(settings.db_url))
        self.session = sessionmaker(bind=self.engine, class_=AsyncSession)

        logger.info(f"Initializing Dynamic Task Scheduler")
        logger.info(f"Worker ID: {self.worker_id}")
        logger.info(f"App Version: {self.app_version}")
        logger.info(f"Dry Run: {self.dry_run}")

    def _get_worker_id(self) -> str:
        """Get unique identifier for this worker instance"""
        # In OpenShift, you can use pod name
        pod_name = os.getenv("HOSTNAME", "unknown-pod")
        return f"{pod_name}-{self.execution_start.strftime('%Y%m%d%H%M%S')}"

    def _get_task_timezone(self, task: ScheduledTask) -> ZoneInfo:
        """Resolve a task's configured timezone with UTC as a fallback."""
        tz_name = getattr(task, "timezone", None) or "UTC"
        try:
            return ZoneInfo(tz_name)
        except Exception:
            logger.warning(
                f"Task '{task.name}' has invalid timezone '{tz_name}', using UTC instead"
            )
            return timezone.utc

    async def get_enabled_tasks(self) -> List[ScheduledTask]:
        """
        Fetch all enabled tasks from database
        """
        try:
            async with self.session() as session:
                # Query enabled tasks
                result = await session.execute(
                    select(ScheduledTask).where(ScheduledTask.is_enabled == True)
                )
                tasks = result.scalars().all()

                logger.info(f"Found {len(tasks)} enabled tasks in database")
                return list(tasks)

        except Exception as e:
            logger.error(f"Failed to fetch tasks from database: {e}")
            logger.error(traceback.format_exc())
            return []

    def should_execute_task(self, task: ScheduledTask, current_time: datetime) -> bool:
        """
        Determine if a task should be executed based on its schedule
        """
        try:
            task_timezone = self._get_task_timezone(task)

            # Normalize current time to the task's timezone for safe comparisons
            if current_time.tzinfo is None:
                current_time = current_time.replace(tzinfo=task_timezone)
            else:
                current_time = current_time.astimezone(task_timezone)

            # Validate cron expression
            if not croniter.is_valid(task.schedule):
                logger.warning(
                    f"Invalid cron schedule for task '{task.name}': {task.schedule}"
                )
                return False

            # Create croniter instance with task timezone
            cron = croniter(task.schedule, current_time)

            # Get the most recent scheduled time before now
            last_scheduled = cron.get_prev(datetime)
            if last_scheduled.tzinfo is None:
                last_scheduled = last_scheduled.replace(tzinfo=task_timezone)
            else:
                last_scheduled = last_scheduled.astimezone(task_timezone)

            logger.debug(
                f"Task '{task.name}': last_scheduled={last_scheduled}, last_run={task.last_run}"
            )

            # If task has never run
            if task.last_run is None:
                # Check if we're within reasonable window to avoid executing very old schedules
                max_lookback = timedelta(
                    hours=1
                )  # Don't execute tasks scheduled more than 1 hour ago
                if (current_time - last_scheduled) <= max_lookback:
                    logger.info(
                        f"Task '{task.name}' has never run and is within execution window"
                    )
                    return True
                else:
                    logger.info(
                        f"Task '{task.name}' has never run but is outside execution window"
                    )
                    return False

            # Execute if the last scheduled time is after the last execution
            last_run = (
                task.last_run
                if task.last_run.tzinfo is not None
                else task.last_run.replace(tzinfo=task_timezone)
            )
            last_run = last_run.astimezone(task_timezone)

            should_run = last_scheduled > last_run

            if should_run:
                logger.info(
                    f"Task '{task.name}' should run: last_scheduled={last_scheduled} > last_run={last_run}"
                )
            else:
                logger.debug(
                    f"Task '{task.name}' should not run: last_scheduled={last_scheduled} <= last_run={last_run}"
                )

            return should_run

        except Exception as e:
            logger.error(f"Error checking schedule for task '{task.name}': {e}")
            return False

    async def get_task_function(self, task_function_name: str):
        """
        Get task function from modular task structure or dynamically import.

        Supports multiple formats:
        - "tasks.fuel_code_expiry.notify_expiring_fuel_code" (full module path)
        - "fuel_code_expiry.notify_expiring_fuel_code" (auto-prepends 'tasks.')
        - "notify_expiring_fuel_code" (searches in common task modules)
        """
        try:
            # Parse the task function name
            if "." in task_function_name:
                parts = task_function_name.split(".")
                if len(parts) >= 2:
                    if parts[0] == "tasks":
                        # Full path: tasks.module.function
                        module_name = ".".join(parts[:-1])
                        function_name = parts[-1]
                    else:
                        # Partial path: module.function -> tasks.module.function
                        module_name = f"tasks.{'.'.join(parts[:-1])}"
                        function_name = parts[-1]
                else:
                    # Single dot case: assume it's module.function
                    module_name = f"tasks.{parts[0]}"
                    function_name = parts[1] if len(parts) > 1 else parts[0]
            else:
                # No dots: just function name, search in common modules
                function_name = task_function_name
                module_name = None

            # List of module paths to try
            module_candidates = []

            if module_name:
                # If we have a specific module, try it first
                module_candidates.append(module_name)
            else:
                # Search in common task modules
                common_task_modules = [
                    "tasks.fuel_code_expiry",
                    "tasks.notification",
                    "tasks.cleanup",
                    "tasks.common",
                    "tasks",  # Legacy tasks.py
                    "lcfs.web.api.notification.tasks",  # Original path
                ]
                module_candidates.extend(common_task_modules)

            # Try to import from each candidate module
            module = None
            successful_module = None
            import_errors = []

            for candidate_module in module_candidates:
                try:
                    import importlib

                    module = importlib.import_module(candidate_module)
                    successful_module = candidate_module
                    logger.debug(f"Successfully imported module: {candidate_module}")
                    break
                except ImportError as e:
                    import_errors.append(f"{candidate_module}: {str(e)}")
                    logger.debug(f"Could not import module {candidate_module}: {e}")
                    continue

            if module is None:
                logger.error(
                    f"Could not import any module for task function '{task_function_name}'"
                )
                logger.error(f"Tried modules: {module_candidates}")
                logger.error(f"Import errors: {import_errors}")

                # Additional debugging info
                tasks_dir = Path(__file__).parent / "tasks"
                logger.error(f"Tasks directory exists: {tasks_dir.exists()}")
                if tasks_dir.exists():
                    logger.error(
                        f"Files in tasks directory: {list(tasks_dir.glob('*.py'))}"
                    )

                return None

            # Get the function from the module
            if not hasattr(module, function_name):
                logger.error(
                    f"Function '{function_name}' not found in module '{successful_module}'"
                )
                # List available functions for debugging
                available_functions = [
                    name
                    for name in dir(module)
                    if not name.startswith("_") and callable(getattr(module, name))
                ]
                logger.error(
                    f"Available functions in {successful_module}: {available_functions}"
                )
                return None

            task_function = getattr(module, function_name)

            # Verify it's a callable
            if not callable(task_function):
                logger.error(f"'{task_function_name}' is not callable")
                return None

            logger.info(
                f"Successfully imported task function: {task_function_name} from {successful_module}"
            )
            return task_function

        except Exception as e:
            logger.error(f"Failed to import task function '{task_function_name}': {e}")
            logger.error(traceback.format_exc())
            return None

    async def execute_task(self, task: ScheduledTask) -> Dict[str, Any]:
        """
        Execute a single task and return execution result
        """
        execution_start = datetime.now(timezone.utc)
        result = {
            "success": False,
            "start_time": execution_start,
            "end_time": None,
            "duration_seconds": 0,
            "result_message": "",
            "error_message": "",
        }

        try:
            # Get task function
            task_function = await self.get_task_function(task.task_function)

            if not task_function:
                result["error_message"] = (
                    f"Task function '{task.task_function}' not found"
                )
                return result

            logger.info(
                f"Executing task '{task.name}' (function: {task.task_function})"
            )

            if self.dry_run:
                logger.info(f"DRY RUN: Would execute task '{task.name}'")
                result["success"] = True
                result["result_message"] = "DRY RUN - Task not actually executed"
                await asyncio.sleep(0.1)  # Simulate brief execution
            else:
                # Execute the task function with database session
                async with self.session() as db_session:
                    if task.parameters:
                        # Add db_session to parameters
                        params = task.parameters.copy()
                        params["db_session"] = db_session

                        if asyncio.iscoroutinefunction(task_function):
                            await task_function(**params)
                        else:
                            # If it's not async, run it in a thread pool
                            loop = asyncio.get_event_loop()
                            await loop.run_in_executor(
                                None, lambda: task_function(**params)
                            )
                    else:
                        # Pass db_session as parameter
                        if asyncio.iscoroutinefunction(task_function):
                            success = await task_function(db_session=db_session)
                            result["success"] = success
                            result["result_message"] = (
                                f"Task '{task.name}' completed {'' if success else 'un'}successfully"
                            )
                        else:
                            # If it's not async, run it in a thread pool
                            loop = asyncio.get_event_loop()
                            await loop.run_in_executor(
                                None, lambda: task_function(db_session=db_session)
                            )
                            result["success"] = True
                            result["result_message"] = (
                                f"Task '{task.name}' completed successfully"
                            )

        except asyncio.TimeoutError:
            result["error_message"] = (
                f"Task '{task.name}' timed out after {task.timeout_seconds} seconds"
            )
            logger.error(result["error_message"])

        except Exception as e:
            result["error_message"] = f"Task '{task.name}' failed: {str(e)}"
            logger.error(result["error_message"])
            logger.error(traceback.format_exc())

        finally:
            result["end_time"] = datetime.now(timezone.utc)
            result["duration_seconds"] = int(
                (result["end_time"] - result["start_time"]).total_seconds()
            )

            if result["success"]:
                logger.info(
                    f"Task '{task.name}' completed successfully in {result['duration_seconds']} seconds"
                )
            else:
                logger.error(
                    f"Task '{task.name}' failed after {result['duration_seconds']} seconds: {result['error_message']}"
                )

        return result

    async def verify_task_update(
        self, task_id: int, expected_status: TaskStatus
    ) -> bool:
        """
        Verify that a task was properly updated in the database
        """
        try:
            async with self.session() as session:
                updated_task = await session.get(ScheduledTask, task_id)
                if updated_task:
                    logger.debug(
                        f"Task verification - ID: {task_id}, Status: {updated_task.status}, "
                        f"Last Run: {updated_task.last_run}, Next Run: {updated_task.next_run}"
                    )
                    return updated_task.status == expected_status
                else:
                    logger.error(f"Task {task_id} not found during verification")
                    return False
        except Exception as e:
            logger.error(f"Failed to verify task update: {e}")
            return False

    async def update_task_status(
        self, task: ScheduledTask, execution_result: Dict[str, Any]
    ):
        """
        Update task status and create execution record
        """
        try:
            async with self.session() as session:
                try:
                    # Get a fresh copy of the task from the current session
                    fresh_task = await session.get(ScheduledTask, task.id)
                    if not fresh_task:
                        logger.error(f"Task with ID {task.id} not found in database")
                        return

                    # Update task record
                    if execution_result["success"]:
                        fresh_task.status = TaskStatus.SUCCESS
                        fresh_task.execution_count = (
                            fresh_task.execution_count or 0
                        ) + 1
                    else:
                        fresh_task.status = TaskStatus.FAILURE
                        fresh_task.failure_count = (fresh_task.failure_count or 0) + 1

                    fresh_task.last_run = execution_result["start_time"]

                    # Calculate next run time
                    if croniter.is_valid(fresh_task.schedule):
                        task_timezone = self._get_task_timezone(fresh_task)
                        base_time = datetime.now(task_timezone)
                        cron = croniter(fresh_task.schedule, base_time)
                        next_run = cron.get_next(datetime)
                        if next_run.tzinfo is None:
                            next_run = next_run.replace(tzinfo=task_timezone)
                        fresh_task.next_run = next_run.astimezone(timezone.utc)

                    # Create execution record
                    execution = TaskExecution(
                        task_id=fresh_task.id,
                        started_at=execution_result["start_time"],
                        completed_at=execution_result["end_time"],
                        status=(
                            TaskStatus.SUCCESS
                            if execution_result["success"]
                            else TaskStatus.FAILURE
                        ),
                        result=execution_result.get("result_message")
                        or execution_result.get("error_message"),
                        execution_time_seconds=execution_result["duration_seconds"],
                        worker_id=self.worker_id,
                        version=self.app_version,
                    )

                    if not self.dry_run:
                        # Add execution record to session
                        session.add(execution)

                        # Store values before commit (while still in session context)
                        task_status = fresh_task.status
                        task_last_run = fresh_task.last_run
                        task_next_run = fresh_task.next_run
                        task_execution_count = fresh_task.execution_count
                        task_failure_count = fresh_task.failure_count

                        # Commit the changes
                        await session.commit()

                        logger.info(
                            f"✓ Updated task '{task.name}' - Status: {task_status}, "
                            f"Last Run: {task_last_run.strftime('%Y-%m-%d %H:%M:%S')}, "
                            f"Next Run: {task_next_run.strftime('%Y-%m-%d %H:%M:%S') if task_next_run else 'N/A'}"
                        )

                        # Update the original task object with the new values for reference
                        task.status = task_status
                        task.last_run = task_last_run
                        task.next_run = task_next_run
                        task.execution_count = task_execution_count
                        task.failure_count = task_failure_count

                    else:
                        # For dry run, access attributes before session context closes
                        task_status = fresh_task.status
                        task_last_run = fresh_task.last_run
                        task_next_run = fresh_task.next_run

                        logger.info(
                            f"DRY RUN: Would update task '{task.name}' - Status: {task_status}, "
                            f"Last Run: {task_last_run.strftime('%Y-%m-%d %H:%M:%S')}, "
                            f"Next Run: {task_next_run.strftime('%Y-%m-%d %H:%M:%S') if task_next_run else 'N/A'}"
                        )

                except Exception as e:
                    logger.error(f"Failed to update task '{task.name}' status: {e}")
                    logger.error(traceback.format_exc())
                    await session.rollback()
                    raise

        except Exception as e:
            logger.error(f"Database transaction failed for task '{task.name}': {e}")
            logger.error(traceback.format_exc())

    async def execute_tasks_with_timeout(self, task: ScheduledTask) -> Dict[str, Any]:
        """
        Execute task with timeout handling
        """
        timeout_seconds = task.timeout_seconds or 300  # Default 5 minutes

        try:
            result = await asyncio.wait_for(
                self.execute_task(task), timeout=timeout_seconds
            )
            return result
        except asyncio.TimeoutError:
            logger.error(
                f"Task '{task.name}' timed out after {timeout_seconds} seconds"
            )
            return {
                "success": False,
                "start_time": datetime.now(timezone.utc),
                "end_time": datetime.now(timezone.utc),
                "duration_seconds": timeout_seconds,
                "result_message": "",
                "error_message": f"Task timed out after {timeout_seconds} seconds",
            }

    async def run_scheduler_cycle(self) -> Dict[str, Any]:
        """
        Main scheduler cycle - check and execute all pending tasks
        """
        cycle_start = datetime.now(timezone.utc)
        summary = {
            "cycle_start": cycle_start,
            "tasks_checked": 0,
            "tasks_executed": 0,
            "tasks_succeeded": 0,
            "tasks_failed": 0,
            "errors": [],
        }

        # Initialize tasks_to_execute to empty list to avoid UnboundLocalError
        tasks_to_execute = []

        logger.info("=" * 60)
        logger.info(f"Starting scheduler cycle at {cycle_start}")
        logger.info("=" * 60)

        try:
            # Get all enabled tasks
            tasks = await self.get_enabled_tasks()
            summary["tasks_checked"] = len(tasks)

            if not tasks:
                logger.info("No enabled tasks found")
                return summary

            # Check which tasks should run
            current_time = datetime.now(timezone.utc)

            for task in tasks:
                if self.should_execute_task(task, current_time):
                    tasks_to_execute.append(task)

            summary["tasks_executed"] = len(tasks_to_execute)

            if not tasks_to_execute:
                logger.info("No tasks need to be executed at this time")
                return summary

            logger.info(
                f"Executing {len(tasks_to_execute)} tasks: {[t.name for t in tasks_to_execute]}"
            )

            # Execute tasks sequentially to ensure proper database updates
            for i, task in enumerate(tasks_to_execute, 1):
                try:
                    logger.info(
                        f"Executing task {i}/{len(tasks_to_execute)}: '{task.name}'"
                    )

                    # Execute task with timeout
                    execution_result = await self.execute_tasks_with_timeout(task)

                    # Update task status and commit before proceeding
                    await self.update_task_status(task, execution_result)

                    # Update summary
                    if execution_result["success"]:
                        summary["tasks_succeeded"] += 1
                        logger.info(
                            f"✓ Task {i}/{len(tasks_to_execute)} '{task.name}' completed successfully"
                        )
                    else:
                        summary["tasks_failed"] += 1
                        summary["errors"].append(
                            f"Task '{task.name}': {execution_result['error_message']}"
                        )
                        logger.error(
                            f"✗ Task {i}/{len(tasks_to_execute)} '{task.name}' failed: {execution_result['error_message']}"
                        )

                    # Add a small delay between tasks to ensure database consistency
                    if i < len(tasks_to_execute):  # Don't delay after the last task
                        await asyncio.sleep(0.1)

                except Exception as e:
                    error_msg = (
                        f"Unexpected error executing task '{task.name}': {str(e)}"
                    )
                    logger.error(error_msg)
                    logger.error(traceback.format_exc())
                    summary["tasks_failed"] += 1
                    summary["errors"].append(error_msg)

        except Exception as e:
            error_msg = f"Critical error in scheduler cycle: {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            summary["errors"].append(error_msg)

        finally:
            cycle_end = datetime.now(timezone.utc)
            cycle_duration = (cycle_end - cycle_start).total_seconds()

            logger.info("=" * 60)
            logger.info(f"Scheduler cycle completed in {cycle_duration:.2f} seconds")
            logger.info(f"Tasks checked: {summary['tasks_checked']}")
            logger.info(f"Tasks executed: {summary['tasks_executed']}")
            logger.info(f"Tasks succeeded: {summary['tasks_succeeded']}")
            logger.info(f"Tasks failed: {summary['tasks_failed']}")

            if summary["errors"]:
                logger.error("Errors encountered:")
                for error in summary["errors"]:
                    logger.error(f"  - {error}")

            # Show final status of executed tasks
            if tasks_to_execute:
                logger.info("Final task status:")
                try:
                    async with self.session() as session:
                        for task in tasks_to_execute:
                            try:
                                final_task = await session.get(ScheduledTask, task.id)
                                if final_task:
                                    logger.info(
                                        f"  - '{final_task.name}': {final_task.status}, "
                                        f"Last Run: {final_task.last_run.strftime('%Y-%m-%d %H:%M:%S') if final_task.last_run else 'Never'}, "
                                        f"Next Run: {final_task.next_run.strftime('%Y-%m-%d %H:%M:%S') if final_task.next_run else 'N/A'}"
                                    )
                            except Exception as e:
                                logger.warning(
                                    f"Could not fetch final status for task '{task.name}': {e}"
                                )
                except Exception as e:
                    logger.warning(f"Could not fetch final task status: {e}")

            logger.info("=" * 60)

        return summary

    async def cleanup(self):
        """Clean up database connections"""
        try:
            await self.engine.dispose()
            logger.info("Database engine disposed")
        except Exception as e:
            logger.error(f"Error disposing database engine: {e}")


def setup_logging(verbose: bool = False):
    """Setup logging configuration"""
    log_level = logging.DEBUG if verbose else logging.INFO

    # Update root logger level
    logging.getLogger().setLevel(log_level)

    # Set specific logger levels
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)

    if verbose:
        logger.info("Verbose logging enabled")


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Dynamic Task Scheduler")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be executed without actually running tasks",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Enable verbose logging"
    )

    args = parser.parse_args()

    # Setup logging
    setup_logging(args.verbose)

    # Create scheduler
    scheduler = DynamicTaskScheduler(dry_run=args.dry_run)

    try:
        # Run single scheduler cycle
        summary = await scheduler.run_scheduler_cycle()

        # Determine exit code based on results
        if summary["tasks_failed"] > 0:
            logger.error(
                f"Scheduler cycle completed with {summary['tasks_failed']} failed tasks"
            )
            return 1
        else:
            logger.info("Scheduler cycle completed successfully")
            return 0

    except KeyboardInterrupt:
        logger.info("Scheduler interrupted by user")
        return 0
    except Exception as e:
        logger.error(f"Scheduler failed with unexpected error: {e}")
        logger.error(traceback.format_exc())
        return 1
    finally:
        # Clean up resources
        await scheduler.cleanup()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
