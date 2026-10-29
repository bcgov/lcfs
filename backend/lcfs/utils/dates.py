"""Calendar dates as B.C. users see them."""

from datetime import date, datetime
from typing import Optional
from zoneinfo import ZoneInfo

PACIFIC_TZ = ZoneInfo("America/Vancouver")


def to_pacific_date(value) -> Optional[date]:
    """
    The Pacific calendar date of ``value``, for date-only display and export.

    Timezone-aware datetimes, such as the audit create_date and update_date
    columns, are converted to America/Vancouver first. Dates and naive
    datetimes are already calendar dates: effective and agreement dates are
    stored that way, and the transaction views emit recorded and approved
    dates as Pacific dates, so those are only truncated.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(PACIFIC_TZ)
        return value.date()
    if isinstance(value, date):
        return value
    return None
