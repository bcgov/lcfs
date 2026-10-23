"""
FSE rows on the report page and in the Excel FSE sheet, read from the real
views for each version of a report (#5132).

Both read vw_fse_base, which holds only the latest non-Draft version of each
report group. A Draft or an older version shows that latest submitted
version's rows; a report with no submitted version shows none.
"""

import uuid
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import select, text

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
    LevelOfEquipment,
)
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatusEnum,
)
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.compliance_report.schema import FSE_EXPORT_COLUMNS
from lcfs.web.api.compliance_report.sheet_exporters.fse import FSESheetExporter
from lcfs.web.api.final_supply_equipment.repo import FinalSupplyEquipmentRepository

SUBMITTED_SERIAL = "SN-5132-SUBMITTED"
DRAFT_ONLY_SERIAL = "SN-5132-DRAFT-ONLY"
SUBMITTED_KWH = 1000.0

# Submitted group: v0 superseded by v1, v1 the latest non-Draft, v2 a Draft.
VERSION_STATUSES = [
    ComplianceReportStatusEnum.Assessed,
    ComplianceReportStatusEnum.Submitted,
    ComplianceReportStatusEnum.Draft,
]
VERSION_IDS = ["superseded", "latest-submitted", "draft"]
LATEST_SUBMITTED = 1


async def _id(dbsession, id_column, column, value) -> int:
    return (
        await dbsession.execute(select(id_column).where(column == value))
    ).scalar_one()


async def _report_group(dbsession, organization_id, year, statuses):
    period_id = await _id(
        dbsession,
        CompliancePeriod.compliance_period_id,
        CompliancePeriod.description,
        year,
    )
    group_uuid = str(uuid.uuid4())
    reports = []
    for version, status in enumerate(statuses):
        reports.append(
            ComplianceReport(
                compliance_period_id=period_id,
                organization_id=organization_id,
                compliance_report_group_uuid=group_uuid,
                version=version,
                reporting_frequency=ReportingFrequency.ANNUAL,
                current_status_id=await _id(
                    dbsession,
                    ComplianceReportStatus.compliance_report_status_id,
                    ComplianceReportStatus.status,
                    status,
                ),
            )
        )
    return reports


def _selection(equipment, report, version, kwh_usage, year):
    return ComplianceReportChargingEquipment(
        charging_equipment_id=equipment.charging_equipment_id,
        charging_equipment_version=equipment.version,
        compliance_report_id=report.compliance_report_id,
        compliance_report_group_uuid=report.compliance_report_group_uuid,
        organization_id=report.organization_id,
        version=version,
        supply_from_date=datetime(year, 1, 1),
        supply_to_date=datetime(year, 12, 31),
        kwh_usage=kwh_usage,
        is_active=True,
    )


@pytest.fixture
async def report_versions(dbsession, add_models):
    organization_id = (
        await dbsession.execute(
            select(Organization.organization_id)
            .order_by(Organization.organization_id)
            .limit(1)
        )
    ).scalar_one()

    site = ChargingSite(
        organization_id=organization_id,
        status_id=await _id(
            dbsession,
            ChargingSiteStatus.charging_site_status_id,
            ChargingSiteStatus.status,
            "Validated",
        ),
        site_code="T5132",
        site_name="Report versions site",
        street_address="1 Test Street",
        city="Victoria",
        postal_code="V8V 1A1",
    )
    await add_models([site])

    equipment_status_id = await _id(
        dbsession,
        ChargingEquipmentStatus.charging_equipment_status_id,
        ChargingEquipmentStatus.status,
        "Validated",
    )
    level_id = (
        await dbsession.execute(select(LevelOfEquipment.level_of_equipment_id).limit(1))
    ).scalar_one()
    submitted_equipment, draft_only_equipment = [
        ChargingEquipment(
            charging_site_id=site.charging_site_id,
            status_id=equipment_status_id,
            equipment_number=number,
            serial_number=serial,
            manufacturer="Test manufacturer",
            level_of_equipment_id=level_id,
        )
        for number, serial in (("001", SUBMITTED_SERIAL), ("002", DRAFT_ONLY_SERIAL))
    ]
    await add_models([submitted_equipment, draft_only_equipment])

    reports = await _report_group(dbsession, organization_id, "2024", VERSION_STATUSES)
    (draft_only_report,) = await _report_group(
        dbsession, organization_id, "2025", [ComplianceReportStatusEnum.Draft]
    )
    await add_models([*reports, draft_only_report])

    await add_models(
        [
            # Selected and submitted on the original report.
            _selection(submitted_equipment, reports[0], 0, SUBMITTED_KWH, 2024),
            # Selected on a report that has never been submitted.
            _selection(draft_only_equipment, draft_only_report, 0, 500.0, 2025),
        ]
    )
    await dbsession.execute(
        text("REFRESH MATERIALIZED VIEW mv_fse_reporting_base_pref")
    )

    return SimpleNamespace(
        organization_id=organization_id,
        reports=reports,
        draft_only_report=draft_only_report,
    )


