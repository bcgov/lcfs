"""Authorization of actual source reports and requested destinations."""

from types import SimpleNamespace as NS
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from lcfs.db.models.user.Role import RoleEnum as R
from lcfs.web.api.final_supply_equipment.validation import (
    FinalSupplyEquipmentValidation,
)


def validator(roles, reports, records=None):
    user = NS(role_names=roles, organization=NS(organization_id=1))
    repo = AsyncMock()
    repo.get_compliance_report_schema_by_id.side_effect = reports.get
    fse = AsyncMock()
    fse.get_reporting_record_by_id.side_effect = (records or {}).get
    return FinalSupplyEquipmentValidation(
        request=NS(user=user), report_repo=repo, fse_repo=fse
    )


def report(status="Draft", org=1):
    return NS(
        organization_id=org,
        current_status=NS(status=status),
        supplemental_initiator=None,
    )


@pytest.mark.anyio
@pytest.mark.parametrize("operation", ["create", "record"])
async def test_foreign_report_is_forbidden(operation):
    validation = validator(
        [R.SUPPLIER], {1: report(), 2: report(org=2)}, {10: NS(compliance_report_id=2)}
    )
    with pytest.raises(HTTPException) as exc:
        await validation.validate_reporting_write(
            report_ids=[1, 2] if operation == "create" else [1],
            reporting_ids=[10] if operation == "record" else [],
        )
    assert exc.value.status_code == 403


@pytest.mark.anyio
async def test_missing_record_is_404():
    validation = validator([R.SUPPLIER], {})
    with pytest.raises(HTTPException) as exc:
        await validation.validate_reporting_write(reporting_ids=[999])
    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_visible_assessed_source_can_be_copied_to_editable_supplemental():
    validation = validator(
        [R.SUPPLIER],
        {1: report(), 2: report("Assessed")},
        {10: NS(compliance_report_id=2)},
    )
    await validation.validate_reporting_write(
        report_ids=[1], reporting_ids=[10], source_editable=False
    )


@pytest.mark.anyio
@pytest.mark.parametrize("status", ["Submitted", "Assessed", "Exempted"])
async def test_visible_but_noneditable_report_cannot_be_mutated(status):
    validation = validator([R.SUPPLIER], {1: report(status)})
    with pytest.raises(HTTPException) as exc:
        await validation.validate_reporting_write(report_ids=[1])
    assert exc.value.status_code == 403


@pytest.mark.anyio
async def test_editable_supplier_and_analyst_reports_remain_allowed():
    for roles, status in [
        ([R.SUPPLIER], "Draft"),
        ([R.GOVERNMENT, R.ANALYST], "Analyst adjustment"),
    ]:
        validation = validator(
            roles, {1: report(status)}, {10: NS(compliance_report_id=1)}
        )
        await validation.validate_reporting_write(report_ids=[1], reporting_ids=[10])
