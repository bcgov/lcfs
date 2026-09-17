"""
Query-shape tests for the compliance report repository loaders (issue #4099).

The report loaders join every many-to-one relationship but must never join a
collection: joining ``history`` multiplied each (very wide) report row by the
number of history entries, and combined with the schedule collections in the
changelog query it produced a cartesian product.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import event, select
from sqlalchemy.dialects import postgresql

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance import (
    ComplianceReport,
    ComplianceReportHistory,
    ComplianceReportStatus,
    FuelSupply,
)
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatusEnum,
)
from lcfs.db.models.fuel import FuelCategory, FuelType
from lcfs.db.models.user import UserProfile
from lcfs.web.api.compliance_report.dtos import ChangelogFuelSuppliesDTO
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import ComplianceReportBaseSchema


def _sql(stmt) -> str:
    return " ".join(str(stmt.compile(dialect=postgresql.dialect())).split())


@pytest.fixture
def offline_repo():
    """Repository with no database; only used to compile loader options."""
    return ComplianceReportRepository(db=AsyncMock(), fuel_supply_repo=MagicMock())


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
    return statuses


@pytest.fixture
async def history_users(dbsession, organizations):
    users = [
        UserProfile(
            user_profile_id=996,
            keycloak_username="history_user_996",
            first_name="History",
            last_name="Supplier",
            is_active=True,
            organization_id=organizations[0].organization_id,
        ),
        UserProfile(
            user_profile_id=997,
            keycloak_username="history_user_997",
            first_name="History",
            last_name="Analyst",
            is_active=True,
        ),
    ]
    dbsession.add_all(users)
    await dbsession.commit()
    return users


@pytest.fixture
async def report_with_history(
    dbsession, compliance_reports, compliance_report_statuses, history_users
):
    report = compliance_reports[0]
    dbsession.add_all(
        [
            ComplianceReportHistory(
                compliance_report_id=report.compliance_report_id,
                status_id=compliance_report_statuses[1].compliance_report_status_id,
                user_profile_id=history_users[0].user_profile_id,
            ),
            ComplianceReportHistory(
                compliance_report_id=report.compliance_report_id,
                status_id=compliance_report_statuses[2].compliance_report_status_id,
                user_profile_id=history_users[1].user_profile_id,
            ),
        ]
    )
    await dbsession.commit()
    # Drop everything from the identity map so the repository has to load the
    # graph from the database rather than reuse the fixture objects.
    dbsession.expunge_all()
    return report


def test_base_report_options_join_no_collections(offline_repo):
    sql = _sql(
        select(ComplianceReport).options(*offline_repo._get_base_report_options())
    )
    assert "compliance_report_history" not in sql
    # many-to-one / one-to-one relationships are still joined
    for table in (
        "organization",
        "compliance_period",
        "compliance_report_status",
        "compliance_report_summary",
        "transaction",
    ):
        assert f"LEFT OUTER JOIN {table} AS" in sql, table


def test_minimal_report_options_join_no_collections(offline_repo):
    sql = _sql(
        select(ComplianceReport).options(*offline_repo._get_minimal_report_options())
    )
    assert "compliance_report_history" not in sql
    assert "JOIN transaction " not in sql


@pytest.mark.anyio
async def test_get_compliance_report_by_id_loads_history_graph(
    compliance_report_repo, report_with_history
):
    loaded = await compliance_report_repo.get_compliance_report_by_id(
        report_with_history.compliance_report_id
    )

    assert loaded is not None
    assert len(loaded.history) == 2
    # Every attribute below is read outside of a database call. Under the
    # async session an attribute that was not eagerly loaded raises
    # MissingGreenlet, so plain attribute access is the regression check.
    statuses = {entry.status.status for entry in loaded.history}
    assert statuses == {
        ComplianceReportStatusEnum.Draft,
        ComplianceReportStatusEnum.Recommended_by_analyst,
    }
    usernames = {entry.user_profile.keycloak_username for entry in loaded.history}
    assert usernames == {"history_user_996", "history_user_997"}
    orgs = {
        entry.user_profile.organization.organization_id
        for entry in loaded.history
        if entry.user_profile.organization is not None
    }
    assert len(orgs) == 1
    assert loaded.organization is not None
    assert loaded.compliance_period is not None
    assert loaded.current_status is not None
    # the schema conversion used by the services touches the whole graph
    ComplianceReportBaseSchema.model_validate(loaded)


@pytest.mark.anyio
async def test_get_compliance_report_chain_returns_each_report_once(
    compliance_report_repo, report_with_history
):
    chain = await compliance_report_repo.get_compliance_report_chain(
        report_with_history.compliance_report_group_uuid
    )

    assert [r.compliance_report_id for r in chain] == [
        report_with_history.compliance_report_id
    ]
    assert len(chain[0].history) == 2


@pytest.mark.anyio
async def test_get_latest_report_by_group_uuid_loads_history_graph(
    compliance_report_repo, report_with_history
):
    latest = await compliance_report_repo.get_latest_report_by_group_uuid(
        report_with_history.compliance_report_group_uuid
    )

    assert latest.compliance_report_id == report_with_history.compliance_report_id
    assert len(latest.history) == 2
    assert all(entry.status is not None for entry in latest.history)


# --- get_changelog_data ------------------------------------------------------
#
# The changelog query loads a report chain together with its history and one
# schedule collection. Before the selectinload rewrite both collections were
# joined into the report SELECT, so each report row came back
# (history entries x schedule rows) times and the ORM had to de-duplicate a
# cartesian product. These fixtures build the smallest chain that exercises
# that multiplication: two reports, two history rows, and several fuel supply
# rows per report.

# Mirrors the "fuel_supplies" entry of the data_map in
# ComplianceReportServices.get_changelog_data.
FUEL_SUPPLIES_CHANGELOG_CONFIG = {
    "model": FuelSupply,
    "dto": ChangelogFuelSuppliesDTO,
    "id_field": "fuel_supply_id",
    "relationships": [
        ("fuel_supplies", "fuel_type"),
        ("fuel_supplies", "fuel_category"),
        ("fuel_supplies", "fuel_code"),
        ("fuel_supplies", "end_use_type"),
        ("fuel_supplies", "provision_of_the_act"),
    ],
}


@pytest.fixture
def supplier_user():
    # Transient: never added to the session. user_roles is set explicitly so
    # is_government_user() reads a loaded (empty) collection instead of
    # triggering a lazy load on the async session.
    return UserProfile(
        user_profile_id=995, keycloak_username="changelog_supplier", user_roles=[]
    )


@pytest.fixture
async def changelog_fuel_types(dbsession):
    fuel_types = [
        FuelType(
            fuel_type_id=990,
            fuel_type="Changelog diesel",
            units="Litres",
            unrecognized=False,
            fossil_derived=True,
        ),
        FuelType(
            fuel_type_id=991,
            fuel_type="Changelog biodiesel",
            units="Litres",
            unrecognized=False,
            fossil_derived=False,
        ),
    ]
    dbsession.add_all(fuel_types)
    await dbsession.flush()
    return fuel_types


@pytest.fixture
async def changelog_fuel_category(dbsession):
    category = FuelCategory(
        fuel_category_id=990, category="Diesel", default_carbon_intensity=0
    )
    dbsession.add(category)
    await dbsession.flush()
    return category


@pytest.fixture
async def changelog_report_chain(
    dbsession,
    report_with_history,
    compliance_report_statuses,
    changelog_fuel_types,
    changelog_fuel_category,
):
    """
    Original report (two history rows, three fuel supplies) plus a supplemental
    report in the same group that updates one supply and adds another.
    Returns ``(original_id, supplemental_id, group_uuid)``.
    """
    original = report_with_history
    supplemental = ComplianceReport(
        compliance_report_id=993,
        compliance_period_id=original.compliance_period_id,
        organization_id=original.organization_id,
        nickname="Supplemental report 1",
        reporting_frequency=ReportingFrequency.ANNUAL,
        current_status_id=compliance_report_statuses[0].compliance_report_status_id,
        compliance_report_group_uuid=original.compliance_report_group_uuid,
        version=2,
    )
    dbsession.add(supplemental)
    await dbsession.flush()

    updated_group = str(uuid.uuid4())

    def supply(fuel_supply_id, report_id, fuel_type, group_uuid, version, action):
        return FuelSupply(
            fuel_supply_id=fuel_supply_id,
            compliance_report_id=report_id,
            quantity=100 + fuel_supply_id,
            units="Litres",
            fuel_category_id=changelog_fuel_category.fuel_category_id,
            fuel_type_id=fuel_type.fuel_type_id,
            provision_of_the_act_id=1,
            group_uuid=group_uuid,
            version=version,
            action_type=action,
        )

    diesel, biodiesel = changelog_fuel_types
    dbsession.add_all(
        [
            supply(
                990,
                original.compliance_report_id,
                diesel,
                updated_group,
                0,
                ActionTypeEnum.CREATE,
            ),
            supply(
                991,
                original.compliance_report_id,
                biodiesel,
                str(uuid.uuid4()),
                0,
                ActionTypeEnum.CREATE,
            ),
            supply(
                992,
                original.compliance_report_id,
                diesel,
                str(uuid.uuid4()),
                0,
                ActionTypeEnum.CREATE,
            ),
            supply(
                993,
                supplemental.compliance_report_id,
                biodiesel,
                updated_group,
                1,
                ActionTypeEnum.UPDATE,
            ),
            supply(
                994,
                supplemental.compliance_report_id,
                diesel,
                str(uuid.uuid4()),
                0,
                ActionTypeEnum.CREATE,
            ),
        ]
    )
    await dbsession.commit()
    dbsession.expunge_all()
    return (
        original.compliance_report_id,
        supplemental.compliance_report_id,
        original.compliance_report_group_uuid,
    )


@pytest.mark.anyio
async def test_get_changelog_data_loads_complete_schedule_without_duplicates(
    dbsession, compliance_report_repo, changelog_report_chain, supplier_user
):
    original_id, supplemental_id, group_uuid = changelog_report_chain
    statements = []
    event.listen(
        dbsession.sync_session, "do_orm_execute", lambda state: statements.append(state)
    )

    reports = await compliance_report_repo.get_changelog_data(
        group_uuid, FUEL_SUPPLIES_CHANGELOG_CONFIG, supplier_user
    )

    # newest version first, each report exactly once
    assert [r.compliance_report_id for r in reports] == [supplemental_id, original_id]
    by_id = {r.compliance_report_id: r for r in reports}

    # every schedule row present, none repeated per history entry
    assert sorted(fs.fuel_supply_id for fs in by_id[original_id].fuel_supplies) == [
        990,
        991,
        992,
    ]
    assert sorted(fs.fuel_supply_id for fs in by_id[supplemental_id].fuel_supplies) == [
        993,
        994,
    ]
    # history loaded alongside the schedule and also not multiplied
    assert len(by_id[original_id].history) == 2
    assert by_id[supplemental_id].history == []

    for report in reports:
        for fuel_supply in report.fuel_supplies:
            # Nested many-to-one rows are read outside any database call; a
            # relationship that was not eagerly loaded raises MissingGreenlet.
            assert fuel_supply.fuel_type.fuel_type.startswith("Changelog")
            assert fuel_supply.fuel_category.category == "Diesel"
            assert fuel_supply.provision_of_the_act.name
            assert fuel_supply.fuel_code is None
            assert fuel_supply.end_use_type is None
        # the service wraps the rows in this DTO, which touches the whole graph
        ChangelogFuelSuppliesDTO(
            nickname=report.nickname,
            version=report.version,
            compliance_report_id=report.compliance_report_id,
            fuel_supplies=report.fuel_supplies,
        )

    # Loader shape: the report SELECT joins neither collection; each is
    # fetched by its own IN query.
    report_selects = [s for s in statements if not s.is_relationship_load]
    assert len(report_selects) == 1
    report_sql = _sql(report_selects[0].statement)
    assert "JOIN fuel_supply" not in report_sql
    assert "JOIN compliance_report_history" not in report_sql
    collection_loads = [_sql(s.statement) for s in statements if s.is_relationship_load]
    assert any(sql.startswith("SELECT fuel_supply.") for sql in collection_loads)
    assert any(
        sql.startswith("SELECT compliance_report_history.") for sql in collection_loads
    )
