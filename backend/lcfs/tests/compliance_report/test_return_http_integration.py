"""Exercise a return through the HTTP route and real database services."""

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from lcfs.db.models.compliance import (
    CompliancePeriod,
    ComplianceReport,
    ComplianceReportHistory,
    ComplianceReportStatus,
)
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.transaction.Transaction import Transaction, TransactionActionEnum
from lcfs.db.models.user.Role import RoleEnum


@pytest.mark.anyio
@pytest.mark.parametrize(
    "action, expected_status",
    [
        (TransactionActionEnum.Reserved, 200),
        (TransactionActionEnum.Adjustment, 409),
    ],
)
async def test_return_to_supplier_through_http_preserves_ledger_and_history(
    client, fastapi_app, set_mock_user, dbsession, action, expected_status
):
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])
    period_id = await dbsession.scalar(
        select(CompliancePeriod.compliance_period_id).limit(1)
    )
    submitted_id = await dbsession.scalar(
        select(ComplianceReportStatus.compliance_report_status_id).where(
            ComplianceReportStatus.status == ComplianceReportStatusEnum.Submitted
        )
    )
    draft_id = await dbsession.scalar(
        select(ComplianceReportStatus.compliance_report_status_id).where(
            ComplianceReportStatus.status == ComplianceReportStatusEnum.Draft
        )
    )
    transaction = Transaction(
        organization_id=1, compliance_units=-1, transaction_action=action
    )
    dbsession.add(transaction)
    await dbsession.flush()
    transaction_id = transaction.transaction_id
    report = ComplianceReport(
        organization_id=1,
        compliance_period_id=period_id,
        current_status_id=submitted_id,
        transaction_id=transaction_id,
    )
    dbsession.add(report)
    await dbsession.flush()
    report_id = report.compliance_report_id
    initial = ComplianceReportHistory(
        compliance_report_id=report_id,
        status_id=draft_id,
        user_profile_id=1,
        display_name="Initial author",
        is_return=False,
    )
    dbsession.add(initial)
    await dbsession.flush()
    original_history_id = initial.compliance_report_history_id

    with patch(
        "lcfs.web.api.compliance_report.update_service.ComplianceReportUpdateService._perform_notification_call",
        new_callable=AsyncMock,
    ):
        response = await client.put(
            fastapi_app.url_path_for("update_compliance_report", report_id=report_id),
            json={"status": "Return to supplier"},
        )

    assert response.status_code == expected_status, response.text
    await dbsession.refresh(report)
    entries = (
        await dbsession.scalars(
            select(ComplianceReportHistory).where(
                ComplianceReportHistory.compliance_report_id == report_id,
                ComplianceReportHistory.status_id == draft_id,
            )
        )
    ).all()
    if action == TransactionActionEnum.Reserved:
        assert response.json()["report"]["currentStatus"]["status"] == "Draft"
        assert any(entry["isReturn"] for entry in response.json()["report"]["history"])
        assert report.transaction_id is None
        assert await dbsession.get(Transaction, transaction_id) is None
        assert len(entries) == 2
        assert {entry.compliance_report_history_id for entry in entries} >= {
            original_history_id
        }
        assert sorted(entry.is_return for entry in entries) == [False, True]
    else:
        assert report.current_status_id == submitted_id
        assert report.transaction_id == transaction_id
        assert (
            await dbsession.get(Transaction, transaction_id)
        ).transaction_action == action
        assert [entry.compliance_report_history_id for entry in entries] == [
            original_history_id
        ]
