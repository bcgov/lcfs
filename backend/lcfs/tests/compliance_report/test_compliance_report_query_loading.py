"""
Query-shape tests for the compliance report repository loaders (issue #4099).

The report loaders join every many-to-one relationship but must never join a
collection: joining ``history`` multiplied each (very wide) report row by the
number of history entries, and combined with the schedule collections in the
changelog query it produced a cartesian product.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from lcfs.db.models.compliance import (
    ComplianceReport,
    ComplianceReportHistory,
    ComplianceReportStatus,
)
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatusEnum,
)
from lcfs.db.models.user import UserProfile
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
