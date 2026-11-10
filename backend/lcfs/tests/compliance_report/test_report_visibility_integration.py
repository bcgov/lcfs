"""Report visibility through real repositories, serialization, and API handlers."""

import uuid

import pytest
from sqlalchemy import select

from lcfs.db.models.compliance.ComplianceReport import (
    ComplianceReport,
    SupplementalInitiatorType as I,
)
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatus,
    ComplianceReportStatusEnum as S,
)
from lcfs.db.models.compliance.ComplianceReportOrganizationSnapshot import (
    ComplianceReportOrganizationSnapshot,
)
from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.user.Role import RoleEnum as R


@pytest.fixture
async def visibility_reports(dbsession):
    org = await dbsession.scalar(select(Organization.organization_id).limit(1))
    period = await dbsession.scalar(
        select(CompliancePeriod.compliance_period_id).limit(1)
    )
    statuses = {
        row.status: row.compliance_report_status_id
        for row in (await dbsession.scalars(select(ComplianceReportStatus))).all()
    }
    group = str(uuid.uuid4())
    reports = {}
    for version, (name, status, initiator) in enumerate(
        [
            ("draft", S.Draft, None),
            ("adjustment", S.Analyst_adjustment, I.GOVERNMENT_REASSESSMENT),
            ("pending", S.Recommended_by_analyst, I.GOVERNMENT_REASSESSMENT),
            ("assessed", S.Assessed, I.GOVERNMENT_REASSESSMENT),
            ("exempted", S.Exempted, I.GOVERNMENT_REASSESSMENT),
        ]
    ):
        report = ComplianceReport(
            organization_id=org,
            compliance_period_id=period,
            current_status_id=statuses[status],
            compliance_report_group_uuid=group,
            version=version,
            supplemental_initiator=initiator,
            nickname=name,
            assessment_statement=f"Statement for {name}",
        )
        dbsession.add(report)
        await dbsession.flush()
        reports[name] = report.compliance_report_id
        dbsession.add(
            ComplianceReportOrganizationSnapshot(
                compliance_report_id=report.compliance_report_id,
                name=name,
                is_edited=False,
            )
        )
    await dbsession.commit()
    return org, reports


@pytest.mark.anyio
@pytest.mark.parametrize(
    "actor, expected",
    [
        (R.SUPPLIER, {"draft", "assessed", "exempted"}),
        (R.ANALYST, {"adjustment", "pending", "assessed", "exempted"}),
        (R.COMPLIANCE_MANAGER, {"pending", "assessed", "exempted"}),
        (R.DIRECTOR, {"adjustment", "pending", "assessed", "exempted"}),
    ],
)
async def test_chain_filters_each_version_before_masking(
    client, fastapi_app, set_mock_user, visibility_reports, actor, expected
):
    org, reports = visibility_reports
    roles = [actor, R.COMPLIANCE_REPORTING] if actor == R.SUPPLIER else [actor]
    set_mock_user(fastapi_app, roles, {"organization_id": org})
    path = (
        f"/api/organization/{org}/reports/{reports['exempted']}"
        if actor == R.SUPPLIER
        else f"/api/reports/{reports['exempted']}"
    )
    response = await client.get(path)
    assert response.status_code == 200
    chain = response.json()["chain"]
    assert {r["nickname"] for r in chain} == expected
    assert {r["assessmentStatement"] for r in chain} == {
        f"Statement for {name}" for name in expected
    }


@pytest.mark.anyio
@pytest.mark.parametrize(
    "actor, name",
    [
        (R.SUPPLIER, "adjustment"),
        (R.SUPPLIER, "pending"),
        (R.ANALYST, "draft"),
        (R.COMPLIANCE_MANAGER, "adjustment"),
    ],
)
@pytest.mark.parametrize(
    "method, route",
    [
        ("GET", "/api/organization_snapshot/{id}"),
        ("PUT", "/api/organization_snapshot/{id}"),
        ("GET", "/api/allocation-agreement/export/{id}"),
        ("POST", "/api/allocation-agreement/list"),
        ("POST", "/api/notional-transfers/list"),
        ("GET", "/api/documents/compliance_report/{id}"),
        ("GET", "/api/final-supply-equipments/template/{id}"),
        ("POST", "/api/final-supply-equipments/reporting/list?complianceReportId={id}"),
    ],
)
async def test_alternate_routes_enforce_report_visibility(
    client, fastapi_app, set_mock_user, visibility_reports, actor, name, method, route
):
    org, reports = visibility_reports
    roles = [actor, R.COMPLIANCE_REPORTING] if actor == R.SUPPLIER else [actor]
    set_mock_user(fastapi_app, roles, {"organization_id": org})
    rid = reports[name]
    response = await client.request(
        method,
        route.format(id=rid),
        json={
            "complianceReportId": rid,
            "isEdited": False,
            "page": 1,
            "size": 10,
            "filters": [],
            "sortOrders": [],
        },
    )
    assert response.status_code == 403


