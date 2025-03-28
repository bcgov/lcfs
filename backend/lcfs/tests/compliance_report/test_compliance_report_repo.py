import pytest
import uuid
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock, Mock

from lcfs.db.models.compliance import (
    CompliancePeriod,
    ComplianceReport,
    ComplianceReportStatus,
    ComplianceReportHistory,
    ComplianceReportSummary,
    FuelSupply,
)
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.db.models.fuel import (
    FuelType,
    FuelCategory,
    ExpectedUseType,
)
from lcfs.db.models.initiative_agreement import InitiativeAgreement
from lcfs.db.models.organization import Organization
from lcfs.db.models.transfer import Transfer
from lcfs.db.models.user import UserProfile
from lcfs.web.api.base import (
    PaginationRequestSchema,
)
from lcfs.web.api.compliance_report.schema import ComplianceReportBaseSchema
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportViewSchema,
    ComplianceReportSummarySchema,
)
from lcfs.web.exception.exceptions import DatabaseException


# Fixtures
@pytest.fixture
async def expected_uses(dbsession):
    expected_uses = [
        ExpectedUseType(expected_use_type_id=998, name="Heating Oil"),
        ExpectedUseType(expected_use_type_id=999, name="Other"),
    ]

    dbsession.add_all(expected_uses)
    await dbsession.commit()
    for expected_use in expected_uses:
        await dbsession.refresh(expected_use)
    return expected_uses


@pytest.fixture
async def fuel_categories(dbsession):
    fuel_categories = [
        FuelCategory(
            fuel_category_id=998, category="Gasoline", default_carbon_intensity=0
        ),
        FuelCategory(
            fuel_category_id=999, category="Diesel", default_carbon_intensity=0
        ),
    ]

    dbsession.add_all(fuel_categories)
    await dbsession.commit()
    for fuel_category in fuel_categories:
        await dbsession.refresh(fuel_category)
    return fuel_categories


@pytest.fixture
async def fuel_types(dbsession):
    fuel_types = [
        FuelType(
            fuel_type_id=996,
            fuel_type="Fossil-derived diesel",
            units="Litres",
            unrecognized=False,
            fossil_derived=True,
            other_uses_fossil_derived=True,
        ),
        FuelType(
            fuel_type_id=997,
            fuel_type="Fossil-derived gasoline",
            units="Litres",
            unrecognized=False,
            fossil_derived=True,
            other_uses_fossil_derived=True,
        ),
        FuelType(
            fuel_type_id=998,
            fuel_type="Biodiesel",
            units="Litres",
            unrecognized=False,
            fossil_derived=False,
        ),
        FuelType(
            fuel_type_id=999,
            fuel_type="Electricity",
            units="Litres",
            unrecognized=False,
            fossil_derived=False,
        ),
    ]

    dbsession.add_all(fuel_types)
    await dbsession.commit()
    for fuel_type in fuel_types:
        await dbsession.refresh(fuel_type)
    return fuel_types


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
async def organizations(dbsession):
    orgs = [
        Organization(
            organization_id=998,
            organization_code="o998",
            total_balance=0,
            reserved_balance=0,
            count_transfers_in_progress=0,
            name="org998",
        ),
        Organization(
            organization_id=999,
            organization_code="o999",
            total_balance=0,
            reserved_balance=0,
            count_transfers_in_progress=0,
            name="org999",
        ),
    ]
    dbsession.add_all(orgs)
    await dbsession.commit()
    for org in orgs:
        await dbsession.refresh(org)
    return orgs


@pytest.fixture
async def compliance_periods(dbsession):
    periods = [
        CompliancePeriod(compliance_period_id=998, description="998"),
        CompliancePeriod(compliance_period_id=999, description="999"),
    ]
    dbsession.add_all(periods)
    await dbsession.commit()
    for period in periods:
        await dbsession.refresh(period)
    return periods


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


