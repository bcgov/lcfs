from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from lcfs.web.api.report_opening.repo import ReportOpeningRepository


def test_default_settings_only_close_new_historical_years(monkeypatch):
    class FixedDateTime:
        @classmethod
        def utcnow(cls):
            return SimpleNamespace(year=2026)

    monkeypatch.setattr("lcfs.web.api.report_opening.repo.datetime", FixedDateTime)
    repository = ReportOpeningRepository(db=None)

    historical_2017 = repository._build_default_record(2017)
    historical_2018 = repository._build_default_record(2018)
    out_of_scope_2016 = repository._build_default_record(2016)
    existing_range_2019 = repository._build_default_record(2019)

    assert historical_2017.compliance_reporting_enabled is False
    assert historical_2017.create_supplemental_enabled is False
    assert historical_2018.compliance_reporting_enabled is False
    assert historical_2018.create_supplemental_enabled is False
    assert out_of_scope_2016.compliance_reporting_enabled is True
    assert existing_range_2019.compliance_reporting_enabled is True


@pytest.mark.anyio
async def test_sync_uses_conflict_safe_inserts_for_missing_years(monkeypatch):
    years = [2017, 2018]
    monkeypatch.setattr(
        "lcfs.web.api.report_opening.repo.configured_years", lambda: years
    )

    existing_result = MagicMock()
    existing_result.scalars.return_value.all.return_value = []
    inserted_result = MagicMock()
    reloaded_records = [SimpleNamespace(compliance_year=year) for year in years]
    reloaded_result = MagicMock()
    reloaded_result.scalars.return_value.all.return_value = reloaded_records

    db = AsyncMock()
    db.execute.side_effect = [existing_result, inserted_result, reloaded_result]
    repository = ReportOpeningRepository(db=db)

    records = await repository.sync_configured_years()

    assert [record.compliance_year for record in records] == years
    insert_statement = db.execute.await_args_list[1].args[0]
    compiled_sql = str(insert_statement.compile(dialect=postgresql.dialect()))
    assert "ON CONFLICT (compliance_year) DO NOTHING" in compiled_sql


@pytest.mark.anyio
async def test_sync_preserves_existing_year_settings(monkeypatch):
    years = [2017, 2018]
    monkeypatch.setattr(
        "lcfs.web.api.report_opening.repo.configured_years", lambda: years
    )
    existing_records = [
        SimpleNamespace(
            compliance_year=2017,
            compliance_reporting_enabled=True,
            early_issuance_enabled=False,
            create_supplemental_enabled=True,
        ),
        SimpleNamespace(
            compliance_year=2018,
            compliance_reporting_enabled=False,
            early_issuance_enabled=False,
            create_supplemental_enabled=False,
        ),
    ]
    result = MagicMock()
    result.scalars.return_value.all.return_value = existing_records
    db = AsyncMock()
    db.execute.return_value = result
    repository = ReportOpeningRepository(db=db)

    records = await repository.sync_configured_years()

    assert records == existing_records
    assert records[0].compliance_reporting_enabled is True
    assert records[0].create_supplemental_enabled is True
    assert records[1].compliance_reporting_enabled is False
    assert records[1].create_supplemental_enabled is False
    db.execute.assert_awaited_once()
