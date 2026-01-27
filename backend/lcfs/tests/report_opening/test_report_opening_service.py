from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from lcfs.web.api.report_opening.schema import (
    ReportOpeningUpdateRequest,
    ReportOpeningUpdateSchema,
)
from lcfs.web.api.report_opening.services import ReportOpeningService


@pytest.fixture
def mock_report_opening_repo():
    repo = AsyncMock()
    repo.sync_configured_years = AsyncMock(
        return_value=[
            SimpleNamespace(
                report_opening_id=1,
                compliance_year=2019,
                compliance_reporting_enabled=True,
                early_issuance_enabled=False,
                supplemental_report_role="BCeID",
            ),
            SimpleNamespace(
                report_opening_id=2,
                compliance_year=2020,
                compliance_reporting_enabled=False,
                early_issuance_enabled=False,
                supplemental_report_role="BCeID",
            ),
        ]
    )
    repo.upsert_year = AsyncMock()
    return repo


@pytest.mark.anyio
async def test_get_report_openings_returns_all_years(mock_report_opening_repo, monkeypatch):
    monkeypatch.setattr(
        "lcfs.web.api.report_opening.services.configured_years",
        lambda: [2019, 2020],
    )
    service = ReportOpeningService(repo=mock_report_opening_repo)

    results = await service.get_report_openings()

    assert len(results) == 2
    assert results[0].compliance_year == 2019
    mock_report_opening_repo.sync_configured_years.assert_awaited()


@pytest.mark.anyio
async def test_update_report_openings_updates_each_year(mock_report_opening_repo, monkeypatch):
    monkeypatch.setattr(
        "lcfs.web.api.report_opening.services.configured_years",
        lambda: [2019, 2020],
    )
    service = ReportOpeningService(repo=mock_report_opening_repo)
    payload = ReportOpeningUpdateRequest(
        report_openings=[
            ReportOpeningUpdateSchema(
                compliance_year=2019, compliance_reporting_enabled=False
            )
        ]
    )

    results = await service.update_report_openings(payload)

    mock_report_opening_repo.upsert_year.assert_awaited_once()
    assert any(result.compliance_year == 2019 for result in results)


@pytest.mark.anyio
async def test_update_report_openings_rejects_invalid_year(mock_report_opening_repo, monkeypatch):
    monkeypatch.setattr(
        "lcfs.web.api.report_opening.services.configured_years",
        lambda: [2019, 2020],
    )
    service = ReportOpeningService(repo=mock_report_opening_repo)
    payload = ReportOpeningUpdateRequest(
        report_openings=[
            ReportOpeningUpdateSchema(
                compliance_year=2035, compliance_reporting_enabled=True
            )
        ]
    )

    with pytest.raises(ValueError):
        await service.update_report_openings(payload)
