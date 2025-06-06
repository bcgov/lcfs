import pytest
import uuid
from unittest.mock import AsyncMock

from lcfs.db.models.compliance import (
    CompliancePeriod,
    ComplianceReport,
    ComplianceReportStatus,
    ComplianceReportHistory,
)
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.db.models.user import UserProfile
from lcfs.web.api.base import (
    PaginationRequestSchema,
)
from lcfs.web.api.compliance_report.schema import ComplianceReportBaseSchema
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportViewSchema,
)
from lcfs.web.exception.exceptions import DatabaseException


# Fixtures
@pytest.fixture
async def users(dbsession):
    users = [
        UserProfile(user_profile_id=998, keycloak_username="user998", is_active=True),
        UserProfile(user_profile_id=999, keycloak_username="user999", is_active=True),
    ]

    dbsession.add_all(users)
    await dbsession.commit()
    for user in users:
        await dbsession.refresh(user)
    return users


@pytest.fixture
async def compliance_report_statuses(dbsession):
    statuses = [
        ComplianceReportStatus(compliance_report_status_id=997, status="Assessed"),
        ComplianceReportStatus(compliance_report_status_id=998, status="Draft"),
        ComplianceReportStatus(
            compliance_report_status_id=999, status="Recommended_by_analyst"
        ),
    ]
    dbsession.add_all(statuses)
    await dbsession.commit()
    for status in statuses:
        await dbsession.refresh(status)
    return statuses


# Tests
@pytest.mark.anyio
async def test_get_all_compliance_periods(compliance_report_repo, compliance_periods):

    periods = await compliance_report_repo.get_all_compliance_periods()
    assert (
        next(
            (
                period
                for period in periods
                if period.description == compliance_periods[0].description
            ),
            False,
        )
        == compliance_periods[0]
    )


@pytest.mark.anyio
async def test_get_compliance_period_success(
    compliance_report_repo, compliance_periods
):

    period = await compliance_report_repo.get_compliance_period(
        period=compliance_periods[0].description
    )

    assert isinstance(period, CompliancePeriod)
    assert period == compliance_periods[0]


@pytest.mark.anyio
async def test_get_compliance_period_not_found(compliance_report_repo):
    period = await compliance_report_repo.get_compliance_period(period="1000")

    assert period is None


@pytest.mark.anyio
async def test_get_compliance_report_success(
    compliance_report_repo, compliance_reports
):

    report = await compliance_report_repo.get_compliance_report_by_id(
        report_id=compliance_reports[0].compliance_report_id
    )
    assert isinstance(report, ComplianceReport)
    assert report.compliance_report_id == compliance_reports[0].compliance_report_id


@pytest.mark.anyio
async def test_get_compliance_report_not_found(compliance_report_repo):

    report = await compliance_report_repo.get_compliance_report_by_id(report_id=1000)

    assert report is None


@pytest.mark.anyio
async def test_get_compliance_report_status_by_desc_success(
    compliance_report_repo, compliance_report_statuses
):
    status = await compliance_report_repo.get_compliance_report_status_by_desc(
        status="Recommended by analyst"
    )

    assert isinstance(status, ComplianceReportStatus)
    assert status.status == compliance_report_statuses[2].status


@pytest.mark.anyio
async def test_get_compliance_report_status_by_desc_unknown_status(
    compliance_report_repo,
):

    with pytest.raises(DatabaseException):
        await compliance_report_repo.get_compliance_report_status_by_desc(
            status="Not a real status"
        )


@pytest.mark.anyio
async def test_add_compliance_report_success(
    compliance_report_repo,
    compliance_periods,
    organizations,
    compliance_report_statuses,
):

    new_report = ComplianceReport(
        compliance_period_id=compliance_periods[0].compliance_period_id,
        organization_id=organizations[0].organization_id,
        reporting_frequency=ReportingFrequency.ANNUAL,
        current_status_id=compliance_report_statuses[0].compliance_report_status_id,
        compliance_report_group_uuid=str(uuid.uuid4()),
        version=1,
    )

    report = await compliance_report_repo.create_compliance_report(report=new_report)

    assert isinstance(report, ComplianceReportBaseSchema)
    assert report.compliance_period_id == compliance_periods[0].compliance_period_id
    assert report.organization_id == organizations[0].organization_id
    assert (
        report.current_status_id
        == compliance_report_statuses[0].compliance_report_status_id
    )


