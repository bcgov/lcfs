"""Tests for CI application authorization validation."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException, status

from lcfs.db.models.ci_application import CIApplication
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.ci_application.validation import CIApplicationValidation


def _user(roles, organization_id=1):
    """Build a request.user-style mock with role_names + organization."""
    user = MagicMock()
    user.role_names = roles
    user.organization = (
        SimpleNamespace(organization_id=organization_id) if organization_id else None
    )
    return user


def _request(user):
    request = MagicMock()
    request.user = user
    return request


def _application(application_id=10, organization_id=1):
    ci = CIApplication(
        ci_application_id=application_id,
        organization_id=organization_id,
        status_id=1,
        facility_country="Argentina",
        facility_nameplate_capacity=1000,
        facility_nameplate_capacity_unit_id=1,
        group_uuid="abc",
        version=0,
    )
    return ci


@pytest.fixture
def repo():
    return AsyncMock()


def _validation(user, repo):
    v = CIApplicationValidation(request=_request(user), repo=repo)
    return v


# ---------------------------------------------------------------------------
# validate_access
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_validate_access_404_when_missing(repo):
    repo.get_by_id.return_value = None
    v = _validation(_user([RoleEnum.GOVERNMENT]), repo)
    with pytest.raises(HTTPException) as exc:
        await v.validate_access(123)
    assert exc.value.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_validate_access_government_can_see_any_org(repo):
    ci = _application(organization_id=99)
    repo.get_by_id.return_value = ci
    v = _validation(_user([RoleEnum.GOVERNMENT], organization_id=None), repo)
    result = await v.validate_access(ci.ci_application_id)
    assert result is ci


@pytest.mark.anyio
async def test_validate_access_supplier_same_org_allowed(repo):
    ci = _application(organization_id=1)
    repo.get_by_id.return_value = ci
    v = _validation(_user([RoleEnum.CI_APPLICANT], organization_id=1), repo)
    result = await v.validate_access(ci.ci_application_id)
    assert result is ci


@pytest.mark.anyio
async def test_validate_access_supplier_other_org_forbidden(repo):
    ci = _application(organization_id=2)
    repo.get_by_id.return_value = ci
    v = _validation(_user([RoleEnum.CI_APPLICANT], organization_id=1), repo)
    with pytest.raises(HTTPException) as exc:
        await v.validate_access(ci.ci_application_id)
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_validate_access_supplier_without_org_forbidden(repo):
    ci = _application(organization_id=2)
    repo.get_by_id.return_value = ci
    v = _validation(_user([RoleEnum.CI_APPLICANT], organization_id=None), repo)
    with pytest.raises(HTTPException) as exc:
        await v.validate_access(ci.ci_application_id)
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# require_supplier_organization
# ---------------------------------------------------------------------------


def test_require_supplier_organization_returns_id():
    v = CIApplicationValidation(
        request=_request(_user([RoleEnum.CI_APPLICANT], organization_id=7)),
        repo=AsyncMock(),
    )
    assert v.require_supplier_organization() == 7


def test_require_supplier_organization_raises_when_missing():
    v = CIApplicationValidation(
        request=_request(_user([RoleEnum.CI_APPLICANT], organization_id=None)),
        repo=AsyncMock(),
    )
    with pytest.raises(HTTPException) as exc:
        v.require_supplier_organization()
    assert exc.value.status_code == status.HTTP_403_FORBIDDEN
