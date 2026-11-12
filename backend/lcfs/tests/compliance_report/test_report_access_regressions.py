"""Authorization regressions for report updates and report-ID routes."""

from types import SimpleNamespace as NS
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from lcfs.db.models.compliance.ComplianceReport import SupplementalInitiatorType as I
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatusEnum as S,
)
from lcfs.db.models.user.Role import RoleEnum as R
from lcfs.web.api.compliance_report import views
from lcfs.web.api.compliance_report.schema import ComplianceReportUpdateSchema
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.update_service import ComplianceReportUpdateService
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation

FIELDS = (
    "assessment_statement",
    "is_non_assessment",
    "is_renewable_fuel_exempted",
    "is_low_carbon_fuel_exempted",
)


def user(*roles):
    return NS(role_names=list(roles), organization_id=1)


def report(status=S.Draft, initiator=None):
    return NS(
        current_status=NS(status=status),
        supplemental_initiator=initiator,
        organization_id=1,
        supplemental_note="Keep note",
        assessment_statement="Keep statement",
    )


@pytest.mark.anyio
@pytest.mark.parametrize("field", FIELDS)
@pytest.mark.parametrize("value", [None, False, True])
async def test_supplier_cannot_supply_assessment_fields(field, value):
    stored = report()
    service = ComplianceReportUpdateService(repo=AsyncMock())
    service._check_report_exists = AsyncMock(return_value=stored)
    data = ComplianceReportUpdateSchema(
        status=S.Draft.value,
        **{
            field: (
                str(value)
                if field == "assessment_statement" and value is not None
                else value
            )
        }
    )
    with pytest.raises(HTTPException) as exc:
        await service.update_compliance_report(
            1, data, user(R.SUPPLIER, R.COMPLIANCE_REPORTING)
        )
    assert exc.value.status_code == 403
    service.repo.update_compliance_report.assert_not_awaited()
    assert stored.supplemental_note == "Keep note"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "text", [{}, {"supplemental_note": None, "assessment_statement": None}]
)
async def test_text_fields_preserved_unless_explicitly_set(text):
    stored = report(S.Submitted)
    repo = AsyncMock()
    repo.get_compliance_report_status_by_desc.return_value = stored.current_status
    service = ComplianceReportUpdateService(repo=repo)
    service._check_report_exists = AsyncMock(return_value=stored)
    await service.update_compliance_report(
        1,
        ComplianceReportUpdateSchema(status=S.Submitted.value, **text),
        user(R.GOVERNMENT, R.ANALYST),
    )
    assert stored.supplemental_note == (None if text else "Keep note")
    assert stored.assessment_statement == (None if text else "Keep statement")


@pytest.mark.anyio
@pytest.mark.parametrize(
    "function",
    [
        views.get_compliance_report_schedule_overview,
        views.get_compliance_report_year_navigation,
        views.get_compliance_report_summary,
        views.update_compliance_report_penalty_status,
        views.update_compliance_report,
        views.export_compliance_report,
    ],
)
async def test_report_routes_check_access_before_work(function):
    validation = AsyncMock()
    stored = report()
    validation.validate_organization_access.return_value = stored
    validation.validate_compliance_report_access.side_effect = HTTPException(403)
    kwargs = dict(request=NS(), report_id=1, validate=validation)
    if function == views.update_compliance_report:
        kwargs["report_data"] = ComplianceReportUpdateSchema(status=S.Draft.value)
    if function == views.update_compliance_report_penalty_status:
        kwargs["status_data"] = NS()
    with pytest.raises(HTTPException) as exc:
        await function.__wrapped__(**kwargs)
    assert exc.value.status_code == 403
    validation.validate_compliance_report_access.assert_awaited_once_with(stored)