@pytest.mark.anyio
async def test_add_compliance_report_exception(
    compliance_report_repo,
):

    new_report = ComplianceReport()

    with pytest.raises(DatabaseException):
        await compliance_report_repo.create_compliance_report(report=new_report)


@pytest.mark.anyio
async def test_add_compliance_report_history_success(
    compliance_report_repo,
    users,
    compliance_reports,
):

    history = await compliance_report_repo.add_compliance_report_history(
        report=compliance_reports[0], user=users[0]
    )

    assert isinstance(history, ComplianceReportHistory)
    assert history.compliance_report_id == compliance_reports[0].compliance_report_id
    assert history.user_profile_id == users[0].user_profile_id
    assert history.status_id == compliance_reports[0].current_status_id


@pytest.mark.anyio
async def test_add_compliance_report_history_exception(
    compliance_report_repo,
):
    with pytest.raises(DatabaseException):
        await compliance_report_repo.add_compliance_report_history(
            report=None, user=None
        )


@pytest.mark.anyio
async def test_get_reports_paginated_success(
    compliance_report_repo,
    compliance_reports,
):
    pagination = PaginationRequestSchema(
        page=1,
        size=10,
        sort_orders=[],
        filters=[],
    )

    reports, total_count = await compliance_report_repo.get_reports_paginated(
        pagination, UserProfile()
    )

    assert isinstance(reports, list)
    assert len(reports) > 0
    assert isinstance(reports[0], ComplianceReportViewSchema)
    assert total_count >= len(reports)


@pytest.mark.anyio
async def test_get_compliance_report_schema_by_id_success(
    compliance_report_repo,
    compliance_reports,
):

    report = await compliance_report_repo.get_compliance_report_schema_by_id(
        report_id=compliance_reports[0].compliance_report_id
    )

    assert isinstance(report, ComplianceReportBaseSchema)
    assert report.compliance_report_id == compliance_reports[0].compliance_report_id


@pytest.mark.anyio
async def test_get_compliance_report_by_id_success_is_model(
    compliance_report_repo,
    compliance_reports,
):
    report = await compliance_report_repo.get_compliance_report_by_id(
        report_id=compliance_reports[0].compliance_report_id
    )

    assert isinstance(report, ComplianceReport)
    assert report.compliance_report_id == compliance_reports[0].compliance_report_id


@pytest.mark.anyio
async def test_get_compliance_report_by_id_success_not_found(
    compliance_report_repo,
):

    report = await compliance_report_repo.get_compliance_report_by_id(report_id=1000)

    assert report is None


@pytest.mark.anyio
async def test_update_compliance_report_success(
    compliance_report_repo, compliance_reports, compliance_periods
):

    compliance_reports[0].compliance_period_id = compliance_periods[
        1
    ].compliance_period_id

    report = await compliance_report_repo.update_compliance_report(
        report=compliance_reports[0]
    )

    assert isinstance(report, ComplianceReportBaseSchema)
    assert report.compliance_period_id == compliance_periods[1].compliance_period_id


@pytest.mark.anyio
async def test_get_all_org_reported_years_success(
    compliance_report_repo, compliance_reports, compliance_periods
):
    periods = await compliance_report_repo.get_all_org_reported_years(
        organization_id=compliance_reports[0].organization_id
    )

    assert len(periods) == 1
    assert isinstance(periods[0], CompliancePeriod)
    assert periods[0] == compliance_periods[0]


@pytest.mark.anyio
async def test_get_all_org_reported_years_not_found(
    compliance_report_repo,
):
    periods = await compliance_report_repo.get_all_org_reported_years(
        organization_id=1000
    )

    assert len(periods) == 0


@pytest.mark.anyio
async def test_delete_compliance_report_success(compliance_report_repo, dbsession):
    """Test successful deletion of a compliance report"""

    compliance_report_id = 996  # Use an existing ID from compliance reports fixture

    # Mock `execute` and `flush` calls
    dbsession.execute = AsyncMock(return_value=None)
    dbsession.flush = AsyncMock(return_value=None)

    # Call the delete function
    result = await compliance_report_repo.delete_compliance_report(compliance_report_id)

    # Ensure all delete operations were executed
    assert result is True
    dbsession.execute.assert_called()  # Ensure delete commands were called
    dbsession.flush.assert_awaited_once()  # Ensure flush was called to commit changes
