from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

from lcfs.db.models.compliance.ComplianceReport import ComplianceReport, ReportingFrequency
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary


def make_report(
    version: int,
    status=ComplianceReportStatusEnum.Submitted,
    description="2025",
    nickname=None,
    reporting_frequency=ReportingFrequency.ANNUAL,
):
    report = MagicMock(spec=ComplianceReport)
    report.version = version
    report.current_status = MagicMock(status=status)
    report.nickname = nickname or f"v{version}"
    report.compliance_report_id = 100 + version
    report.organization_id = 1
    report.compliance_report_group_uuid = "group-uuid"
    report.reporting_frequency = reporting_frequency
    year_str = description if isinstance(description, str) else str(description)
    report.compliance_period = SimpleNamespace(
        description=description,
        effective_date=datetime(int(year_str), 1, 1),
        expiration_date=datetime(int(year_str), 12, 31),
    )
    return report


def make_summary(
    line6=0,
    line7=0,
    line8=0,
    line9=0,
    line18=0,
    line19=0,
    line20=0,
    locked=False,
):
    return ComplianceReportSummary(
        line_6_renewable_fuel_retained_gasoline=line6,
        line_6_renewable_fuel_retained_diesel=line6,
        line_6_renewable_fuel_retained_jet_fuel=line6,
        line_7_previously_retained_gasoline=line7,
        line_7_previously_retained_diesel=line7,
        line_7_previously_retained_jet_fuel=line7,
        line_8_obligation_deferred_gasoline=line8,
        line_8_obligation_deferred_diesel=line8,
        line_8_obligation_deferred_jet_fuel=line8,
        line_9_obligation_added_gasoline=line9,
        line_9_obligation_added_diesel=line9,
        line_9_obligation_added_jet_fuel=line9,
        line_18_units_to_be_banked=line18,
        line_19_units_to_be_exported=line19,
        line_20_surplus_deficit_units=line20,
        is_locked=locked,
    )
