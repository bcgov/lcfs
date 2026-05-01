"""Tests for the CI application service layer."""

from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.ci_application import CIApplication, CIApplicationStatus
from lcfs.db.models.fuel.UnitOfMeasure import UnitOfMeasure
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.ci_application.schema import (
    CIApplicationsListSchema,
    CIApplicationSchema,
    CIApplicationStatusEnum,
    CIApplicationStep1Schema,
    CITableOptionsSchema,
)
from lcfs.web.api.ci_application.services import CIApplicationServices
from lcfs.web.exception.exceptions import DataNotFoundException


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def repo():
    return AsyncMock()


@pytest.fixture
def service(repo):
    return CIApplicationServices(repo=repo)


@pytest.fixture
def mock_user():
    user = MagicMock()
    user.keycloak_username = "ci_applicant_user"
    return user


def _status(name="Draft", ident=1):
    return CIApplicationStatus(
        ci_application_status_id=ident,
        status=name,
        description=name,
        display_order=ident,
    )


def _uom(uom_id=1, name="Litres"):
    return UnitOfMeasure(uom_id=uom_id, name=name, description=name)


def _organization(org_id=1, name="Fuel Producer Ltd."):
    return SimpleNamespace(
        organization_id=org_id,
        name=name,
        operating_name=f"{name} (DBA)",
        email="hello@example.com",
        phone="+1 555 0100",
    )


def _ci_application(
    ci_application_id=10,
    status=None,
    organization=None,
    unit=None,
):
    status = status or _status()
    organization = organization or _organization()
    unit = unit or _uom()
    return SimpleNamespace(
        ci_application_id=ci_application_id,
        organization_id=organization.organization_id,
        organization=organization,
        status_id=status.ci_application_status_id,
        ci_application_status=status,
        facility_city="San Martin",
        facility_province_state="Santa Fe",
        facility_country="Argentina",
        facility_iso="AR",
        facility_nameplate_capacity=1000,
        facility_nameplate_capacity_unit_id=unit.uom_id,
        facility_nameplate_capacity_unit=unit,
        proposed_fuel_code_effective_date=date(2026, 6, 1),
        pathway_description=None,
        supporting_document_other=None,
        consultant_name=None,
        consultant_company=None,
        consultant_email=None,
        signature_user=None,
        update_date=datetime(2026, 5, 1, tzinfo=timezone.utc),
        create_date=datetime(2026, 4, 1, tzinfo=timezone.utc),
        group_uuid="abc",
        version=0,
        action_type=ActionTypeEnum.CREATE,
    )


def _step1_payload(**overrides):
    base = dict(
        facility_city="San Martin",
        facility_province_state="Santa Fe",
        facility_country="Argentina",
        facility_iso="AR",
        facility_nameplate_capacity=1000,
        facility_nameplate_capacity_unit_id=1,
        proposed_fuel_code_effective_date=date(2026, 6, 1),
    )
    base.update(overrides)
    return CIApplicationStep1Schema(**base)


# ---------------------------------------------------------------------------
# Lookup options
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_table_options_returns_lookup_data(service, repo):
    repo.get_statuses.return_value = [
        _status("Draft", 1),
        _status("Submitted", 2),
        _status("Completed", 3),
        _status("Withdrawn", 4),
    ]
    repo.get_units_of_measure.return_value = [_uom(1, "Litres"), _uom(2, "Kilograms")]

    result = await service.get_table_options()

    assert isinstance(result, CITableOptionsSchema)
    assert [s.status for s in result.statuses] == [
        CIApplicationStatusEnum.Draft,
        CIApplicationStatusEnum.Submitted,
        CIApplicationStatusEnum.Completed,
        CIApplicationStatusEnum.Withdrawn,
    ]
    assert {u.name for u in result.units_of_measure} == {"Litres", "Kilograms"}


