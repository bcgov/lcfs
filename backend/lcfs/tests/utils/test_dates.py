from datetime import date, datetime, timezone

import pytest

from lcfs.utils.dates import to_pacific_date


@pytest.mark.parametrize(
    "value, expected",
    [
        # Timezone-aware values are converted to Vancouver time first
        (datetime(2026, 4, 1, 0, 30, tzinfo=timezone.utc), date(2026, 3, 31)),
        (datetime(2026, 1, 1, 7, 59, tzinfo=timezone.utc), date(2025, 12, 31)),
        (datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc), date(2026, 1, 1)),
        # Dates and naive datetimes are already calendar dates
        (date(2026, 4, 1), date(2026, 4, 1)),
        (datetime(2026, 4, 1), date(2026, 4, 1)),
        (None, None),
    ],
)
def test_to_pacific_date(value, expected):
    assert to_pacific_date(value) == expected