@pytest.mark.anyio
@pytest.mark.parametrize(
    "actor,name", [(R.SUPPLIER, "adjustment"), (R.ANALYST, "draft")]
)
async def test_notional_transfer_detail_checks_parent_visibility(
    client, fastapi_app, set_mock_user, dbsession, visibility_reports, actor, name
):
    from lcfs.db.models.compliance.NotionalTransfer import (
        NotionalTransfer,
        ReceivedOrTransferredEnum,
    )
    from lcfs.db.models.fuel.FuelCategory import FuelCategory

    org, reports = visibility_reports
    category = await dbsession.scalar(select(FuelCategory.fuel_category_id).limit(1))
    row = NotionalTransfer(
        compliance_report_id=reports[name],
        fuel_category_id=category,
        legal_name="Visibility marker",
        address_for_service="Test address",
        received_or_transferred=ReceivedOrTransferredEnum.Received,
        quantity=10,
    )
    dbsession.add(row)
    await dbsession.commit()
    roles = [actor, R.COMPLIANCE_REPORTING] if actor == R.SUPPLIER else [actor]
    set_mock_user(fastapi_app, roles, {"organization_id": org})
    response = await client.get(f"/api/notional-transfers/{row.notional_transfer_id}")
    assert response.status_code == 403


@pytest.mark.anyio
async def test_supply_history_excludes_drafts_before_version_selection(
    dbsession, visibility_reports
):
    from lcfs.db.models.compliance.FuelSupply import FuelSupply
    from lcfs.db.models.compliance.ComplianceReport import QuantityUnitsEnum
    from lcfs.db.models.fuel.FuelCategory import FuelCategory
    from lcfs.db.models.fuel.FuelType import FuelType
    from lcfs.db.models.fuel.ProvisionOfTheAct import ProvisionOfTheAct
    from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository

    org, reports = visibility_reports
    category = await dbsession.scalar(select(FuelCategory.fuel_category_id).limit(1))
    fuel = await dbsession.scalar(select(FuelType.fuel_type_id).limit(1))
    provision = await dbsession.scalar(
        select(ProvisionOfTheAct.provision_of_the_act_id).limit(1)
    )
    group = str(uuid.uuid4())
    rows = []
    for version, name in enumerate(["assessed", "draft"]):
        row = FuelSupply(
            compliance_report_id=reports[name],
            fuel_category_id=category,
            fuel_type_id=fuel,
            provision_of_the_act_id=provision,
            units=QuantityUnitsEnum.Litres,
            group_uuid=group,
            version=version,
            quantity=10,
        )
        dbsession.add(row)
        rows.append(row)
    await dbsession.commit()
    repo = FuelSupplyRepository(db=dbsession)
    query = repo._organization_effective_fuel_supply_query(org).where(
        FuelSupply.group_uuid == group
    )
    result = (await dbsession.scalars(query)).unique().all()
    assert [row.fuel_supply_id for row in result] == [rows[0].fuel_supply_id]


@pytest.mark.anyio
@pytest.mark.parametrize(
    "actor,name",
    [
        (R.SUPPLIER, "draft"),
        (R.SUPPLIER, "assessed"),
        (R.ANALYST, "adjustment"),
        (R.COMPLIANCE_MANAGER, "pending"),
    ],
)
async def test_snapshot_keeps_access_for_visible_reports(
    client, fastapi_app, set_mock_user, visibility_reports, actor, name
):
    org, reports = visibility_reports
    set_mock_user(fastapi_app, [actor], {"organization_id": org})
    response = await client.get(f"/api/organization_snapshot/{reports[name]}")
    assert response.status_code == 200
    assert response.json()["name"] == name