# ---------------------------------------------------------------------------
# Listing
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_list_ci_applications_returns_pagination(service, repo):
    repo.list_paginated.return_value = ([_ci_application(), _ci_application(11)], 2)
    repo.total_pages = MagicMock(return_value=1)

    pagination = PaginationRequestSchema(page=1, size=10)
    result = await service.list_ci_applications(pagination, organization_id=1)

    assert isinstance(result, CIApplicationsListSchema)
    assert result.pagination.total == 2
    assert result.pagination.page == 1
    assert len(result.ci_applications) == 2
    assert result.ci_applications[0].facility_country == "Argentina"


@pytest.mark.anyio
async def test_list_ci_applications_passes_org_id(service, repo):
    repo.list_paginated.return_value = ([], 0)
    repo.total_pages = MagicMock(return_value=0)

    pagination = PaginationRequestSchema(page=1, size=10)
    await service.list_ci_applications(pagination, organization_id=99)

    repo.list_paginated.assert_awaited_once_with(pagination, 99)


# ---------------------------------------------------------------------------
# Detail
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_ci_application_returns_full_schema(service, repo):
    repo.get_by_id.return_value = _ci_application()
    result = await service.get_ci_application(10)
    assert isinstance(result, CIApplicationSchema)
    assert result.ci_application_id == 10
    assert result.facility_country == "Argentina"
    assert result.organization is not None
    assert result.organization.name == "Fuel Producer Ltd."
    assert result.facility_nameplate_capacity_unit.name == "Litres"


@pytest.mark.anyio
async def test_get_ci_application_missing_raises(service, repo):
    repo.get_by_id.return_value = None
    with pytest.raises(DataNotFoundException):
        await service.get_ci_application(123)


# ---------------------------------------------------------------------------
# Create draft
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_create_draft_persists_with_draft_status(service, repo, mock_user):
    draft_status = _status("Draft", 1)
    repo.get_status_by_name.return_value = draft_status
    repo.create.side_effect = lambda ci: ci  # echo
    repo.add_history.return_value = MagicMock()
    repo.get_by_id.return_value = _ci_application(status=draft_status)

    result = await service.create_draft(
        organization_id=1,
        data=_step1_payload(),
        user=mock_user,
    )

    repo.get_status_by_name.assert_awaited_once_with("Draft")
    repo.create.assert_awaited_once()
    created_ci = repo.create.await_args.args[0]
    assert isinstance(created_ci, CIApplication)
    assert created_ci.organization_id == 1
    assert created_ci.status_id == draft_status.ci_application_status_id
    assert created_ci.facility_country == "Argentina"
    assert created_ci.action_type == ActionTypeEnum.CREATE
    assert created_ci.create_user == "ci_applicant_user"
    repo.add_history.assert_awaited_once()
    assert isinstance(result, CIApplicationSchema)
    assert result.status.status == CIApplicationStatusEnum.Draft


@pytest.mark.anyio
async def test_create_draft_raises_when_no_draft_status(service, repo, mock_user):
    repo.get_status_by_name.return_value = None
    with pytest.raises(DataNotFoundException):
        await service.create_draft(1, _step1_payload(), mock_user)
    repo.create.assert_not_called()


# ---------------------------------------------------------------------------
# Update step 1
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_step1_writes_fields_and_marks_update(service, repo, mock_user):
    ci = _ci_application()
    repo.update.side_effect = lambda obj: obj
    repo.get_by_id.return_value = ci

    payload = _step1_payload(
        facility_city="Vancouver",
        facility_province_state="BC",
        facility_country="Canada",
        facility_iso="CA",
        facility_nameplate_capacity=2500,
        facility_nameplate_capacity_unit_id=2,
        proposed_fuel_code_effective_date=date(2027, 1, 1),
    )

    result = await service.update_step1(ci, payload, mock_user)

    assert ci.facility_city == "Vancouver"
    assert ci.facility_country == "Canada"
    assert ci.facility_nameplate_capacity == 2500
    assert ci.facility_nameplate_capacity_unit_id == 2
    assert ci.action_type == ActionTypeEnum.UPDATE
    assert ci.update_user == "ci_applicant_user"
    assert isinstance(result, CIApplicationSchema)
    repo.update.assert_awaited_once_with(ci)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_delete_draft_calls_repo(service, repo):
    ci = _ci_application()
    await service.delete_draft(ci)
    repo.delete.assert_awaited_once_with(ci)
