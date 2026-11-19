"""Regression coverage for supplier versus government response projections."""

from types import SimpleNamespace

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.ci_application.schema import (
    CIApplicationSchema,
    CIApplicationStatusEnum,
    CIApplicationStatusSchema,
    CIApplicationUserSchema,
)
from lcfs.web.api.ci_application.services import _is_idir_user, _mask_ci_internal_fields
from lcfs.web.api.compliance_report.schema import (
    AssignedAnalystSchema,
    ComplianceReportBaseSchema,
    ComplianceReportHistorySchema,
    ComplianceReportStatusSchema,
    ComplianceReportUserSchema,
    ComplianceReportViewSchema,
)
from lcfs.web.api.compliance_report.services import ComplianceReportServices


def test_ci_government_roles_keep_internal_response_fields():
    assert _is_idir_user(SimpleNamespace(role_names=[RoleEnum.ANALYST]))
    assert _is_idir_user(SimpleNamespace(role_names=[RoleEnum.DIRECTOR]))
    assert not _is_idir_user(SimpleNamespace(role_names=[RoleEnum.SUPPLIER]))


def test_supplier_report_snapshot_masks_internal_status_analyst_and_draft_assessment():
    report = ComplianceReportViewSchema(
        compliance_report_id=7,
        compliance_report_group_uuid="group-7",
        version=1,
        compliance_period_id=2025,
        compliance_period="2025",
        organization_id=19,
        organization_name="Supplier Ltd.",
        report_type="Original",
        report_status_id=4,
        report_status="Recommended by manager",
        latest_status="Recommended by manager",
        update_date="2026-01-01T00:00:00Z",
        is_latest=True,
        assessment_statement="Internal draft assessment",
        assigned_analyst=AssignedAnalystSchema(
            user_profile_id=12,
            first_name="Internal",
            last_name="Analyst",
        ),
    )
    supplier = SimpleNamespace(role_names=[RoleEnum.SUPPLIER])
    government = SimpleNamespace(role_names=[RoleEnum.GOVERNMENT])
    service = ComplianceReportServices.__new__(ComplianceReportServices)

    supplier_snapshot = service._mask_report_status([report.model_copy(deep=True)], supplier)[0]
    government_snapshot = service._mask_report_status(
        [report.model_copy(deep=True)], government
    )[0]

    assert supplier_snapshot.report_status == "Submitted"
    assert supplier_snapshot.latest_status == "Submitted"
    assert supplier_snapshot.assessment_statement is None
    assert supplier_snapshot.assigned_analyst is None
    assert government_snapshot.latest_status == "Recommended by manager"
    assert government_snapshot.assessment_statement == "Internal draft assessment"
    assert government_snapshot.assigned_analyst.first_name == "Internal"

    visible_latest_status = report.model_copy(
        update={"report_status": "Submitted", "latest_status": "Assessed"}
    )
    [visible_latest_status] = service._mask_report_status(
        [visible_latest_status], supplier
    )
    assert visible_latest_status.latest_status == "Assessed"


def test_supplier_ci_snapshot_strips_internal_review_fields_but_government_keeps_them():
    government = CIApplicationSchema(
        ci_application_id=3,
        organization_id=19,
        status=CIApplicationStatusSchema(
            ci_application_status_id=2,
            status=CIApplicationStatusEnum.Submitted,
        ),
        preliminary_risk_assessment="High",
        priority_score=17,
        assigned_analyst=CIApplicationUserSchema(
            user_profile_id=12,
            first_name="Internal",
            last_name="Analyst",
        ),
        verification_1_date="2026-01-01T00:00:00Z",
        verification_2_priority_score=22,
    )

    supplier = _mask_ci_internal_fields(government)
    supplier_snapshot = supplier.model_dump(by_alias=True)
    government_snapshot = government.model_dump(by_alias=True)

    assert supplier_snapshot["preliminaryRiskAssessment"] is None
    assert supplier_snapshot["priorityScore"] is None
    assert supplier_snapshot["assignedAnalyst"] is None
    assert supplier_snapshot["verification1Date"] is None
    assert supplier_snapshot["verification2PriorityScore"] is None
    assert government_snapshot["preliminaryRiskAssessment"] == "High"
    assert government_snapshot["priorityScore"] == 17
    assert government_snapshot["assignedAnalyst"]["firstName"] == "Internal"


def test_supplier_report_history_snapshot_masks_nested_idir_names():
    history = ComplianceReportHistorySchema(
        compliance_report_history_id=1,
        compliance_report_id=7,
        status=ComplianceReportStatusSchema(
            compliance_report_status_id=1,
            status="Draft",
        ),
        user_profile=ComplianceReportUserSchema(
            first_name="Internal",
            last_name="Analyst",
        ),
        display_name="Internal Analyst",
        create_date="2026-01-01T00:00:00Z",
    )
    report = ComplianceReportBaseSchema.model_construct(history=[history])
    supplier = SimpleNamespace(role_names=[RoleEnum.SUPPLIER])
    government = SimpleNamespace(role_names=[RoleEnum.GOVERNMENT])
    service = ComplianceReportServices.__new__(ComplianceReportServices)

    supplier_snapshot = service._mask_report_status_for_history(
        report.model_copy(deep=True), supplier
    )
    government_snapshot = service._mask_report_status_for_history(
        report.model_copy(deep=True), government
    )

    assert supplier_snapshot.history[0].display_name == "Government of British Columbia"
    assert supplier_snapshot.history[0].user_profile.first_name == "Government"
    assert "Internal" not in str(supplier_snapshot.model_dump())
    assert government_snapshot.history[0].user_profile.first_name == "Internal"
