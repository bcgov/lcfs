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
import logging
import sys
import os
import traceback
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from croniter import croniter
    from sqlalchemy import create_engine, select
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker

    # Import your application modules
    from lcfs.db.dependencies import get_async_db_session
    from lcfs.web.api.task.models import ScheduledTask, TaskExecution, TaskStatus
    from lcfs.web.api.notification.tasks import TASK_REGISTRY

except ImportError as e:
    print(f"Failed to import required modules: {e}")
    print("Make sure all dependencies are installed and PYTHONPATH is set correctly")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout), logging.StreamHandler(sys.stderr)],
)
logger = logging.getLogger(__name__)


class DynamicTaskScheduler:
    """
    Dynamic task scheduler that loads configuration from database
    """

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.execution_start = datetime.now()
        self.worker_id = self._get_worker_id()
        self.app_version = os.getenv("APP_VERSION", "unknown")

        logger.info(f"Initializing Dynamic Task Scheduler")
        logger.info(f"Worker ID: {self.worker_id}")
        logger.info(f"App Version: {self.app_version}")
        logger.info(f"Dry Run: {self.dry_run}")

    def _get_worker_id(self) -> str:
        """Get unique identifier for this worker instance"""
        # In OpenShift, you can use pod name
        pod_name = os.getenv("HOSTNAME", "unknown-pod")
        return f"{pod_name}-{self.execution_start.strftime('%Y%m%d%H%M%S')}"

    async def get_enabled_tasks(self) -> List[ScheduledTask]:
        """
        Fetch all enabled tasks from database
        """
        try:
            async for db in get_async_db_session():
                # Query enabled tasks
                result = await db.execute(
                    select(ScheduledTask).where(ScheduledTask.enabled == True)
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
            should_run = last_scheduled > task.last_run

            if should_run:
                logger.info(
                    f"Task '{task.name}' should run: last_scheduled={last_scheduled} > last_run={task.last_run}"
                )
            else:
                logger.debug(
                    f"Task '{task.name}' should not run: last_scheduled={last_scheduled} <= last_run={task.last_run}"
                )

            return should_run

        except Exception as e:
            logger.error(f"Error checking schedule for task '{task.name}': {e}")
            return False

    async def get_task_function(self, task_function_name: str):
        """
        Get task function from registry or dynamically import
        """
        # First check the manual registry
        if task_function_name in TASK_REGISTRY:
            return TASK_REGISTRY[task_function_name]

        # Try to dynamically import the function
        try:
            # Assume function format is "module.function_name"
            if "." in task_function_name:
                module_name, function_name = task_function_name.rsplit(".", 1)
            else:
                # Default to notification tasks module
                module_name = "lcfs.web.api.notification.tasks"
                function_name = task_function_name

            import importlib

            module = importlib.import_module(module_name)
            task_function = getattr(module, function_name)

            # Verify it's a callable
            if not callable(task_function):
                logger.error(f"'{task_function_name}' is not callable")
                return None

            logger.info(f"Dynamically imported task function: {task_function_name}")
            return task_function

        except (ImportError, AttributeError) as e:
            logger.error(f"Failed to import task function '{task_function_name}': {e}")
            return None

    async def execute_task(self, task: ScheduledTask) -> Dict[str, Any]:
        """
        Execute a single task and return execution result
        """
        execution_start = datetime.now()
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
                # Execute the task function
                if task.parameters:
                    # If task has parameters, pass them as kwargs
                    await task_function(**task.parameters)
                else:
                    # No parameters
                    await task_function()

                result["success"] = True
                result["result_message"] = f"Task '{task.name}' completed successfully"

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
            result["end_time"] = datetime.now()
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

    async def update_task_status(
        self, task: ScheduledTask, execution_result: Dict[str, Any]
    ):
        """
        Update task status and create execution record
        """
        try:
            async for db in get_async_db_session():
                # Update task record
                if execution_result["success"]:
                    task.status = TaskStatus.SUCCESS
                    task.execution_count += 1
                else:
                    task.status = TaskStatus.FAILURE
                    task.failure_count += 1

                task.last_run = execution_result["start_time"]

                # Calculate next run time
                if croniter.is_valid(task.schedule):
                    cron = croniter(task.schedule, datetime.now())
                    task.next_run = cron.get_next(datetime)

                # Create execution record
                execution = TaskExecution(
                    task_id=task.id,
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
                    db.add(execution)
                    await db.commit()
                    logger.info(f"Updated task '{task.name}' status in database")
                else:
                    logger.info(
                        f"DRY RUN: Would update task '{task.name}' status in database"
                    )

                break  # Exit async generator

        except Exception as e:
            logger.error(f"Failed to update task '{task.name}' status: {e}")
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
                "start_time": datetime.now(),
                "end_time": datetime.now(),
                "duration_seconds": timeout_seconds,
                "result_message": "",
                "error_message": f"Task timed out after {timeout_seconds} seconds",
            }

    async def run_scheduler_cycle(self) -> Dict[str, Any]:
        """
        Main scheduler cycle - check and execute all pending tasks
        """
        cycle_start = datetime.now()
        summary = {
            "cycle_start": cycle_start,
            "tasks_checked": 0,
            "tasks_executed": 0,
            "tasks_succeeded": 0,
            "tasks_failed": 0,
            "errors": [],
        }

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
            current_time = datetime.now()
            tasks_to_execute = []

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

            # Execute tasks (could be done in parallel, but sequential is safer for database)
            for task in tasks_to_execute:
                try:
                    # Execute task with timeout
                    execution_result = await self.execute_tasks_with_timeout(task)

                    # Update task status
                    await self.update_task_status(task, execution_result)

                    # Update summary
                    if execution_result["success"]:
                        summary["tasks_succeeded"] += 1
                    else:
                        summary["tasks_failed"] += 1
                        summary["errors"].append(
                            f"Task '{task.name}': {execution_result['error_message']}"
                        )

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
            cycle_end = datetime.now()
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

            logger.info("=" * 60)

        return summary


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


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