@pytest.fixture
async def compliance_reports(
    dbsession, organizations, compliance_periods, compliance_report_statuses
):
    reports = [
        ComplianceReport(
            compliance_report_id=994,
            compliance_period_id=compliance_periods[0].compliance_period_id,
            organization_id=organizations[0].organization_id,
            nickname="test",
            reporting_frequency=ReportingFrequency.ANNUAL,
            current_status_id=compliance_report_statuses[0].compliance_report_status_id,
            compliance_report_group_uuid=str(uuid.uuid4()),
            version=1,
        ),
        ComplianceReport(
            compliance_report_id=995,
            compliance_period_id=compliance_periods[1].compliance_period_id,
            organization_id=organizations[1].organization_id,
            nickname="test",
            reporting_frequency=ReportingFrequency.ANNUAL,
            current_status_id=compliance_report_statuses[1].compliance_report_status_id,
            compliance_report_group_uuid=str(uuid.uuid4()),
            version=1,
        ),
    ]
    dbsession.add_all(reports)
    await dbsession.commit()
    for report in reports:
        await dbsession.refresh(report)
    return reports


@pytest.fixture
async def supplemental_reports(
    compliance_reports,
    dbsession,
    organizations,
    compliance_report_statuses,
    compliance_periods,
):
    reports = [
        ComplianceReport(
            compliance_report_id=996,
            compliance_period_id=compliance_periods[0].compliance_period_id,
            organization_id=organizations[0].organization_id,
            current_status_id=compliance_report_statuses[0].compliance_report_status_id,
            compliance_report_group_uuid=compliance_reports[
                0
            ].compliance_report_group_uuid,
            version=2,
            reporting_frequency=ReportingFrequency.ANNUAL,
        ),
        ComplianceReport(
            compliance_report_id=997,
            compliance_period_id=compliance_periods[0].compliance_period_id,
            organization_id=organizations[0].organization_id,
            current_status_id=compliance_report_statuses[1].compliance_report_status_id,
            compliance_report_group_uuid=compliance_reports[
                0
            ].compliance_report_group_uuid,
            version=3,
            reporting_frequency=ReportingFrequency.ANNUAL,
        ),
        ComplianceReport(
            compliance_report_id=998,
            compliance_period_id=compliance_periods[1].compliance_period_id,
            organization_id=organizations[1].organization_id,
            current_status_id=compliance_report_statuses[0].compliance_report_status_id,
            compliance_report_group_uuid=compliance_reports[
                1
            ].compliance_report_group_uuid,
            version=2,
            reporting_frequency=ReportingFrequency.ANNUAL,
        ),
        ComplianceReport(
            compliance_report_id=999,
            compliance_period_id=compliance_periods[1].compliance_period_id,
            organization_id=organizations[1].organization_id,
            current_status_id=compliance_report_statuses[1].compliance_report_status_id,
            compliance_report_group_uuid=compliance_reports[
                1
            ].compliance_report_group_uuid,
            version=3,
            reporting_frequency=ReportingFrequency.ANNUAL,
        ),
    ]
    dbsession.add_all(reports)
    await dbsession.commit()
    for report in reports:
        await dbsession.refresh(report)
    return reports


@pytest.fixture
async def compliance_report_summaries(
    dbsession, compliance_reports, supplemental_reports
):
    summaries = [
        ComplianceReportSummary(
            summary_id=996,
            compliance_report_id=compliance_reports[0].compliance_report_id,
        ),
        ComplianceReportSummary(
            summary_id=997,
            compliance_report_id=compliance_reports[1].compliance_report_id,
        ),
        ComplianceReportSummary(
            summary_id=998,
            compliance_report_id=supplemental_reports[0].compliance_report_id,
        ),
        ComplianceReportSummary(
            summary_id=999,
            compliance_report_id=supplemental_reports[1].compliance_report_id,
        ),
    ]

    dbsession.add_all(summaries)
    await dbsession.commit()
    for summary in summaries:
        await dbsession.refresh(summary)
    return summaries


