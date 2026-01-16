from datetime import datetime
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor
from pytz import utc
from fastapi import FastAPI

from lcfs.services.jobs.jobs import check_overdue_supplemental_reports

# Initialize logger
logger = logging.getLogger(__name__)

# Initialize scheduler
scheduler = AsyncIOScheduler(
    jobstores={'default': MemoryJobStore()},
    executors={'default': AsyncIOExecutor()},
    job_defaults={'coalesce': False, 'max_instances': 1, 'misfire_grace_time': 600}, # 10 minutes grace time
    timezone=utc
)

def start_scheduler(app: FastAPI):
    """
    Starts the scheduler and adds the jobs.
    """
    if not scheduler.running:
        scheduler.start()
        logger.info("Scheduler started")
        # Run immediately on startup
        # scheduler.add_job(
        #     check_overdue_supplemental_reports,
        #     'date',
        #     run_date=datetime.now(utc),
        #     id="check_overdue_supplemental_reports_startup",
        #     args=[app]
        # )
        # DISABLED: Auto-submit job disabled per ticket #3752
        # Future development will implement in-app notification for overdue drafts
        # scheduler.add_job(
        #     check_overdue_supplemental_reports,
        #     'cron',
        #     hour=0,
        #     minute=8,
        #     id="check_overdue_supplemental_reports",
        #     replace_existing=True,
        #     args=[app]
        # )
        # logger.info("Added job: 'check_overdue_supplemental_reports' to run daily at midnight.")

def shutdown_scheduler():
    """
    Shuts down the scheduler.
    """
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler shut down")