@pytest.mark.anyio
@pytest.mark.parametrize(
    "status,initiator",
    [
        (S.Draft, I.GOVERNMENT_INITIATED),
        (S.Analyst_adjustment, I.GOVERNMENT_REASSESSMENT),
        (S.Draft, I.GOVERNMENT_REASSESSMENT),
    ],
)
async def test_supplier_cannot_delete_government_work(status, initiator):
    repo = AsyncMock()
    repo.get_compliance_report_by_id.return_value = report(status, initiator)
    service = ComplianceReportServices(request=NS(), repo=repo)
    with pytest.raises(HTTPException) as exc:
        await service.delete_compliance_report(
            1, user(R.SUPPLIER, R.COMPLIANCE_REPORTING)
        )
    assert exc.value.status_code == 403
    repo.delete_compliance_report.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "roles,status,initiator",
    [
        ((R.GOVERNMENT, R.ANALYST), S.Draft, None),
        ((R.SUPPLIER,), S.Analyst_adjustment, I.GOVERNMENT_REASSESSMENT),
        ((R.SUPPLIER,), S.Recommended_by_analyst, I.GOVERNMENT_REASSESSMENT),
        ((R.SUPPLIER,), S.Recommended_by_manager, I.GOVERNMENT_REASSESSMENT),
    ],
)
@pytest.mark.parametrize("schema_values", [False, True])
async def test_inaccessible_versions(roles, status, initiator, schema_values):
    if schema_values:
        status = status.value
        initiator = initiator.value if initiator else None
    validation = ComplianceReportValidation(request=NS(user=user(*roles)))
    with pytest.raises(HTTPException) as exc:
        await validation.validate_compliance_report_access(report(status, initiator))
    assert exc.value.status_code == 403


def test_manager_cannot_save_analyst_adjustment():
    from lcfs.web.api.compliance_report.workflow import ensure_report_transition

    with pytest.raises(HTTPException) as exc:
        ensure_report_transition(
            user(R.GOVERNMENT, R.COMPLIANCE_MANAGER),
            report(S.Analyst_adjustment),
            S.Analyst_adjustment.value,
        )
    assert exc.value.status_code == 403


@pytest.mark.anyio
async def test_changelog_filters_versions_before_loading_schedules():
    import sqlite3
    from unittest.mock import MagicMock
    from sqlalchemy.dialects import sqlite
    from lcfs.db.models.compliance import FuelSupply
    from lcfs.web.api.compliance_report.repo import ComplianceReportRepository

    db = AsyncMock()
    db.execute.return_value = MagicMock()
    db.execute.return_value.scalars.return_value.unique.return_value.all.return_value = (
        []
    )
    repo = ComplianceReportRepository(db=db)
    supplier = user(R.SUPPLIER)
    supplier.user_roles = []
    supplier.user_profile_id = 1
    supplier.keycloak_username = "supplier"
    await repo.get_changelog_data(
        "group", {"model": FuelSupply, "dto": None, "relationships": []}, supplier
    )
    predicate = str(
        db.execute.call_args.args[0].whereclause.compile(
            dialect=sqlite.dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    connection = sqlite3.connect(":memory:")
    try:
        connection.executescript("""
            CREATE TABLE compliance_report (
                compliance_report_id INTEGER, compliance_report_group_uuid TEXT,
                current_status_id INTEGER, supplemental_initiator TEXT);
            CREATE TABLE compliance_report_status (
                compliance_report_status_id INTEGER, status TEXT);
            CREATE TABLE fuel_supply (compliance_report_id INTEGER);
        """)
        statuses = list(S)
        for index, status in enumerate(statuses):
            connection.execute(
                "INSERT INTO compliance_report_status VALUES (?, ?)",
                (index, status.name),
            )
        expected = []
        identifier = 0
        for status_id, status in enumerate(statuses):
            for initiator in (
                None,
                I.SUPPLIER_SUPPLEMENTAL,
                I.GOVERNMENT_INITIATED,
                I.GOVERNMENT_REASSESSMENT,
            ):
                identifier += 1
                connection.execute(
                    "INSERT INTO compliance_report VALUES (?, 'group', ?, ?)",
                    (identifier, status_id, initiator.name if initiator else None),
                )
                connection.execute("INSERT INTO fuel_supply VALUES (?)", (identifier,))
                if status != S.Analyst_adjustment and (
                    initiator != I.GOVERNMENT_REASSESSMENT
                    or status in (S.Assessed, S.Exempted)
                ):
                    expected.append(identifier)
        actual = connection.execute(
            "SELECT compliance_report_id FROM compliance_report WHERE " + predicate
        ).fetchall()
        assert [row[0] for row in actual] == expected
    finally:
        connection.close()