date = datetime.strptime("2024-01-01", "%Y-%m-%d").date()


@pytest.fixture
async def transfers(dbsession, organizations):

    transfers = [
        Transfer(
            transfer_id=992,
            agreement_date=date,
            from_organization_id=organizations[0].organization_id,
            current_status_id=6,
            quantity=1,
        ),
        Transfer(
            transfer_id=993,
            agreement_date=date,
            from_organization_id=organizations[0].organization_id,
            current_status_id=6,
            quantity=1,
        ),
        Transfer(
            transfer_id=994,
            agreement_date=date,
            from_organization_id=organizations[1].organization_id,
            current_status_id=6,
            quantity=1,
        ),
        Transfer(
            transfer_id=995,
            agreement_date=date,
            from_organization_id=organizations[1].organization_id,
            current_status_id=6,
            quantity=1,
        ),
        Transfer(
            transfer_id=996,
            agreement_date=date,
            to_organization_id=organizations[0].organization_id,
            current_status_id=6,
            quantity=1,
        ),
        Transfer(
            transfer_id=997,
            agreement_date=date,
            to_organization_id=organizations[0].organization_id,
            current_status_id=6,
            quantity=1,
        ),
        Transfer(
            transfer_id=998,
            agreement_date=date,
            to_organization_id=organizations[1].organization_id,
            current_status_id=6,
            quantity=1,
        ),
        Transfer(
            transfer_id=999,
            agreement_date=date,
            to_organization_id=organizations[1].organization_id,
            current_status_id=6,
            quantity=1,
        ),
    ]

    dbsession.add_all(transfers)
    await dbsession.commit()
    for transfer in transfers:
        await dbsession.refresh(transfer)
    return transfers


@pytest.fixture
async def initiative_agreements(dbsession, organizations):
    initiative_agreements = [
        InitiativeAgreement(
            initiative_agreement_id=996,
            compliance_units=1,
            transaction_effective_date=date,
            to_organization_id=organizations[0].organization_id,
            current_status_id=3,
        ),
        InitiativeAgreement(
            initiative_agreement_id=997,
            compliance_units=1,
            transaction_effective_date=date,
            to_organization_id=organizations[0].organization_id,
            current_status_id=3,
        ),
        InitiativeAgreement(
            initiative_agreement_id=998,
            compliance_units=1,
            transaction_effective_date=date,
            to_organization_id=organizations[1].organization_id,
            current_status_id=3,
        ),
        InitiativeAgreement(
            initiative_agreement_id=999,
            compliance_units=1,
            transaction_effective_date=date,
            to_organization_id=organizations[1].organization_id,
            current_status_id=3,
        ),
    ]

    dbsession.add_all(initiative_agreements)
    await dbsession.commit()
    for initiative_agreement in initiative_agreements:
        await dbsession.refresh(initiative_agreement)

    return initiative_agreements


@pytest.fixture
async def fuel_supplies(dbsession, compliance_reports, fuel_categories, fuel_types):
    fuel_supplies = [
        FuelSupply(
            fuel_supply_id=996,
            compliance_report_id=compliance_reports[0].compliance_report_id,
            quantity=1,
            units="Litres",
            fuel_category_id=fuel_categories[0].fuel_category_id,
            fuel_type_id=fuel_types[0].fuel_type_id,
            provision_of_the_act_id=1,
        ),
        FuelSupply(
            fuel_supply_id=997,
            compliance_report_id=compliance_reports[0].compliance_report_id,
            quantity=1,
            units="Litres",
            fuel_category_id=fuel_categories[1].fuel_category_id,
            fuel_type_id=fuel_types[1].fuel_type_id,
            provision_of_the_act_id=1,
        ),
        FuelSupply(
            fuel_supply_id=998,
            compliance_report_id=compliance_reports[0].compliance_report_id,
            quantity=1,
            units="Litres",
            fuel_category_id=fuel_categories[0].fuel_category_id,
            fuel_type_id=fuel_types[2].fuel_type_id,
            provision_of_the_act_id=1,
        ),
        FuelSupply(
            fuel_supply_id=999,
            compliance_report_id=compliance_reports[0].compliance_report_id,
            quantity=1,
            units="Litres",
            fuel_category_id=fuel_categories[1].fuel_category_id,
            fuel_type_id=fuel_types[3].fuel_type_id,
            provision_of_the_act_id=1,
        ),
    ]

    dbsession.add_all(fuel_supplies)
    await dbsession.commit()
    for fuel_supply in fuel_supplies:
        await dbsession.refresh(fuel_supply)
    return fuel_supplies


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
        report_id=compliance_reports[0].compliance_report_id, is_model=True
    )
    assert isinstance(report, ComplianceReport)
    assert report.compliance_report_id == compliance_reports[0].compliance_report_id


