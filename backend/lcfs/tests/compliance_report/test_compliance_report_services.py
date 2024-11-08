import pytest
from unittest.mock import MagicMock, AsyncMock
from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatus
from lcfs.web.exception.exceptions import ServiceException, DataNotFoundException

# get_all_compliance_periods
@pytest.mark.anyio
async def test_get_all_compliance_periods_success(compliance_report_service, mock_repo):
    mock_periods = [
        {"compliance_period_id": 1, "description": "2024 Compliance Period"},
        {"compliance_period_id": 2, "description": "2025 Compliance Period"},
    ]
    mock_repo.get_all_compliance_periods.return_value = mock_periods

    result = await compliance_report_service.get_all_compliance_periods()

    assert len(result) == 2
    assert result[0].compliance_period_id == 1
    assert result[0].description == "2024 Compliance Period"
    mock_repo.get_all_compliance_periods.assert_called_once()


@pytest.mark.anyio
async def test_get_all_compliance_periods_unexpected_error(
    compliance_report_service, mock_repo
):
    mock_repo.get_all_compliance_periods.side_effect = Exception("Unexpected error")

    with pytest.raises(ServiceException):
        await compliance_report_service.get_all_compliance_periods()

    mock_repo.get_all_compliance_periods.assert_called_once()


# create_compliance_report
@pytest.mark.anyio
async def test_create_compliance_report_success(
    compliance_report_service,
    mock_repo,
    compliance_report_base_schema,
    compliance_report_create_schema,
):
    # Mock the compliance period
    mock_compliance_period = CompliancePeriod(
        compliance_period_id=1,
        description="2024",
    )
    mock_repo.get_compliance_period.return_value = mock_compliance_period

    # Mock the compliance report status
    mock_draft_status = ComplianceReportStatus(
        compliance_report_status_id=1, status="Draft"
    )
    mock_repo.get_compliance_report_status_by_desc.return_value = mock_draft_status

    # Mock the added compliance report
    mock_compliance_report = compliance_report_base_schema()

    mock_repo.add_compliance_report.return_value = mock_compliance_report

    result = await compliance_report_service.create_compliance_report(
        1, compliance_report_create_schema
    )

    assert result == mock_compliance_report
    mock_repo.get_compliance_period.assert_called_once_with(
        compliance_report_create_schema.compliance_period
    )
    mock_repo.get_compliance_report_status_by_desc.assert_called_once_with(
        compliance_report_create_schema.status
    )
    mock_repo.add_compliance_report.assert_called_once()


@pytest.mark.anyio
async def test_create_compliance_report_unexpected_error(
    compliance_report_service, mock_repo
):
    mock_repo.add_compliance_report.side_effect = Exception("Unexpected error occurred")

    with pytest.raises(ServiceException):
        await compliance_report_service.create_compliance_report(
            1, {"compliance_period": 1, "status": "Draft"}
        )


# get_compliance_reports_paginated
@pytest.mark.anyio
async def test_get_compliance_reports_paginated_success(
    compliance_report_service, mock_repo, compliance_report_base_schema
):
    pagination_mock = AsyncMock()
    pagination_mock.page = 1
    pagination_mock.size = 10

    mock_compliance_report = compliance_report_base_schema()

    mock_repo.get_reports_paginated.return_value = ([mock_compliance_report], 1)

    result = await compliance_report_service.get_compliance_reports_paginated(
        pagination_mock
    )

    assert result.pagination.total == 1
    assert result.reports == [mock_compliance_report]
    mock_repo.get_reports_paginated.assert_called_once()


@pytest.mark.anyio
async def test_get_compliance_reports_paginated_not_found(
    compliance_report_service, mock_repo
):
    pagination_mock = AsyncMock()
    pagination_mock.page = 1
    pagination_mock.size = 10

    mock_repo.get_reports_paginated.return_value = ([], 0)

    with pytest.raises(DataNotFoundException):
        await compliance_report_service.get_compliance_reports_paginated(
            pagination_mock
        )


@pytest.mark.anyio
async def test_get_compliance_reports_paginated_unexpected_error(
    compliance_report_service, mock_repo
):
    mock_repo.get_reports_paginated.side_effect = Exception("Unexpected error occurred")

    with pytest.raises(ServiceException):
        await compliance_report_service.get_compliance_reports_paginated(AsyncMock(), 1)


# get_compliance_report_by_id
@pytest.mark.anyio
async def test_get_compliance_report_by_id_success(
    compliance_report_service, mock_repo, compliance_report_base_schema
):
    mock_compliance_report = compliance_report_base_schema()

    compliance_report_service._mask_report_status_for_history = MagicMock(
        return_value=mock_compliance_report
    )

    mock_repo.get_compliance_report_by_id.return_value = mock_compliance_report

    result = await compliance_report_service.get_compliance_report_by_id(1)

    assert result == mock_compliance_report
    mock_repo.get_compliance_report_by_id.assert_called_once_with(1)
    compliance_report_service._mask_report_status_for_history.assert_called_once_with(
        mock_compliance_report, False
    )


@pytest.mark.anyio
async def test_get_compliance_report_by_id_not_found(
    compliance_report_service, mock_repo
):
    mock_repo.get_compliance_report_by_id.return_value = None

    with pytest.raises(DataNotFoundException):
        await compliance_report_service.get_compliance_report_by_id(999)


@pytest.mark.anyio
async def test_get_compliance_report_by_id_unexpected_error(
    compliance_report_service, mock_repo
):
    mock_repo.get_compliance_report_by_id.side_effect = Exception("Unexpected error")

    with pytest.raises(ServiceException):
        await compliance_report_service.get_compliance_report_by_id(1)


# get_all_org_reported_years
@pytest.mark.anyio
async def test_get_all_org_reported_years_success(
    compliance_report_service, mock_repo, compliance_period_schema
):

    mock_repo.get_all_org_reported_years.return_value = [compliance_period_schema]

    result = await compliance_report_service.get_all_org_reported_years(1)

    assert len(result) == 1
    assert result[0] == compliance_period_schema
    mock_repo.get_all_org_reported_years.assert_called_once_with(1)


@pytest.mark.anyio
async def test_get_all_org_reported_years_unexpected_error(
    compliance_report_service, mock_repo
):
    mock_repo.get_all_org_reported_years.side_effect = Exception(
        "Unexpected error occurred"
    )

    with pytest.raises(ServiceException):
        await compliance_report_service.get_all_org_reported_years(1)
