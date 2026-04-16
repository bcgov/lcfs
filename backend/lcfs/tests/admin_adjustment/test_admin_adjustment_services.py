from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import HTTPException

from lcfs.db.models.admin_adjustment.AdminAdjustmentStatus import (
    AdminAdjustmentStatusEnum,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.admin_adjustment.schema import AdminAdjustmentUpdateSchema
from lcfs.web.api.admin_adjustment.services import AdminAdjustmentServices


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_status(status_enum: AdminAdjustmentStatusEnum, status_id: int = 1):
    s = MagicMock()
    s.status = status_enum
    s.admin_adjustment_status_id = status_id
    return s


def _make_admin_adjustment(current_status_enum: AdminAdjustmentStatusEnum):
    """Build a minimal mock admin adjustment for service-level tests.

    The `current_status.status` attribute is kept as the enum so that service
    comparisons work correctly.  Tests that reach `AdminAdjustmentSchema.from_orm`
    should patch that call to avoid pydantic validation issues with MagicMock attrs.
    """
    aa = MagicMock()
    aa.admin_adjustment_id = 1
    aa.current_status = _make_status(current_status_enum)  # .status is the enum
    aa.transaction = None
    aa.transaction_effective_date = date(2024, 1, 1)
    aa.compliance_units = 1000
    aa.to_organization_id = 1
    aa.gov_comment = "comment"
    aa.internal_comment = None
    aa.history = []
    aa.create_date = datetime(2024, 1, 1)
    aa.to_organization = MagicMock()
    aa.to_organization.organization_id = 1
    aa.to_organization.name = "Test Org"
    aa.returned = False
    return aa


def _make_update_schema(
    status: str,
    compliance_units: int = 500,
    to_organization_id: int = 2,
    transaction_effective_date: str = "2024-08-06",
) -> AdminAdjustmentUpdateSchema:
    return AdminAdjustmentUpdateSchema(
        admin_adjustment_id=1,
        current_status=status,
        compliance_units=compliance_units,
        to_organization_id=to_organization_id,
        transaction_effective_date=transaction_effective_date,
    )


def _make_user(roles):
    user = MagicMock()
    user.user_profile_id = 1
    user.first_name = "Test"
    user.last_name = "User"
    user.role_names = set(roles)
    return user


def _make_service(current_aa, new_status, user_roles):
    """Build a minimal AdminAdjustmentServices with mocked dependencies."""
    service = AdminAdjustmentServices.__new__(AdminAdjustmentServices)

    repo = MagicMock()
    repo.get_admin_adjustment_by_id = AsyncMock(return_value=current_aa)
    repo.get_admin_adjustment_status_by_name = AsyncMock(return_value=new_status)
    repo.update_admin_adjustment = AsyncMock(return_value=current_aa)
    repo.add_admin_adjustment_history = AsyncMock()
    repo.update_admin_adjustment_history = AsyncMock()
    repo.refresh_admin_adjustment = AsyncMock()

    request = MagicMock()
    request.user = _make_user(user_roles)

    service.repo = repo
    service.org_service = MagicMock()
    service.org_service.adjust_balance = AsyncMock(return_value=MagicMock())
    service.internal_comment_service = MagicMock()
    service.request = request
    return service


@pytest.mark.anyio
async def test_draft_only_fields_not_updated_when_recommended():
    """
    When the current status is Recommended, the compliance_units,
    to_organization_id, and transaction_effective_date sent by the client
    must be ignored.
    """
    aa = _make_admin_adjustment(AdminAdjustmentStatusEnum.Recommended)
    aa.compliance_units = 1000
    aa.to_organization_id = 1

    # same status — no status change
    new_status = _make_status(AdminAdjustmentStatusEnum.Recommended)
    new_status.status = AdminAdjustmentStatusEnum.Recommended
    aa.current_status = new_status

    update_data = _make_update_schema(
        status="Recommended",
        compliance_units=9999,
        to_organization_id=99,
    )

    service = _make_service(
        aa,
        new_status,
        user_roles=[RoleEnum.GOVERNMENT, RoleEnum.ANALYST],
    )

    with patch(
        "lcfs.web.api.admin_adjustment.services.AdminAdjustmentSchema.from_orm"
    ) as mock_from_orm:
        mock_from_orm.return_value = MagicMock(returned=False)
        await service.update_admin_adjustment(update_data)

    # Draft-only fields must remain unchanged on the model object
    assert aa.compliance_units == 1000
    assert aa.to_organization_id == 1


@pytest.mark.anyio
async def test_draft_only_fields_updated_when_draft():
    """
    When the current status is Draft, draft-only fields SHOULD be updated.
    """
    aa = _make_admin_adjustment(AdminAdjustmentStatusEnum.Draft)
    aa.compliance_units = 1000
    aa.to_organization_id = 1

    new_status = _make_status(AdminAdjustmentStatusEnum.Draft)
    new_status.status = AdminAdjustmentStatusEnum.Draft
    aa.current_status = new_status

    update_data = _make_update_schema(
        status="Draft",
        compliance_units=500,
        to_organization_id=2,
    )

    service = _make_service(
        aa,
        new_status,
        user_roles=[RoleEnum.GOVERNMENT, RoleEnum.ANALYST],
    )

    with patch(
        "lcfs.web.api.admin_adjustment.services.AdminAdjustmentSchema.from_orm"
    ) as mock_from_orm:
        mock_from_orm.return_value = MagicMock(returned=False)
        await service.update_admin_adjustment(update_data)

    assert aa.compliance_units == 500
    assert aa.to_organization_id == 2


@pytest.mark.anyio
async def test_draft_to_approved_raises_403():
    """
    Moving a Draft transaction directly to Approved must raise HTTP 403.
    The correct flow is Draft → Recommended → Approved.
    """
    aa = _make_admin_adjustment(AdminAdjustmentStatusEnum.Draft)
    new_status = _make_status(AdminAdjustmentStatusEnum.Approved)
    new_status.status = AdminAdjustmentStatusEnum.Approved

    update_data = _make_update_schema(status="Approved")

    service = _make_service(
        aa,
        new_status,
        user_roles=[RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR],
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.update_admin_adjustment(update_data)

    assert exc_info.value.status_code == 403
    assert "recommended" in exc_info.value.detail.lower()


@pytest.mark.anyio
async def test_recommended_to_approved_succeeds_for_director():
    """
    A Director can approve a transaction that is already Recommended.
    """
    aa = _make_admin_adjustment(AdminAdjustmentStatusEnum.Recommended)
    aa.transaction = None

    new_status = _make_status(AdminAdjustmentStatusEnum.Approved)
    new_status.status = AdminAdjustmentStatusEnum.Approved

    update_data = _make_update_schema(status="Approved")

    service = _make_service(
        aa,
        new_status,
        user_roles=[RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR],
    )

    with patch(
        "lcfs.web.api.admin_adjustment.services.AdminAdjustmentSchema.from_orm"
    ) as mock_from_orm:
        mock_from_orm.return_value = MagicMock(returned=False)
        result = await service.update_admin_adjustment(update_data)

    assert result is not None


@pytest.mark.anyio
async def test_director_cannot_recommend():
    """
    A Director (without Analyst role) must not be able to move a transaction
    to Recommended status.
    """
    aa = _make_admin_adjustment(AdminAdjustmentStatusEnum.Draft)
    new_status = _make_status(AdminAdjustmentStatusEnum.Recommended)
    new_status.status = AdminAdjustmentStatusEnum.Recommended

    update_data = _make_update_schema(status="Recommended")

    service = _make_service(
        aa,
        new_status,
        user_roles=[RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR],
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.update_admin_adjustment(update_data)

    assert exc_info.value.status_code == 403
    assert "analyst" in exc_info.value.detail.lower()


@pytest.mark.anyio
async def test_compliance_manager_cannot_recommend():
    """
    A Compliance Manager (without Analyst role) must not be able to move a
    transaction to Recommended status.
    """
    aa = _make_admin_adjustment(AdminAdjustmentStatusEnum.Draft)
    new_status = _make_status(AdminAdjustmentStatusEnum.Recommended)
    new_status.status = AdminAdjustmentStatusEnum.Recommended

    update_data = _make_update_schema(status="Recommended")

    service = _make_service(
        aa,
        new_status,
        user_roles=[RoleEnum.GOVERNMENT, RoleEnum.COMPLIANCE_MANAGER],
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.update_admin_adjustment(update_data)

    assert exc_info.value.status_code == 403
    assert "analyst" in exc_info.value.detail.lower()


@pytest.mark.anyio
async def test_analyst_can_recommend():
    """
    An Analyst should be able to move a Draft transaction to Recommended.
    """
    aa = _make_admin_adjustment(AdminAdjustmentStatusEnum.Draft)
    new_status = _make_status(AdminAdjustmentStatusEnum.Recommended)
    new_status.status = AdminAdjustmentStatusEnum.Recommended

    update_data = _make_update_schema(status="Recommended")

    service = _make_service(
        aa,
        new_status,
        user_roles=[RoleEnum.GOVERNMENT, RoleEnum.ANALYST],
    )

    with patch(
        "lcfs.web.api.admin_adjustment.services.AdminAdjustmentSchema.from_orm"
    ) as mock_from_orm:
        mock_from_orm.return_value = MagicMock(returned=False)
        result = await service.update_admin_adjustment(update_data)

    assert result is not None