@pytest.mark.anyio
async def test_get_compliance_report_not_found(compliance_report_repo):

    report = await compliance_report_repo.get_compliance_report_by_id(
        report_id=1000, is_model=True
    )

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
async def test_get_compliance_report_by_id_success_is_not_model(
    compliance_report_repo,
    compliance_reports,
):

    report = await compliance_report_repo.get_compliance_report_by_id(
        report_id=compliance_reports[0].compliance_report_id, is_model=False
    )

    assert isinstance(report, ComplianceReportBaseSchema)
    assert report.compliance_report_id == compliance_reports[0].compliance_report_id


@pytest.mark.anyio
async def test_get_compliance_report_by_id_success_is_model(
    compliance_report_repo,
    compliance_reports,
):
    report = await compliance_report_repo.get_compliance_report_by_id(
        report_id=compliance_reports[0].compliance_report_id, is_model=True
    )

    assert isinstance(report, ComplianceReport)
    assert report.compliance_report_id == compliance_reports[0].compliance_report_id


@pytest.mark.anyio
async def test_get_compliance_report_by_id_success_not_found(
    compliance_report_repo,
):

    report = await compliance_report_repo.get_compliance_report_by_id(
        report_id=1000, is_model=True
    )

    assert report is None


@pytest.mark.anyio
async def test_get_fuel_type_success(compliance_report_repo, fuel_types):

    fuel_type = await compliance_report_repo.get_fuel_type(
        fuel_type_id=fuel_types[0].fuel_type_id
    )

    assert isinstance(fuel_type, FuelType)
    assert fuel_type.fuel_type_id == fuel_types[0].fuel_type_id


@pytest.mark.anyio
async def test_get_fuel_type_not_found(compliance_report_repo):

    fuel_type = await compliance_report_repo.get_fuel_type(fuel_type_id=1000)

    assert fuel_type is None


@pytest.mark.anyio
async def test_get_fuel_category_success(compliance_report_repo, fuel_categories):

    fuel_category = await compliance_report_repo.get_fuel_category(
        fuel_category_id=fuel_categories[0].fuel_category_id
    )

    assert isinstance(fuel_category, FuelCategory)
    assert fuel_category.fuel_category_id == fuel_categories[0].fuel_category_id


@pytest.mark.anyio
async def test_get_fuel_category_not_found(compliance_report_repo):

    fuel_category = await compliance_report_repo.get_fuel_category(
        fuel_category_id=1000
    )

    assert fuel_category is None


@pytest.mark.anyio
async def test_get_expected_use_success(compliance_report_repo, expected_uses):

    expected_use = await compliance_report_repo.get_expected_use(
        expected_use_type_id=expected_uses[0].expected_use_type_id
    )

    assert isinstance(expected_use, ExpectedUseType)
    assert expected_use.expected_use_type_id == expected_uses[0].expected_use_type_id


