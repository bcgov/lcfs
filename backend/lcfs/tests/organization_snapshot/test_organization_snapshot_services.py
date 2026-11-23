import pytest
from fastapi import HTTPException
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models import ComplianceReportOrganizationSnapshot
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatusEnum,
)
from lcfs.db.models.user.Role import RoleEnum
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


SUPPLIER_ROLES = [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING]
ANALYST_ROLES = [RoleEnum.GOVERNMENT, RoleEnum.ANALYST]
DIRECTOR_ROLES = [RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR]


def _as_user(service, roles):
    service.request = MagicMock()
    service.request.user = MagicMock(role_names=roles)


@pytest.mark.anyio
async def test_update_success(service, mock_repo):
    compliance_report_id = 1
    _as_user(service, SUPPLIER_ROLES)
    request_data = MagicMock(compliance_report_id=compliance_report_id)
    mock_repo.get_compliance_report_status.return_value = (
        ComplianceReportStatusEnum.Draft
    )
    snapshot = ComplianceReportOrganizationSnapshot(
        compliance_report_id=compliance_report_id
    )
    mock_repo.get_by_compliance_report_id.return_value = snapshot
    updated_snapshot = ComplianceReportOrganizationSnapshot()
    mock_repo.save_snapshot.return_value = updated_snapshot

    result = await service.update(request_data, compliance_report_id)

    assert result == updated_snapshot
    assert snapshot.compliance_report_id == compliance_report_id
    mock_repo.get_by_compliance_report_id.assert_awaited_once_with(compliance_report_id)
    mock_repo.save_snapshot.assert_awaited_once()


@pytest.mark.anyio
async def test_update_no_snapshot(service, mock_repo):
    compliance_report_id = 1
    _as_user(service, SUPPLIER_ROLES)
    request_data = MagicMock(compliance_report_id=compliance_report_id)
    mock_repo.get_compliance_report_status.return_value = (
        ComplianceReportStatusEnum.Draft
    )
    mock_repo.get_by_compliance_report_id.return_value = None

    with pytest.raises(NoResultFound):
        await service.update(request_data, compliance_report_id)


@pytest.mark.anyio
async def test_update_rejects_body_naming_another_report(service, mock_repo):
    _as_user(service, SUPPLIER_ROLES)
    request_data = MagicMock(compliance_report_id=2)

    with pytest.raises(HTTPException) as exc_info:
        await service.update(request_data, 1)

    assert exc_info.value.status_code == 400
    mock_repo.get_by_compliance_report_id.assert_not_awaited()
    mock_repo.save_snapshot.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "roles, report_status, allowed",
    [
        (SUPPLIER_ROLES, ComplianceReportStatusEnum.Draft, True),
        (SUPPLIER_ROLES, ComplianceReportStatusEnum.Submitted, False),
        (SUPPLIER_ROLES, ComplianceReportStatusEnum.Analyst_adjustment, False),
        (SUPPLIER_ROLES, ComplianceReportStatusEnum.Assessed, False),
        (ANALYST_ROLES, ComplianceReportStatusEnum.Draft, False),
        (ANALYST_ROLES, ComplianceReportStatusEnum.Submitted, True),
        (ANALYST_ROLES, ComplianceReportStatusEnum.Analyst_adjustment, True),
        (ANALYST_ROLES, ComplianceReportStatusEnum.Recommended_by_analyst, False),
        (ANALYST_ROLES, ComplianceReportStatusEnum.Assessed, False),
        (DIRECTOR_ROLES, ComplianceReportStatusEnum.Submitted, False),
    ],
)
async def test_update_editable_statuses_by_role(
    service, mock_repo, roles, report_status, allowed
):
    _as_user(service, roles)
    request_data = MagicMock(compliance_report_id=1)
    mock_repo.get_compliance_report_status.return_value = report_status
    mock_repo.get_by_compliance_report_id.return_value = (
        ComplianceReportOrganizationSnapshot(compliance_report_id=1)
    )

    if allowed:
        await service.update(request_data, 1)
        mock_repo.save_snapshot.assert_awaited_once()
    else:
        with pytest.raises(HTTPException) as exc_info:
            await service.update(request_data, 1)
        assert exc_info.value.status_code == 403
        mock_repo.save_snapshot.assert_not_awaited()


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
