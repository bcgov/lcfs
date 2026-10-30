"""The shared write guard: records are authorized by what is stored."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.core.ownership import (
    delete_one,
    ensure_matches,
    ensure_owned_by,
    is_government_user,
)


def _user(roles, organization_id=None):
    user = MagicMock()
    user.role_names = roles
    user.organization_id = organization_id
    return user


SUPPLIER = _user([RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING], 1)
GOVERNMENT = _user([RoleEnum.GOVERNMENT, RoleEnum.ANALYST])


def test_is_government_user():
    assert is_government_user(GOVERNMENT)
    assert not is_government_user(SUPPLIER)
    assert not is_government_user(None)


def test_owner_passes():
    ensure_owned_by(SUPPLIER, 1)


@pytest.mark.parametrize("organization_id", [2, None])
def test_another_organizations_record_reads_as_missing(organization_id):
    with pytest.raises(HTTPException) as exc:
        ensure_owned_by(SUPPLIER, organization_id)
    assert exc.value.status_code == 404


def test_government_passes_unless_excluded():
    ensure_owned_by(GOVERNMENT, 2)
    with pytest.raises(HTTPException) as exc:
        ensure_owned_by(GOVERNMENT, 2, allow_government=False)
    assert exc.value.status_code == 404


@pytest.mark.parametrize("sent", [None, 5])
def test_matching_or_absent_body_value_passes(sent):
    ensure_matches(5, sent, field="complianceReportId")


def test_body_naming_another_record_is_refused():
    with pytest.raises(HTTPException) as exc:
        ensure_matches(5, 6, field="complianceReportId")
    assert exc.value.status_code == 400
    assert "complianceReportId" in exc.value.detail


@pytest.mark.anyio
async def test_delete_one_scopes_by_every_column():
    db = MagicMock()
    db.execute = AsyncMock(return_value=MagicMock(rowcount=1))

    await delete_one(
        db, FuelSupply, fuel_supply_id=7, compliance_report_id=3, group_uuid="g"
    )

    statement = db.execute.call_args.args[0]
    where = str(statement.whereclause)
    assert "fuel_supply.fuel_supply_id" in where
    assert "fuel_supply.compliance_report_id" in where
    assert "fuel_supply.group_uuid" in where


@pytest.mark.anyio
async def test_delete_one_404s_when_no_row_matches():
    db = MagicMock()
    db.execute = AsyncMock(return_value=MagicMock(rowcount=0))

    with pytest.raises(HTTPException) as exc:
        await delete_one(db, FuelSupply, fuel_supply_id=7, compliance_report_id=3)
    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_delete_one_needs_a_scope():
    with pytest.raises(ValueError):
        await delete_one(MagicMock(), FuelSupply)