@pytest.mark.anyio
async def test_get_expected_use_not_found(compliance_report_repo):

    expected_use = await compliance_report_repo.get_expected_use(
        expected_use_type_id=1000
    )

    assert expected_use is None


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
async def test_update_compliance_report_exception(compliance_report_repo):

    with pytest.raises(Exception):
        await compliance_report_repo.update_compliance_report(report=None)


@pytest.mark.anyio
async def test_add_compliance_report_summary_success(
    compliance_report_repo, compliance_reports
):

    summary = ComplianceReportSummary(
        compliance_report_id=compliance_reports[0].compliance_report_id,
    )

    result = await compliance_report_repo.add_compliance_report_summary(summary=summary)

    assert isinstance(result, ComplianceReportSummary)
    assert result.compliance_report_id == compliance_reports[0].compliance_report_id


@pytest.mark.anyio
async def test_add_compliance_report_summary_exception(
    compliance_report_repo,
):
    with pytest.raises(DatabaseException):
        await compliance_report_repo.add_compliance_report_summary(summary=None)


@pytest.mark.anyio
async def test_save_compliance_report_summary_success(
    compliance_report_repo,
    compliance_reports,
    compliance_report_summaries,
):
    summary_schema = ComplianceReportSummarySchema(
        compliance_report_id=compliance_reports[0].compliance_report_id,
        renewable_fuel_target_summary=[],
        low_carbon_fuel_target_summary=[],
        non_compliance_penalty_summary=[],
    )

    result = await compliance_report_repo.save_compliance_report_summary(
        summary=summary_schema
    )

    assert isinstance(result, ComplianceReportSummary)
    assert result.compliance_report_id == compliance_reports[0].compliance_report_id


@pytest.mark.anyio
async def test_save_compliance_report_summary_exception(
    compliance_report_repo,
):
    summary_schema = ComplianceReportSummarySchema(
        compliance_report_id=1000,  # Non-existent report_id
        renewable_fuel_target_summary=[],
        low_carbon_fuel_target_summary=[],
        non_compliance_penalty_summary=[],
    )

    with pytest.raises(DatabaseException):
        await compliance_report_repo.save_compliance_report_summary(
            summary=summary_schema
        )


@pytest.mark.anyio
async def test_get_summary_by_report_id_success(
    compliance_report_repo, compliance_reports, compliance_report_summaries
):

    summary = await compliance_report_repo.get_summary_by_report_id(
        report_id=compliance_reports[0].compliance_report_id
    )

    assert isinstance(summary, ComplianceReportSummary)
    assert summary.compliance_report_id == compliance_reports[0].compliance_report_id


@pytest.mark.anyio
async def test_get_summary_by_report_id_success_supplemental(
    compliance_report_repo, supplemental_reports, compliance_report_summaries
):

    summary = await compliance_report_repo.get_summary_by_report_id(
        report_id=supplemental_reports[0].compliance_report_id
    )

    assert isinstance(summary, ComplianceReportSummary)
    assert summary.compliance_report_id == supplemental_reports[0].compliance_report_id


@pytest.mark.anyio
async def test_get_summary_by_report_id_not_found(compliance_report_repo):

    summary = await compliance_report_repo.get_summary_by_report_id(report_id=1000)

    assert summary is None


@pytest.mark.anyio
async def test_get_transferred_out_compliance_units_success(
    compliance_report_repo, organizations, transfers
):

    units = await compliance_report_repo.get_transferred_out_compliance_units(
        compliance_period_start=datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
        compliance_period_end=datetime.strptime("2025-01-01", "%Y-%m-%d").date(),
        organization_id=organizations[0].organization_id,
    )

    assert units == 2


@pytest.mark.anyio
async def test_get_transferred_out_compliance_units_not_found(compliance_report_repo):

    units = await compliance_report_repo.get_transferred_out_compliance_units(
        compliance_period_start=datetime.strptime("2025-01-01", "%Y-%m-%d").date(),
        compliance_period_end=datetime.strptime("2026-01-01", "%Y-%m-%d").date(),
        organization_id=None,
    )

    assert units == 0


