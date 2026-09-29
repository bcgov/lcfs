"""
Time Zone Data Check

British Columbia moved to permanent UTC-7 after the 2026-03-08 spring forward.
IANA tzdb 2026b carries the rule for America/Vancouver. With older data a
runtime still falls back to UTC-8 on 2026-11-01 and converts every November to
mid-March timestamp an hour off, which moves events near midnight to the wrong
date.

The backend converts through zoneinfo, which reads the system time zone
database and falls back to the tzdata package when that is missing. pytz ships
its own copy, and pandas resolves zone names through it. This script checks all
three and exits non-zero if any of them is out of date. Both backend Dockerfiles
run it as a build step, so a stale image fails to build.

Usage:
    cd backend
    poetry run python -m lcfs.scripts.check_tzdata
"""

import sys
from datetime import datetime, timedelta, timezone
from importlib import resources
from zoneinfo import ZoneInfo

import pytz

ZONE = "America/Vancouver"
# 18:00 UTC on 2026-12-01 is 11:00 in BC under the 2026b rules and 10:00 under
# the old ones. Only November to mid-March differs, so probe a winter date.
PROBE = datetime(2026, 12, 1, 18, tzinfo=timezone.utc)
EXPECTED_OFFSET = timedelta(hours=-7)


def via_zoneinfo() -> datetime:
    """Convert the way the app does: system database first, tzdata package second."""
    return PROBE.astimezone(ZoneInfo(ZONE))


def via_tzdata_package() -> datetime:
    """Convert with the tzdata package alone, the fallback zoneinfo uses."""
    area, city = ZONE.split("/")
    with resources.files(f"tzdata.zoneinfo.{area}").joinpath(city).open("rb") as f:
        return PROBE.astimezone(ZoneInfo.from_file(f, key=ZONE))


def via_pytz() -> datetime:
    """Convert with pytz, which bundles its own copy of the database."""
    return PROBE.astimezone(pytz.timezone(ZONE))


SOURCES = {
    "zoneinfo": via_zoneinfo,
    "tzdata package": via_tzdata_package,
    "pytz": via_pytz,
}


def main() -> int:
    stale = []
    for name, convert in SOURCES.items():
        local = convert()
        ok = local.utcoffset() == EXPECTED_OFFSET
        if not ok:
            stale.append(name)
        print(
            f"{'OK' if ok else 'STALE'}: {name} converts "
            f"{PROBE:%Y-%m-%d %H:%M} UTC to {local.isoformat(timespec='minutes')}",
            flush=True,
        )

    if stale:
        print(
            f"Time zone data for {ZONE} predates IANA tzdb 2026b "
            f"(BC permanent UTC-7) in: {', '.join(stale)}.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
