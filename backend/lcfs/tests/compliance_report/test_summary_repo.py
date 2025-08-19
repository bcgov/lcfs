import pytest
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock

from lcfs.db.models.compliance import (
    CompliancePeriod,
    ComplianceReport,
    ComplianceReportStatus,
    ComplianceReportSummary,
    FuelSupply,
)
from lcfs.db.models.user import UserProfile
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.db.models.fuel import (
    FuelType,
    FuelCategory,
    ExpectedUseType,
)
from lcfs.db.models.initiative_agreement import InitiativeAgreement
from lcfs.db.models.transfer import Transfer
from lcfs.web.api.compliance_report.schema import (
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
async def test_add_compliance_report_summary_success(summary_repo, compliance_reports):

    summary = ComplianceReportSummary(
        compliance_report_id=compliance_reports[0].compliance_report_id,
    )

    result = await summary_repo.add_compliance_report_summary(summary=summary)

    assert isinstance(result, ComplianceReportSummary)
    assert result.compliance_report_id == compliance_reports[0].compliance_report_id


@pytest.mark.anyio
async def test_add_compliance_report_summary_exception(
    summary_repo,
):
    with pytest.raises(DatabaseException):
        await summary_repo.add_compliance_report_summary(summary=None)


@pytest.mark.anyio
async def test_save_compliance_report_summary_success(
    summary_repo,
    compliance_reports,
    compliance_report_summaries,
):
    summary_schema = ComplianceReportSummarySchema(
        compliance_report_id=compliance_reports[0].compliance_report_id,
        renewable_fuel_target_summary=[],
        low_carbon_fuel_target_summary=[],
        non_compliance_penalty_summary=[],
    )

    result = await summary_repo.save_compliance_report_summary(summary=summary_schema)

    assert isinstance(result, ComplianceReportSummary)
    assert result.compliance_report_id == compliance_reports[0].compliance_report_id


@pytest.mark.anyio
async def test_save_compliance_report_summary_exception(
    summary_repo,
):
    summary_schema = ComplianceReportSummarySchema(
        compliance_report_id=1000,  # Non-existent report_id
        renewable_fuel_target_summary=[],
        low_carbon_fuel_target_summary=[],
        non_compliance_penalty_summary=[],
    )

    with pytest.raises(DatabaseException):
        await summary_repo.save_compliance_report_summary(summary=summary_schema)


@pytest.mark.anyio
async def test_get_summary_by_report_id_success(
    summary_repo, compliance_reports, compliance_report_summaries
):

    summary = await summary_repo.get_summary_by_report_id(
        report_id=compliance_reports[0].compliance_report_id
    )

    assert isinstance(summary, ComplianceReportSummary)
    assert summary.compliance_report_id == compliance_reports[0].compliance_report_id


@pytest.mark.anyio
async def test_get_summary_by_report_id_success_supplemental(
    summary_repo, supplemental_reports, compliance_report_summaries
):

    summary = await summary_repo.get_summary_by_report_id(
        report_id=supplemental_reports[0].compliance_report_id
    )

    assert isinstance(summary, ComplianceReportSummary)
    assert summary.compliance_report_id == supplemental_reports[0].compliance_report_id


@pytest.mark.anyio
async def test_get_summary_by_report_id_not_found(summary_repo):

    summary = await summary_repo.get_summary_by_report_id(report_id=1000)

    assert summary is None


@pytest.mark.anyio
async def test_get_transferred_out_compliance_units_success(
    summary_repo, organizations, transfers
):

    units = await summary_repo.get_transferred_out_compliance_units(
        compliance_period_start=datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
        compliance_period_end=datetime.strptime("2025-01-01", "%Y-%m-%d").date(),
        organization_id=organizations[0].organization_id,
    )

    assert units == 2


@pytest.mark.anyio
async def test_get_transferred_out_compliance_units_not_found(summary_repo):

    units = await summary_repo.get_transferred_out_compliance_units(
        compliance_period_start=datetime.strptime("2025-01-01", "%Y-%m-%d").date(),
        compliance_period_end=datetime.strptime("2026-01-01", "%Y-%m-%d").date(),
        organization_id=None,
    )

    assert units == 0


@pytest.mark.anyio
async def test_get_received_compliance_units_success(
    summary_repo, organizations, transfers
):

    units = await summary_repo.get_received_compliance_units(
        compliance_period_start=datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
        compliance_period_end=datetime.strptime("2025-01-01", "%Y-%m-%d").date(),
        organization_id=organizations[0].organization_id,
    )

    assert units == 2


@pytest.mark.anyio
async def test_get_received_compliance_units_not_found(summary_repo):

    units = await summary_repo.get_received_compliance_units(
        compliance_period_start=datetime.strptime("2025-01-01", "%Y-%m-%d").date(),
        compliance_period_end=datetime.strptime("2026-01-01", "%Y-%m-%d").date(),
        organization_id=None,
    )

    assert units == 0


@pytest.mark.anyio
async def test_get_issued_compliance_units_success(
    summary_repo, organizations, initiative_agreements
):

    units = await summary_repo.get_issued_compliance_units(
        compliance_period_start=datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
        compliance_period_end=datetime.strptime("2025-01-01", "%Y-%m-%d").date(),
        organization_id=organizations[0].organization_id,
    )

    assert units == 2


@pytest.mark.anyio
async def test_get_issued_compliance_units_not_found(summary_repo):

    units = await summary_repo.get_issued_compliance_units(
        compliance_period_start=datetime.strptime("2025-01-01", "%Y-%m-%d").date(),
        compliance_period_end=datetime.strptime("2026-01-01", "%Y-%m-%d").date(),
        organization_id=None,
    )

    assert units == 0


@pytest.mark.parametrize(
    "fossil_derived, expected",
    [
        (True, {"diesel": 1.0, "gasoline": 1.0}),
        (False, {"diesel": 1.0, "gasoline": 1.0}),
    ],
)
@pytest.mark.anyio
async def test_aggregate_fuel_supplies(
    summary_repo, fuel_supplies, fossil_derived, expected
):
    result = summary_repo.aggregate_quantities(fuel_supplies, fossil_derived)

    assert result == expected


@pytest.mark.anyio
async def test_penalty_override_field_defaults(summary_repo, compliance_reports):
    """Test that penalty override fields have correct default values"""
    summary = ComplianceReportSummary(
        compliance_report_id=compliance_reports[0].compliance_report_id,
    )

    result = await summary_repo.add_compliance_report_summary(summary=summary)

    assert result.penalty_override_enabled is False
    assert result.renewable_penalty_override is None
    assert result.low_carbon_penalty_override is None
    assert result.penalty_override_date is None
    assert result.penalty_override_user is None


@pytest.mark.anyio
async def test_penalty_override_field_assignment(
    summary_repo, compliance_reports, users
):
    """Test that penalty override fields can be set and retrieved"""
    from datetime import datetime, timezone

    penalty_date = datetime(2024, 6, 15, 10, 30, 0, tzinfo=timezone.utc)

    summary = ComplianceReportSummary(
        compliance_report_id=compliance_reports[0].compliance_report_id,
        penalty_override_enabled=True,
        renewable_penalty_override=1500.50,
        low_carbon_penalty_override=750.25,
        penalty_override_date=penalty_date,
        penalty_override_user=users[0].user_profile_id,
    )

    result = await summary_repo.add_compliance_report_summary(summary=summary)

    assert result.penalty_override_enabled is True
    assert result.renewable_penalty_override == 1500.50
    assert result.low_carbon_penalty_override == 750.25
    assert result.penalty_override_date == penalty_date
    assert result.penalty_override_user == users[0].user_profile_id


@pytest.mark.anyio
async def test_penalty_override_update_existing_summary(
    summary_repo, compliance_reports, compliance_report_summaries, users
):
    """Test updating penalty override fields on existing summary"""
    from datetime import datetime, timezone
    from lcfs.web.api.compliance_report.schema import ComplianceReportSummarySchema

    penalty_date = datetime(2024, 6, 15, 14, 45, 0, tzinfo=timezone.utc)

    summary_schema = ComplianceReportSummarySchema(
        compliance_report_id=compliance_reports[0].compliance_report_id,
        renewable_fuel_target_summary=[],
        low_carbon_fuel_target_summary=[],
        non_compliance_penalty_summary=[],
        penalty_override_enabled=True,
        renewable_penalty_override=2000.75,
        low_carbon_penalty_override=1000.50,
        penalty_override_date=penalty_date,
        penalty_override_user=users[0].user_profile_id,
    )

    result = await summary_repo.save_compliance_report_summary(
        summary=summary_schema, compliance_year=2024
    )

    assert result.penalty_override_enabled is True
    assert result.renewable_penalty_override == 2000.75
    assert result.low_carbon_penalty_override == 1000.50
    assert result.penalty_override_date == penalty_date
    assert result.penalty_override_user == users[0].user_profile_id


@pytest.mark.anyio
async def test_penalty_override_with_zero_values(summary_repo, compliance_reports):
    """Test penalty override with zero values are properly stored"""
    summary = ComplianceReportSummary(
        compliance_report_id=compliance_reports[0].compliance_report_id,
        penalty_override_enabled=True,
        renewable_penalty_override=0.0,
        low_carbon_penalty_override=0.0,
    )

    result = await summary_repo.add_compliance_report_summary(summary=summary)

    assert result.penalty_override_enabled is True
    assert result.renewable_penalty_override == 0.0
    assert result.low_carbon_penalty_override == 0.0


@pytest.mark.anyio
async def test_penalty_override_disabled_clears_values(
    summary_repo, compliance_reports
):
    """Test that disabling penalty override while keeping override values works"""
    summary = ComplianceReportSummary(
        compliance_report_id=compliance_reports[0].compliance_report_id,
        penalty_override_enabled=False,
        renewable_penalty_override=1000.0,  # Values present but override disabled
        low_carbon_penalty_override=500.0,
    )

    result = await summary_repo.add_compliance_report_summary(summary=summary)

    assert result.penalty_override_enabled is False
    assert result.renewable_penalty_override == 1000.0  # Values preserved
    assert result.low_carbon_penalty_override == 500.0


@pytest.mark.anyio
async def test_penalty_override_user_relationship(
    summary_repo, compliance_reports, users
):
    """Test penalty override user foreign key relationship"""
    summary = ComplianceReportSummary(
        compliance_report_id=compliance_reports[0].compliance_report_id,
        penalty_override_enabled=True,
        penalty_override_user=users[0].user_profile_id,
    )

    result = await summary_repo.add_compliance_report_summary(summary=summary)

    # Refresh to load relationships
    await summary_repo.db.refresh(result)

    assert result.penalty_override_user == users[0].user_profile_id
    # Test the relationship is properly configured
    assert hasattr(result, "penalty_override_user_profile")