@pytest.mark.anyio
async def test_get_received_compliance_units_success(
    compliance_report_repo, organizations, transfers
):

    units = await compliance_report_repo.get_received_compliance_units(
        compliance_period_start=datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
        compliance_period_end=datetime.strptime("2025-01-01", "%Y-%m-%d").date(),
        organization_id=organizations[0].organization_id,
    )

    assert units == 2


@pytest.mark.anyio
async def test_get_received_compliance_units_not_found(compliance_report_repo):

    units = await compliance_report_repo.get_received_compliance_units(
        compliance_period_start=datetime.strptime("2025-01-01", "%Y-%m-%d").date(),
        compliance_period_end=datetime.strptime("2026-01-01", "%Y-%m-%d").date(),
        organization_id=None,
    )

    assert units == 0


@pytest.mark.anyio
async def test_get_issued_compliance_units_success(
    compliance_report_repo, organizations, initiative_agreements
):

    units = await compliance_report_repo.get_issued_compliance_units(
        compliance_period_start=datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
        compliance_period_end=datetime.strptime("2025-01-01", "%Y-%m-%d").date(),
        organization_id=organizations[0].organization_id,
    )

    assert units == 2


@pytest.mark.anyio
async def test_get_issued_compliance_units_not_found(compliance_report_repo):

    units = await compliance_report_repo.get_issued_compliance_units(
        compliance_period_start=datetime.strptime("2025-01-01", "%Y-%m-%d").date(),
        compliance_period_end=datetime.strptime("2026-01-01", "%Y-%m-%d").date(),
        organization_id=None,
    )

    assert units == 0


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


@pytest.mark.parametrize(
    "fossil_derived, expected",
    [
        (True, {"diesel": 1.0, "gasoline": 1.0}),
        (False, {"diesel": 1.0, "gasoline": 1.0}),
    ],
)
def test_aggregate_fuel_supplies(
    compliance_report_repo, fuel_supplies, fossil_derived, expected
):
    result = compliance_report_repo.aggregate_quantities(fuel_supplies, fossil_derived)

    assert result == expected


@pytest.mark.anyio
async def test_aggregate_other_uses(compliance_report_repo, dbsession):
    mock_result = [
        MagicMock(category="Gasoline", quantity=50.0),
        MagicMock(category="Ethanol", quantity=75.0),
    ]
    dbsession.execute = AsyncMock(return_value=mock_result)

    result = await compliance_report_repo.aggregate_other_uses_quantity(1, True)

    assert result == {"gasoline": 50.0, "ethanol": 75.0}
    dbsession.execute.assert_awaited_once()


@pytest.mark.anyio
async def test_aggregate_allocation_agreements(compliance_report_repo, dbsession):
    mock_result = [
        MagicMock(category="Biogas", quantity=25.0),
        MagicMock(category="Biodiesel", quantity=100.0),
    ]
    dbsession.execute = AsyncMock(return_value=mock_result)

    result = await compliance_report_repo.aggregate_allocation_agreements(2)

    assert result == {"biogas": 25.0, "biodiesel": 100.0}
    dbsession.execute.assert_awaited_once()


@pytest.mark.anyio
async def test_delete_compliance_report_success(compliance_report_repo, dbsession):
    """Test successful deletion of a compliance report"""

    compliance_report_id = 996  # Use an existing ID from compliance reports fixture

    # Mock `execute` and `flush` calls
    dbsession.execute = AsyncMock(return_value=None)
    dbsession.flush = AsyncMock(return_value=None)

    # Call the delete function
    result = await compliance_report_repo.delete_compliance_report(
        compliance_report_id
    )

    # Ensure all delete operations were executed
    assert result is True
    dbsession.execute.assert_called()  # Ensure delete commands were called
    dbsession.flush.assert_awaited_once()  # Ensure flush was called to commit changes
