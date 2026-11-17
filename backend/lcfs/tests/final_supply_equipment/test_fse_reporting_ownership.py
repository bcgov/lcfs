"""
FSE reporting writes and the legacy FSE /save act only on the records of the
report the caller was validated for.

A record, equipment or FSE row ID from another organization or report reads as
missing (404) and changes nothing. Report and organization IDs in the body are
checked against the validated report, never trusted to place a record, and
every reporting write needs a report the caller may edit.

These run against the database through the API, so they exercise the real
lookups and scoping rather than mocks.
"""

import uuid
from datetime import date
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import func, select

from lcfs.db.models import Organization
from lcfs.db.models.compliance import (
    ChargingEquipment,
    ChargingEquipmentStatus,
    ChargingSite,
    ChargingSiteStatus,
    CompliancePeriod,
    ComplianceReport,
    ComplianceReportChargingEquipment,
    ComplianceReportStatus,
    FinalSupplyEquipment,
    LevelOfEquipment,
)
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatusEnum,
)
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.db.models.compliance.EndUserType import EndUserType
from lcfs.db.models.user.Role import RoleEnum

YEAR = 2025
RECORD_KWH = 100.0


async def _scalar(dbsession, stmt):
    return (await dbsession.execute(stmt)).scalar_one()


async def _id_by(dbsession, id_column, column, value) -> int:
    return await _scalar(dbsession, select(id_column).where(column == value))


async def _seed_org_report(
    dbsession,
    add_models,
    organization_id: int,
    tag: str,
    status: ComplianceReportStatusEnum = ComplianceReportStatusEnum.Draft,
):
    """One organization's site, two pieces of equipment, a report with a
    reporting record for the first piece, and a legacy FSE row."""
    level = (await dbsession.execute(select(LevelOfEquipment).limit(1))).scalar_one()

    site = ChargingSite(
        organization_id=organization_id,
        status_id=await _id_by(
            dbsession,
            ChargingSiteStatus.charging_site_status_id,
            ChargingSiteStatus.status,
            "Validated",
        ),
        site_code=f"S{tag}"[:5],
        site_name=f"Ownership site {tag}",
        street_address="1 Test Street",
        city="Victoria",
        postal_code="V8V 1A1",
    )
    await add_models([site])

    equipment_status_id = await _id_by(
        dbsession,
        ChargingEquipmentStatus.charging_equipment_status_id,
        ChargingEquipmentStatus.status,
        "Validated",
    )
    equipment, spare_equipment = [
        ChargingEquipment(
            charging_site_id=site.charging_site_id,
            status_id=equipment_status_id,
            equipment_number=number,
            serial_number=f"SN-{tag}-{number}",
            manufacturer="Test manufacturer",
            level_of_equipment_id=level.level_of_equipment_id,
        )
        for number in ("001", "002")
    ]
    await add_models([equipment, spare_equipment])

    report = ComplianceReport(
        compliance_period_id=await _id_by(
            dbsession,
            CompliancePeriod.compliance_period_id,
            CompliancePeriod.description,
            str(YEAR),
        ),
        organization_id=organization_id,
        compliance_report_group_uuid=str(uuid.uuid4()),
        version=0,
        reporting_frequency=ReportingFrequency.ANNUAL,
        current_status_id=await _id_by(
            dbsession,
            ComplianceReportStatus.compliance_report_status_id,
            ComplianceReportStatus.status,
            status,
        ),
    )
    await add_models([report])

    record = ComplianceReportChargingEquipment(
        charging_equipment_id=equipment.charging_equipment_id,
        charging_equipment_version=equipment.version,
        compliance_report_id=report.compliance_report_id,
        compliance_report_group_uuid=report.compliance_report_group_uuid,
        organization_id=organization_id,
        version=0,
        supply_from_date=date(YEAR, 1, 1),
        supply_to_date=date(YEAR, 12, 31),
        kwh_usage=RECORD_KWH,
        is_active=True,
    )
    fse_row = FinalSupplyEquipment(
        compliance_report_id=report.compliance_report_id,
        supply_from_date=date(YEAR, 1, 1),
        supply_to_date=date(YEAR, 12, 31),
        kwh_usage=RECORD_KWH,
        registration_nbr=f"REG-{tag}-001",
        serial_nbr=f"FSE-{tag}",
        manufacturer="Test manufacturer",
        level_of_equipment_id=level.level_of_equipment_id,
        street_address="1 Test Street",
        city="Victoria",
        postal_code="V8V 1A1",
        latitude=48.4,
        longitude=-123.3,
    )
    await add_models([record, fse_row])

    return SimpleNamespace(
        organization_id=organization_id,
        site=site,
        equipment=equipment,
        spare_equipment=spare_equipment,
        report=report,
        record=record,
        fse_row=fse_row,
        level_name=level.name,
    )


