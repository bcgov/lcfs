from datetime import datetime, timedelta, timezone

import pytest

from lcfs.scripts import check_tzdata


@pytest.mark.parametrize(
    "convert", [check_tzdata.via_tzdata_package, check_tzdata.via_pytz]
)
def test_locked_packages_have_bc_permanent_utc_minus_7(convert):
    """
    The tzdata and pytz versions pinned in poetry.lock must put 2026-12-01 in
    Vancouver at UTC-7. zoneinfo is not tested here because it reads the
    machine's system database; the Docker build checks that one.
    """
    assert convert().isoformat(timespec="minutes") == "2026-12-01T11:00-07:00"


def _pre_2026b() -> datetime:
    return check_tzdata.PROBE.astimezone(timezone(timedelta(hours=-8)))


def test_main_fails_when_a_source_is_stale(monkeypatch, capsys):
    monkeypatch.setattr(
        check_tzdata,
        "SOURCES",
        {"current": check_tzdata.via_pytz, "old": _pre_2026b},
    )

    assert check_tzdata.main() == 1
    out, err = capsys.readouterr()
    assert "OK: current converts 2026-12-01 18:00 UTC to 2026-12-01T11:00-07:00" in out
    assert "STALE: old converts 2026-12-01 18:00 UTC to 2026-12-01T10:00-08:00" in out
    assert "in: old." in err


def test_main_passes_when_every_source_is_current(monkeypatch):
    monkeypatch.setattr(check_tzdata, "SOURCES", {"current": check_tzdata.via_pytz})

    assert check_tzdata.main() == 0