async def _summary_rows(dbsession, organization_id, report_id):
    repo = FinalSupplyEquipmentRepository(db=dbsession)
    rows, _ = await repo.get_fse_reporting_list_paginated(
        organization_id,
        PaginationRequestSchema(page=1, size=100, filters=[], sort_orders=[]),
        report_id,
        "summary",
        source="vw_fse_base",
    )
    total = await repo.get_total_kwh_usage_for_report(
        organization_id, report_id, "summary", source="vw_fse_base"
    )
    return rows, total


async def _export_rows(dbsession, report, is_government):
    cr_repo = MagicMock()
    cr_repo.get_compliance_report_by_id = AsyncMock(
        return_value=SimpleNamespace(
            compliance_report_group_uuid=report.compliance_report_group_uuid,
            organization_id=report.organization_id,
            organization=SimpleNamespace(
                name="Test organization", organization_id=report.organization_id
            ),
        )
    )
    exporter = FSESheetExporter(FinalSupplyEquipmentRepository(db=dbsession), cr_repo)
    headers, *rows = await exporter.load_legacy(
        report.compliance_report_id, False, is_government
    )
    assert headers == [col.label for col in FSE_EXPORT_COLUMNS]
    serial_index = headers.index("Serial #")
    kwh_index = headers.index("kWh usage")
    return [(row[serial_index], row[kwh_index]) for row in rows]


@pytest.mark.anyio
@pytest.mark.parametrize("version", range(len(VERSION_STATUSES)), ids=VERSION_IDS)
async def test_report_page_shows_latest_submitted_version(
    dbsession, report_versions, version
):
    latest_id = report_versions.reports[LATEST_SUBMITTED].compliance_report_id

    rows, total = await _summary_rows(
        dbsession,
        report_versions.organization_id,
        report_versions.reports[version].compliance_report_id,
    )

    assert [
        (row.serial_number, row.compliance_report_id, row.kwh_usage) for row in rows
    ] == [(SUBMITTED_SERIAL, latest_id, SUBMITTED_KWH)]
    assert total == SUBMITTED_KWH


@pytest.mark.anyio
@pytest.mark.parametrize("is_government", [True, False], ids=["idir", "bceid"])
@pytest.mark.parametrize("version", range(len(VERSION_STATUSES)), ids=VERSION_IDS)
async def test_excel_fse_sheet_exports_latest_submitted_version(
    dbsession, report_versions, version, is_government
):
    rows = await _export_rows(
        dbsession, report_versions.reports[version], is_government
    )

    assert rows == [(SUBMITTED_SERIAL, SUBMITTED_KWH)]


@pytest.mark.anyio
@pytest.mark.parametrize("is_government", [True, False], ids=["idir", "bceid"])
async def test_never_submitted_report_shows_no_fse(
    dbsession, report_versions, is_government
):
    report = report_versions.draft_only_report

    rows, total = await _summary_rows(
        dbsession, report_versions.organization_id, report.compliance_report_id
    )

    assert rows == []
    assert total == 0
    assert await _export_rows(dbsession, report, is_government) == []
