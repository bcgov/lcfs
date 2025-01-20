import pytest
from unittest.mock import AsyncMock, MagicMock
from lcfs.db.models import ComplianceReportOrganizationSnapshot, Organization
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.organization_snapshot.repo import OrganizationSnapshotRepository
from lcfs.web.exception.exceptions import DataNotFoundException


@pytest.fixture
def setup_repo(fastapi_app, set_mock_user):
    db_session = MagicMock()

    db_session.execute = AsyncMock()
    db_session.flush = AsyncMock()
    db_session.refresh = AsyncMock()
    db_session.add = MagicMock()

    repo = OrganizationSnapshotRepository(db=db_session)
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    return repo, db_session


@pytest.mark.anyio
async def test_get_by_compliance_report_id_found(setup_repo):
    repo, db_session = setup_repo
    compliance_report_id = 1
    snapshot = ComplianceReportOrganizationSnapshot(
        compliance_report_id=compliance_report_id
    )

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = snapshot
    db_session.execute.return_value = mock_result

    result = await repo.get_by_compliance_report_id(compliance_report_id)

    assert result == snapshot
    db_session.execute.assert_awaited_once()
    mock_result.scalar_one_or_none.assert_called_once()


@pytest.mark.anyio
async def test_get_by_compliance_report_id_not_found(setup_repo):
    repo, db_session = setup_repo
    compliance_report_id = 1

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    db_session.execute.return_value = mock_result

    with pytest.raises(DataNotFoundException):
        await repo.get_by_compliance_report_id(compliance_report_id)

    db_session.execute.assert_awaited_once()
    mock_result.scalar_one_or_none.assert_called_once()


@pytest.mark.anyio
async def test_get_organization_found(setup_repo):
    repo, db_session = setup_repo
    organization_id = 1
    organization = Organization(organization_id=organization_id)

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = organization
    db_session.execute.return_value = mock_result

    result = await repo.get_organization(organization_id)

    assert result == organization
    db_session.execute.assert_awaited_once()
    mock_result.scalar_one_or_none.assert_called_once()


@pytest.mark.anyio
async def test_get_organization_not_found(setup_repo):
    repo, db_session = setup_repo
    organization_id = 1

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    db_session.execute.return_value = mock_result

    result = await repo.get_organization(organization_id)

    assert result is None
    db_session.execute.assert_awaited_once()
    mock_result.scalar_one_or_none.assert_called_once()


@pytest.mark.anyio
async def test_save_snapshot(setup_repo):
    repo, db_session = setup_repo
    org_snapshot = ComplianceReportOrganizationSnapshot()

    result = await repo.save_snapshot(org_snapshot)

    assert result == org_snapshot

    db_session.add.assert_called_once_with(org_snapshot)
    db_session.flush.assert_awaited_once()
    db_session.refresh.assert_awaited_once_with(org_snapshot)
