import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models import ComplianceReportOrganizationSnapshot
from lcfs.web.api.organization_snapshot.repo import OrganizationSnapshotRepository
from lcfs.web.api.organization_snapshot.services import OrganizationSnapshotService


@pytest.fixture
def mock_repo():
    repo = AsyncMock(spec=OrganizationSnapshotRepository)
    return repo


@pytest.fixture
def mock_session():
    session = MagicMock(spec=AsyncSession)
    return session


@pytest.fixture
def service(mock_repo, mock_session):
    return OrganizationSnapshotService(repo=mock_repo, session=mock_session)


@pytest.mark.anyio
async def test_get_by_compliance_report_id(service, mock_repo):
    compliance_report_id = 1
    expected_snapshot = ComplianceReportOrganizationSnapshot()
    mock_repo.get_by_compliance_report_id.return_value = expected_snapshot

    result = await service.get_by_compliance_report_id(compliance_report_id)

    assert result == expected_snapshot
    mock_repo.get_by_compliance_report_id.assert_awaited_once_with(compliance_report_id)


@pytest.mark.anyio
async def test_create_organization_snapshot_success(service, mock_repo):
    compliance_report_id = 1
    organization_id = 1
    organization = MagicMock()
    organization.org_address = MagicMock(
        street_address="123 Main St",
        address_other=None,
        city="Anytown",
        province_state="State",
        country="Country",
        postalCode_zipCode="12345",
    )
    organization.org_attorney_address = None
    mock_repo.get_organization.return_value = organization
    expected_snapshot = ComplianceReportOrganizationSnapshot()
    mock_repo.save_snapshot.return_value = expected_snapshot

    result = await service.create_organization_snapshot(
        compliance_report_id, organization_id
    )

    assert result == expected_snapshot
    mock_repo.get_organization.assert_awaited_once_with(organization_id)
    mock_repo.save_snapshot.assert_awaited_once()


@pytest.mark.anyio
async def test_create_organization_snapshot_no_organization(service, mock_repo):
    compliance_report_id = 1
    organization_id = 1
    mock_repo.get_organization.return_value = None

    with pytest.raises(NoResultFound):
        await service.create_organization_snapshot(
            compliance_report_id, organization_id
        )


@pytest.mark.anyio
async def test_update_success(service, mock_repo):
    compliance_report_id = 1
    request_data = MagicMock()
    snapshot = ComplianceReportOrganizationSnapshot()
    mock_repo.get_by_compliance_report_id.return_value = snapshot
    updated_snapshot = ComplianceReportOrganizationSnapshot()
    mock_repo.save_snapshot.return_value = updated_snapshot

    result = await service.update(request_data, compliance_report_id)

    assert result == updated_snapshot
    mock_repo.get_by_compliance_report_id.assert_awaited_once_with(compliance_report_id)
    mock_repo.save_snapshot.assert_awaited_once()


@pytest.mark.anyio
async def test_update_no_snapshot(service, mock_repo):
    compliance_report_id = 1
    request_data = MagicMock()
    mock_repo.get_by_compliance_report_id.return_value = None

    with pytest.raises(NoResultFound):
        await service.update(request_data, compliance_report_id)


@pytest.mark.anyio
async def test_create_organization_snapshot_prev_report_not_found(service, mock_repo):
    prev_report_id = 2
    compliance_report_id = 3
    organization_id = 1

    mock_repo.get_by_compliance_report_id.side_effect = [None]
    org_mock = MagicMock()

    # Set up proper org_address mock
    org_address_mock = MagicMock()
    org_address_mock.street_address = "123 Fake St"
    org_address_mock.address_other = None
    org_address_mock.city = "Victoria"
    org_address_mock.province_state = "BC"
    org_address_mock.country = "Canada"
    org_address_mock.postalCode_zipCode = "V9A 1A1"
    org_mock.org_address = org_address_mock

    # Properly set up the attorney address mock with string values
    attorney_address_mock = MagicMock()
    attorney_address_mock.street_address = "456 Legal Ave"
    attorney_address_mock.address_other = "Suite 789"
    attorney_address_mock.city = "Vancouver"
    attorney_address_mock.province_state = "BC"
    attorney_address_mock.country = "Canada"
    attorney_address_mock.postalCode_zipCode = "V6B 2N2"
    org_mock.org_attorney_address = attorney_address_mock

    mock_repo.get_organization.return_value = org_mock
    mock_repo.save_snapshot.return_value = ComplianceReportOrganizationSnapshot()

    result = await service.create_organization_snapshot(
        compliance_report_id, organization_id, prev_report_id
    )

    assert result  # verify snapshot was created
    mock_repo.get_by_compliance_report_id.assert_awaited_once_with(prev_report_id)
    mock_repo.get_organization.assert_awaited_once_with(organization_id)
    mock_repo.save_snapshot.assert_awaited_once()