@pytest.mark.anyio
@pytest.mark.parametrize(
    "actor,name", [(R.SUPPLIER, "adjustment"), (R.ANALYST, "draft")]
)
@pytest.mark.parametrize(
    "operation", ["create", "delete_batch", "active", "update", "delete", "defaults"]
)
async def test_equipment_writes_reject_hidden_reports_before_mutation(
    client, fastapi_app, set_mock_user, visibility_reports, actor, name, operation
):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, patch

    org, reports = visibility_reports
    set_mock_user(fastapi_app, [actor], {"organization_id": org})
    hidden = reports[name]
    # Existing-record routes must use the stored parent, despite an allowed
    # destination/decoy in the body. New-record routes must inspect row parents.
    visible = reports["draft" if actor == R.SUPPLIER else "adjustment"]
    row = {
        "chargingEquipmentId": 1,
        "complianceReportId": hidden,
        "organizationId": org,
        "supplyFromDate": "2025-01-01",
        "supplyToDate": "2025-12-31",
        "kwhUsage": 100,
    }
    common = {
        "complianceReportId": visible,
        "organizationId": org,
        "reportingIds": [11, 12],
    }
    routes = {
        "create": (
            "POST",
            "/reporting/batch",
            {**common, "fseReports": [{**row, "complianceReportId": visible}, row]},
            "create_fse_reporting_batch",
        ),
        "delete_batch": (
            "DELETE",
            "/reporting/batch",
            common,
            "delete_fse_reporting_batch",
        ),
        "active": (
            "PATCH",
            "/reporting/active-status",
            {**common, "isActive": False},
            "update_fse_reporting_active_status",
        ),
        "update": (
            "PUT",
            "/reporting/12",
            {**row, "complianceReportId": visible},
            "update_fse_reporting",
        ),
        "delete": ("DELETE", "/reporting/12", None, "delete_fse_reporting"),
        "defaults": (
            "POST",
            "/reporting/set-default",
            {**common, "complianceReportId": hidden, "equipmentIds": [1]},
            "set_default_dates_fse_reporting",
        ),
    }
    method, path, payload, service_method = routes[operation]
    with patch(
        "lcfs.web.api.final_supply_equipment.repo.FinalSupplyEquipmentRepository.get_reporting_record_by_id",
        new=AsyncMock(
            side_effect=lambda rid: SimpleNamespace(
                compliance_report_id=visible if rid == 11 else hidden
            )
        ),
    ), patch(
        f"lcfs.web.api.final_supply_equipment.services.FinalSupplyEquipmentServices.{service_method}",
        new=AsyncMock(),
    ) as mutation:
        response = await client.request(
            method, "/api/final-supply-equipments" + path, json=payload
        )
        assert response.status_code == 403, response.text
        mutation.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("operation", ["update", "active"])
async def test_equipment_revision_can_read_assessed_source_into_supplier_draft(
    client, fastapi_app, set_mock_user, visibility_reports, operation
):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, patch

    org, reports = visibility_reports
    set_mock_user(fastapi_app, [R.SUPPLIER], {"organization_id": org})
    payload = {
        "complianceReportId": reports["draft"],
        "organizationId": org,
        "chargingEquipmentId": 1,
        "supplyFromDate": "2025-01-01",
        "supplyToDate": "2025-12-31",
        "reportingIds": [12],
        "isActive": False,
    }
    method, path, service_method = (
        ("PUT", "/reporting/12", "update_fse_reporting")
        if operation == "update"
        else ("PATCH", "/reporting/active-status", "update_fse_reporting_active_status")
    )
    with patch(
        "lcfs.web.api.final_supply_equipment.repo.FinalSupplyEquipmentRepository.get_reporting_record_by_id",
        new=AsyncMock(
            return_value=SimpleNamespace(compliance_report_id=reports["assessed"])
        ),
    ), patch(
        f"lcfs.web.api.final_supply_equipment.services.FinalSupplyEquipmentServices.{service_method}",
        new=AsyncMock(return_value={"updated": 1}),
    ) as mutation:
        response = await client.request(
            method, "/api/final-supply-equipments" + path, json=payload
        )
        assert response.status_code == 200, response.text
        mutation.assert_awaited_once()
