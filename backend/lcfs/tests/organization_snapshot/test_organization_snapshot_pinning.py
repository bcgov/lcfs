"""
A report's organization snapshot stays attached to the report in the path, and
is editable only while the report is open to the caller.

- A body naming another report is rejected (400); the stored link never moves.
- Suppliers edit it on a Draft. IDIR analysts edit it on a Submitted report
  (#2515) or their Analyst adjustment. Every other status is read-only (403).
- The database holds at most one snapshot per report.

These run against the database through the API.
"""

from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from lcfs.db.models.compliance.ComplianceReportOrganizationSnapshot import (
    ComplianceReportOrganizationSnapshot,
)
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatusEnum,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.geocoder.dependency import get_geocoder_service_async
from lcfs.tests.compliance_report.report_write_seed import (
    organization_ids,
    seed_report,
    seed_snapshot,
)

Status = ComplianceReportStatusEnum


class _NoGeocoder:
    async def forward_geocode(self, *args, **kwargs):
        return SimpleNamespace(success=False, address=None)


@pytest.fixture(autouse=True)
def no_geocoding(fastapi_app: FastAPI):
    fastapi_app.dependency_overrides[get_geocoder_service_async] = _NoGeocoder
    yield
    fastapi_app.dependency_overrides.pop(get_geocoder_service_async, None)


@pytest.fixture
async def org_ids(dbsession):
    return await organization_ids(dbsession)


async def _report_with_snapshot(dbsession, add_models, organization_id, status, name):
    report = await seed_report(dbsession, add_models, organization_id, status)
    snapshot = await seed_snapshot(add_models, report.compliance_report_id, name)
    return report, snapshot


async def _snapshots_of(dbsession, compliance_report_id):
    return (
        (
            await dbsession.execute(
                select(ComplianceReportOrganizationSnapshot)
                .where(
                    ComplianceReportOrganizationSnapshot.compliance_report_id
                    == compliance_report_id
                )
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    )


def _body(compliance_report_id, name):
    return {
        "complianceReportId": compliance_report_id,
        "isEdited": True,
        "name": name,
        "operatingName": name,
        "email": "org@example.com",
        "phone": "250-555-0100",
        "headOfficeAddress": "1 Test Street, Victoria, BC",
        "recordsAddress": "1 Test Street, Victoria, BC",
        "serviceAddress": "1 Test Street, Victoria, BC",
    }


def _sign_in_supplier(fastapi_app, set_mock_user, organization_id):
    set_mock_user(
        fastapi_app,
        [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY],
        {"organization_id": organization_id},
    )


def _sign_in_analyst(fastapi_app, set_mock_user):
    set_mock_user(fastapi_app, [RoleEnum.ANALYST], {"organization_id": None})


async def _put(client, fastapi_app, compliance_report_id, body):
    return await client.put(
        fastapi_app.url_path_for(
            "update_compliance_report_snapshot",
            compliance_report_id=compliance_report_id,
        ),
        json=body,
    )


@pytest.mark.anyio
async def test_body_naming_another_report_is_rejected_and_nothing_moves(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    set_mock_user,
    org_ids,
):
    own_report, _ = await _report_with_snapshot(
        dbsession, add_models, org_ids[0], Status.Draft, "Own organization"
    )
    other_report, _ = await _report_with_snapshot(
        dbsession, add_models, org_ids[1], Status.Draft, "Other organization"
    )
    _sign_in_supplier(fastapi_app, set_mock_user, org_ids[0])

    response = await _put(
        client,
        fastapi_app,
        own_report.compliance_report_id,
        _body(other_report.compliance_report_id, "Moved"),
    )

    assert response.status_code == 400
    own = await _snapshots_of(dbsession, own_report.compliance_report_id)
    other = await _snapshots_of(dbsession, other_report.compliance_report_id)
    assert [s.name for s in own] == ["Own organization"]
    assert [s.name for s in other] == ["Other organization"]


@pytest.mark.anyio
async def test_supplier_edits_own_draft_snapshot(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    set_mock_user,
    org_ids,
):
    report, _ = await _report_with_snapshot(
        dbsession, add_models, org_ids[0], Status.Draft, "Before"
    )
    _sign_in_supplier(fastapi_app, set_mock_user, org_ids[0])

    response = await _put(
        client,
        fastapi_app,
        report.compliance_report_id,
        _body(report.compliance_report_id, "After"),
    )

    assert response.status_code == 200
    [snapshot] = await _snapshots_of(dbsession, report.compliance_report_id)
    assert snapshot.name == "After"
    assert snapshot.is_edited is True


@pytest.mark.anyio
@pytest.mark.parametrize(
    "status",
    [Status.Submitted, Status.Analyst_adjustment, Status.Assessed],
)
async def test_supplier_cannot_edit_snapshot_after_draft(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    set_mock_user,
    org_ids,
    status,
):
    report, _ = await _report_with_snapshot(
        dbsession, add_models, org_ids[0], status, "Locked"
    )
    _sign_in_supplier(fastapi_app, set_mock_user, org_ids[0])

    response = await _put(
        client,
        fastapi_app,
        report.compliance_report_id,
        _body(report.compliance_report_id, "Changed"),
    )

    assert response.status_code == 403
    [snapshot] = await _snapshots_of(dbsession, report.compliance_report_id)
    assert snapshot.name == "Locked"


@pytest.mark.anyio
@pytest.mark.parametrize("status", [Status.Submitted, Status.Analyst_adjustment])
async def test_analyst_edits_snapshot_while_reviewing(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    set_mock_user,
    org_ids,
    status,
):
    report, _ = await _report_with_snapshot(
        dbsession, add_models, org_ids[0], status, "Before"
    )
    _sign_in_analyst(fastapi_app, set_mock_user)

    response = await _put(
        client,
        fastapi_app,
        report.compliance_report_id,
        _body(report.compliance_report_id, "Corrected by analyst"),
    )

    assert response.status_code == 200
    [snapshot] = await _snapshots_of(dbsession, report.compliance_report_id)
    assert snapshot.name == "Corrected by analyst"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "status", [Status.Recommended_by_analyst, Status.Assessed, Status.Rejected]
)
async def test_analyst_cannot_edit_snapshot_after_review(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    set_mock_user,
    org_ids,
    status,
):
    report, _ = await _report_with_snapshot(
        dbsession, add_models, org_ids[0], status, "Locked"
    )
    _sign_in_analyst(fastapi_app, set_mock_user)

    response = await _put(
        client,
        fastapi_app,
        report.compliance_report_id,
        _body(report.compliance_report_id, "Changed"),
    )

    assert response.status_code == 403
    [snapshot] = await _snapshots_of(dbsession, report.compliance_report_id)
    assert snapshot.name == "Locked"


@pytest.mark.anyio
async def test_a_report_has_at_most_one_snapshot(dbsession, add_models, org_ids):
    report, _ = await _report_with_snapshot(
        dbsession, add_models, org_ids[0], Status.Draft, "First"
    )

    with pytest.raises(IntegrityError):
        async with dbsession.begin_nested():
            dbsession.add(
                ComplianceReportOrganizationSnapshot(
                    compliance_report_id=report.compliance_report_id,
                    name="Second",
                    is_edited=False,
                )
            )
            await dbsession.flush()

    count = await dbsession.scalar(
        select(func.count()).where(
            ComplianceReportOrganizationSnapshot.compliance_report_id
            == report.compliance_report_id
        )
    )
    assert count == 1
