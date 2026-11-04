from fastapi import Request


def schedule_fse_reporting_mv_refresh(request: Request) -> None:
    """
    Ask for a prompt refresh of the FSE reporting materialized view after a
    write to one of its sources (FSE rows, or a new compliance report), so the
    report page shows the rows without a reload.

    Imported here: the scheduler module loads the jobs module, which imports
    the API services and would re-enter the API modules at startup.
    """
    from lcfs.services.scheduler.scheduler import (
        schedule_fse_reporting_mv_refresh as schedule_refresh,
    )

    schedule_refresh(request.app)
