"""
FSE rows for a Draft or superseded report version, read from the real views.

The report-page FSE table and the Excel FSE sheet read
mv_fse_reporting_base_pref with the summary filter. They used to read
vw_fse_base, which keeps only the latest non-Draft version of each report
group, so a Draft or an older version showed and exported no FSE rows
(#5132, #5168).
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

SERIAL_NUMBER = "SN-5132-VERSIONS"
KWH_USAGE = 1234.0

# One report group: v0 superseded by v1, v1 the latest non-Draft, v2 a Draft.
VERSION_STATUSES = [
    ComplianceReportStatusEnum.Assessed,
    ComplianceReportStatusEnum.Submitted,
    ComplianceReportStatusEnum.Draft,
]
VERSION_IDS = ["superseded", "latest-submitted", "draft"]


async def _id(dbsession, id_column, column, value) -> int:
    return (
        await dbsession.execute(select(id_column).where(column == value))
    ).scalar_one()


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

    equipment = ChargingEquipment(
        charging_site_id=site.charging_site_id,
        status_id=await _id(
            dbsession,
            ChargingEquipmentStatus.charging_equipment_status_id,
            ChargingEquipmentStatus.status,
            "Validated",
        ),
        equipment_number="001",
        serial_number=SERIAL_NUMBER,
        manufacturer="Test manufacturer",
        level_of_equipment_id=(
            await dbsession.execute(
                select(LevelOfEquipment.level_of_equipment_id).limit(1)
            )
        ).scalar_one(),
    )
    await add_models([equipment])

    period_id = await _id(
        dbsession,
        CompliancePeriod.compliance_period_id,
        CompliancePeriod.description,
        "2024",
    )
    group_uuid = str(uuid.uuid4())
    reports = []
    for version, status in enumerate(VERSION_STATUSES):
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
    await add_models(reports)

    # Selected on the original report; every version of the group shares it.
    await add_models(
        [
            ComplianceReportChargingEquipment(
                charging_equipment_id=equipment.charging_equipment_id,
                charging_equipment_version=equipment.version,
                compliance_report_id=reports[0].compliance_report_id,
                compliance_report_group_uuid=group_uuid,
                organization_id=organization_id,
                supply_from_date=datetime(2024, 1, 1),
                supply_to_date=datetime(2024, 12, 31),
                kwh_usage=KWH_USAGE,
                is_active=True,
            )
        ]
    )
    await dbsession.execute(
        text("REFRESH MATERIALIZED VIEW mv_fse_reporting_base_pref")
    )

    return SimpleNamespace(organization_id=organization_id, reports=reports)


@pytest.mark.anyio
@pytest.mark.parametrize("version", range(len(VERSION_STATUSES)), ids=VERSION_IDS)
async def test_summary_list_and_total_include_every_report_version(
    dbsession, report_versions, version
):
    """The report-page FSE table and its kWh total (source base_pref)."""
    repo = FinalSupplyEquipmentRepository(db=dbsession)
    report_id = report_versions.reports[version].compliance_report_id

    rows, _ = await repo.get_fse_reporting_list_paginated(
        report_versions.organization_id,
        PaginationRequestSchema(page=1, size=100, filters=[], sort_orders=[]),
        report_id,
        "summary",
    )
    total = await repo.get_total_kwh_usage_for_report(
        report_versions.organization_id, report_id, "summary"
    )

    assert [row.kwh_usage for row in rows if row.serial_number == SERIAL_NUMBER] == [
        KWH_USAGE
    ]
    assert total == KWH_USAGE


@pytest.mark.anyio
@pytest.mark.parametrize("is_government", [True, False], ids=["idir", "bceid"])
@pytest.mark.parametrize("version", range(len(VERSION_STATUSES)), ids=VERSION_IDS)
async def test_excel_fse_sheet_exports_every_report_version(
    dbsession, report_versions, version, is_government
):
    report = report_versions.reports[version]
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
    assert [row[kwh_index] for row in rows if row[serial_index] == SERIAL_NUMBER] == [
        KWH_USAGE
    ]