@pytest.fixture
async def org_ids(dbsession):
    rows = (
        (
            await dbsession.execute(
                select(Organization.organization_id)
                .order_by(Organization.organization_id)
                .limit(2)
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 2, "the pytest seed needs two organizations"
    return rows


@pytest.fixture
async def own(dbsession, add_models, org_ids):
    return await _seed_org_report(dbsession, add_models, org_ids[0], "OWN")


@pytest.fixture
async def other(dbsession, add_models, org_ids):
    return await _seed_org_report(dbsession, add_models, org_ids[1], "OTH")


@pytest.fixture
def as_supplier(fastapi_app: FastAPI, set_mock_user, org_ids):
    """Sign the client in as a supplier of the first organization."""

    def _sign_in():
        set_mock_user(
            fastapi_app,
            [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY],
            {"organization_id": org_ids[0]},
        )

    return _sign_in


async def _record(dbsession, record_id):
    """The record as the database has it now (the API shares this session)."""
    return (
        await dbsession.execute(
            select(ComplianceReportChargingEquipment)
            .where(
                ComplianceReportChargingEquipment.charging_equipment_compliance_id
                == record_id
            )
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()


async def _record_count(dbsession, compliance_report_id):
    return await _scalar(
        dbsession,
        select(func.count()).where(
            ComplianceReportChargingEquipment.compliance_report_id
            == compliance_report_id
        ),
    )


async def _all_record_count(dbsession):
    return await _scalar(
        dbsession,
        select(
            func.count(
                ComplianceReportChargingEquipment.charging_equipment_compliance_id
            )
        ),
    )


def _reporting_body(report_ns, equipment, **overrides):
    body = {
        "chargingEquipmentId": equipment.charging_equipment_id,
        "chargingEquipmentVersion": equipment.version,
        "complianceReportId": report_ns.report.compliance_report_id,
        "complianceReportGroupUuid": report_ns.report.compliance_report_group_uuid,
        "organizationId": report_ns.organization_id,
        "supplyFromDate": f"{YEAR}-01-01",
        "supplyToDate": f"{YEAR}-12-31",
        "kwhUsage": 999.0,
    }
    body.update(overrides)
    return body


# --- PUT /reporting/{reporting_id} -------------------------------------------


@pytest.mark.anyio
async def test_update_other_org_record_returns_404_and_changes_nothing(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()
    records_before = await _all_record_count(dbsession)

    url = fastapi_app.url_path_for(
        "update_fse_reporting",
        reporting_id=other.record.charging_equipment_compliance_id,
    )
    response = await client.put(url, json=_reporting_body(own, own.equipment))

    assert response.status_code == 404
    record = await _record(dbsession, other.record.charging_equipment_compliance_id)
    assert record.kwh_usage == RECORD_KWH
    assert record.compliance_report_id == other.report.compliance_report_id
    assert await _all_record_count(dbsession) == records_before


@pytest.mark.anyio
async def test_update_through_other_org_report_is_rejected(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()

    url = fastapi_app.url_path_for(
        "update_fse_reporting",
        reporting_id=other.record.charging_equipment_compliance_id,
    )
    response = await client.put(url, json=_reporting_body(other, other.equipment))

    assert response.status_code == 403
    record = await _record(dbsession, other.record.charging_equipment_compliance_id)
    assert record.kwh_usage == RECORD_KWH


@pytest.mark.anyio
async def test_update_body_organization_must_match_report(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()

    url = fastapi_app.url_path_for(
        "update_fse_reporting", reporting_id=own.record.charging_equipment_compliance_id
    )
    response = await client.put(
        url,
        json=_reporting_body(own, own.equipment, organizationId=other.organization_id),
    )

    assert response.status_code == 400
    record = await _record(dbsession, own.record.charging_equipment_compliance_id)
    assert record.kwh_usage == RECORD_KWH
    assert record.organization_id == own.organization_id


@pytest.mark.anyio
async def test_update_own_record_still_saves(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()

    url = fastapi_app.url_path_for(
        "update_fse_reporting", reporting_id=own.record.charging_equipment_compliance_id
    )
    response = await client.put(url, json=_reporting_body(own, own.equipment))

    assert response.status_code == 200
    record = await _record(dbsession, own.record.charging_equipment_compliance_id)
    assert record.kwh_usage == 999.0


@pytest.mark.anyio
async def test_analyst_can_update_record_on_report_in_adjustment(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    set_mock_user,
    org_ids,
):
    """Government staff are not tied to the report's organization."""
    adjusting = await _seed_org_report(
        dbsession,
        add_models,
        org_ids[1],
        "ADJ",
        ComplianceReportStatusEnum.Analyst_adjustment,
    )
    set_mock_user(fastapi_app, [RoleEnum.ANALYST], {"organization_id": None})

    url = fastapi_app.url_path_for(
        "update_fse_reporting",
        reporting_id=adjusting.record.charging_equipment_compliance_id,
    )
    response = await client.put(
        url, json=_reporting_body(adjusting, adjusting.equipment)
    )

    assert response.status_code == 200
    record = await _record(dbsession, adjusting.record.charging_equipment_compliance_id)
    assert record.kwh_usage == 999.0


# --- DELETE /reporting/{reporting_id} ----------------------------------------


@pytest.mark.anyio
async def test_delete_other_org_record_returns_404_and_keeps_it(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()

    url = fastapi_app.url_path_for(
        "delete_fse_reporting",
        reporting_id=other.record.charging_equipment_compliance_id,
    )
    response = await client.delete(url)

    assert response.status_code == 404
    assert await _record(dbsession, other.record.charging_equipment_compliance_id)


@pytest.mark.anyio
async def test_delete_record_of_submitted_report_is_refused(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    as_supplier,
    org_ids,
):
    submitted = await _seed_org_report(
        dbsession,
        add_models,
        org_ids[0],
        "SUB",
        ComplianceReportStatusEnum.Submitted,
    )
    as_supplier()

    url = fastapi_app.url_path_for(
        "delete_fse_reporting",
        reporting_id=submitted.record.charging_equipment_compliance_id,
    )
    response = await client.delete(url)

    assert response.status_code == 403
    assert await _record(dbsession, submitted.record.charging_equipment_compliance_id)


# --- DELETE /reporting/batch -------------------------------------------------


@pytest.mark.anyio
async def test_batch_delete_with_other_org_record_deletes_nothing(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()

    url = fastapi_app.url_path_for("delete_fse_reporting_batch")
    response = await client.request(
        "DELETE",
        url,
        json={
            "reportingIds": [
                own.record.charging_equipment_compliance_id,
                other.record.charging_equipment_compliance_id,
            ],
            "complianceReportId": own.report.compliance_report_id,
            "organizationId": own.organization_id,
        },
    )

    assert response.status_code == 404
    assert await _record(dbsession, own.record.charging_equipment_compliance_id)
    assert await _record(dbsession, other.record.charging_equipment_compliance_id)


@pytest.mark.anyio
async def test_batch_delete_own_records_still_deletes(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()

    url = fastapi_app.url_path_for("delete_fse_reporting_batch")
    response = await client.request(
        "DELETE",
        url,
        json={
            "reportingIds": [own.record.charging_equipment_compliance_id],
            "complianceReportId": own.report.compliance_report_id,
            "organizationId": own.organization_id,
        },
    )

    assert response.status_code == 200
    assert await _record(dbsession, own.record.charging_equipment_compliance_id) is None
    assert await _record(dbsession, other.record.charging_equipment_compliance_id)


# --- PATCH /reporting/active-status ------------------------------------------


@pytest.mark.anyio
async def test_active_status_with_other_org_record_returns_404(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()
    records_before = await _all_record_count(dbsession)

    url = fastapi_app.url_path_for("update_fse_reporting_active_status")
    response = await client.patch(
        url,
        json={
            "reportingIds": [other.record.charging_equipment_compliance_id],
            "isActive": False,
            "complianceReportId": own.report.compliance_report_id,
            "organizationId": own.organization_id,
        },
    )

    assert response.status_code == 404
    record = await _record(dbsession, other.record.charging_equipment_compliance_id)
    assert record.is_active is True
    assert await _all_record_count(dbsession) == records_before


@pytest.mark.anyio
async def test_active_status_own_record_still_toggles(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()

    url = fastapi_app.url_path_for("update_fse_reporting_active_status")
    response = await client.patch(
        url,
        json={
            "reportingIds": [own.record.charging_equipment_compliance_id],
            "isActive": False,
            "complianceReportId": own.report.compliance_report_id,
            "organizationId": own.organization_id,
        },
    )

    assert response.status_code == 200
    record = await _record(dbsession, own.record.charging_equipment_compliance_id)
    assert record.is_active is False


# --- POST /reporting/batch ---------------------------------------------------


@pytest.mark.anyio
async def test_create_with_other_org_equipment_returns_404(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()
    records_before = await _all_record_count(dbsession)

    url = fastapi_app.url_path_for("create_fse_reporting")
    response = await client.post(
        url,
        json={
            "fseReports": [_reporting_body(own, other.spare_equipment)],
            "complianceReportId": own.report.compliance_report_id,
            "organizationId": own.organization_id,
        },
    )

    assert response.status_code == 404
    assert await _all_record_count(dbsession) == records_before


@pytest.mark.anyio
async def test_create_into_other_org_report_is_rejected(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()
    records_before = await _all_record_count(dbsession)

    url = fastapi_app.url_path_for("create_fse_reporting")
    response = await client.post(
        url,
        json={
            "fseReports": [_reporting_body(other, other.spare_equipment)],
            "complianceReportId": other.report.compliance_report_id,
            "organizationId": other.organization_id,
        },
    )

    assert response.status_code == 403
    assert await _all_record_count(dbsession) == records_before


@pytest.mark.anyio
async def test_create_row_naming_another_report_is_rejected(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    """The outer report is the caller's, but a row names another one."""
    as_supplier()
    records_before = await _all_record_count(dbsession)

    url = fastapi_app.url_path_for("create_fse_reporting")
    response = await client.post(
        url,
        json={
            "fseReports": [
                _reporting_body(
                    own,
                    own.spare_equipment,
                    complianceReportId=other.report.compliance_report_id,
                    organizationId=other.organization_id,
                )
            ],
            "complianceReportId": own.report.compliance_report_id,
            "organizationId": own.organization_id,
        },
    )

    assert response.status_code == 400
    assert await _all_record_count(dbsession) == records_before


@pytest.mark.anyio
async def test_create_takes_report_and_version_from_the_database(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()

    url = fastapi_app.url_path_for("create_fse_reporting")
    response = await client.post(
        url,
        json={
            "fseReports": [
                _reporting_body(
                    own,
                    own.spare_equipment,
                    chargingEquipmentVersion=own.spare_equipment.version + 7,
                    chargingEquipmentComplianceId=other.record.charging_equipment_compliance_id,
                )
            ],
            "complianceReportId": own.report.compliance_report_id,
            "organizationId": own.organization_id,
        },
    )

    assert response.status_code == 201
    (created_id,) = [row["id"] for row in response.json()["data"]]
    assert created_id != other.record.charging_equipment_compliance_id
    created = await _record(dbsession, created_id)
    assert created.compliance_report_id == own.report.compliance_report_id
    assert created.organization_id == own.organization_id
    assert (
        created.compliance_report_group_uuid == own.report.compliance_report_group_uuid
    )
    assert created.charging_equipment_version == own.spare_equipment.version


@pytest.mark.anyio
async def test_create_on_submitted_report_is_refused(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    as_supplier,
    org_ids,
):
    submitted = await _seed_org_report(
        dbsession,
        add_models,
        org_ids[0],
        "SUB",
        ComplianceReportStatusEnum.Submitted,
    )
    as_supplier()

    url = fastapi_app.url_path_for("create_fse_reporting")
    response = await client.post(
        url,
        json={
            "fseReports": [_reporting_body(submitted, submitted.spare_equipment)],
            "complianceReportId": submitted.report.compliance_report_id,
            "organizationId": submitted.organization_id,
        },
    )

    assert response.status_code == 403
    assert await _record_count(dbsession, submitted.report.compliance_report_id) == 1


# --- POST /reporting/set-default ---------------------------------------------


@pytest.mark.anyio
async def test_set_default_dates_on_submitted_report_is_refused(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    as_supplier,
    org_ids,
):
    submitted = await _seed_org_report(
        dbsession,
        add_models,
        org_ids[0],
        "SUB",
        ComplianceReportStatusEnum.Submitted,
    )
    as_supplier()

    url = fastapi_app.url_path_for("set_default_dates_fse_reporting")
    response = await client.post(
        url,
        json={
            "equipmentIds": [submitted.equipment.charging_equipment_id],
            "complianceReportId": submitted.report.compliance_report_id,
            "organizationId": submitted.organization_id,
            "supplyFromDate": f"{YEAR}-03-01",
            "supplyToDate": f"{YEAR}-03-31",
        },
    )

    assert response.status_code == 403
    record = await _record(dbsession, submitted.record.charging_equipment_compliance_id)
    assert record.supply_from_date.date() == date(YEAR, 1, 1)


# --- POST /save (legacy FSE) -------------------------------------------------


async def _fse_save_body(dbsession, report_ns, fse_row, **overrides):
    use_type = await _scalar(dbsession, select(EndUseType.type).limit(1))
    user_type = await _scalar(dbsession, select(EndUserType.type_name).limit(1))
    body = {
        "finalSupplyEquipmentId": fse_row.final_supply_equipment_id,
        "complianceReportId": report_ns.report.compliance_report_id,
        "organizationName": "Test organization",
        "supplyFromDate": f"{YEAR}-01-01",
        "supplyToDate": f"{YEAR}-12-31",
        "kwhUsage": 5.0,
        "serialNbr": "CHANGED-SERIAL",
        "manufacturer": "Changed manufacturer",
        "levelOfEquipment": report_ns.level_name,
        "intendedUseTypes": [use_type],
        "intendedUserTypes": [user_type],
        "streetAddress": "2 Test Street",
        "city": "Victoria",
        "postalCode": "V8V 1A1",
        "latitude": 48.4,
        "longitude": -123.3,
    }
    body.update(overrides)
    return body


async def _fse_row(dbsession, fse_id):
    return (
        await dbsession.execute(
            select(FinalSupplyEquipment)
            .where(FinalSupplyEquipment.final_supply_equipment_id == fse_id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()


@pytest.mark.anyio
async def test_save_cannot_delete_fse_row_of_another_report(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()

    url = fastapi_app.url_path_for("save_final_supply_equipment_row")
    response = await client.post(
        url,
        json=await _fse_save_body(dbsession, own, other.fse_row, deleted=True),
    )

    assert response.status_code == 404
    assert await _fse_row(dbsession, other.fse_row.final_supply_equipment_id)


@pytest.mark.anyio
async def test_save_cannot_update_fse_row_of_another_report(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()

    url = fastapi_app.url_path_for("save_final_supply_equipment_row")
    response = await client.post(
        url, json=await _fse_save_body(dbsession, own, other.fse_row)
    )

    assert response.status_code == 404
    row = await _fse_row(dbsession, other.fse_row.final_supply_equipment_id)
    assert row.serial_nbr == "FSE-OTH"
    assert row.compliance_report_id == other.report.compliance_report_id


@pytest.mark.anyio
async def test_save_still_deletes_own_fse_row(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, as_supplier, own, other
):
    as_supplier()

    url = fastapi_app.url_path_for("save_final_supply_equipment_row")
    response = await client.post(
        url,
        json=await _fse_save_body(dbsession, own, own.fse_row, deleted=True),
    )

    assert response.status_code == 201
    assert await _fse_row(dbsession, own.fse_row.final_supply_equipment_id) is None
    assert await _fse_row(dbsession, other.fse_row.final_supply_equipment_id)
