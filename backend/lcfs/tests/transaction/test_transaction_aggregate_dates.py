"""
Dates in mv_transaction_aggregate, read from the migration-built view (#4634).

Effective dates are stored as Pacific calendar dates and read as they are.
History and creation timestamps are timestamptz and are converted to Pacific
once. Every case here came out a day early or a day late under the previous
``AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver'`` expressions.
"""

from datetime import date, datetime, timezone

import pytest
from sqlalchemy import select, text

from lcfs.db.models.admin_adjustment.AdminAdjustment import AdminAdjustment
from lcfs.db.models.admin_adjustment.AdminAdjustmentHistory import (
    AdminAdjustmentHistory,
)
from lcfs.db.models.admin_adjustment.AdminAdjustmentStatus import (
    AdminAdjustmentStatus,
    AdminAdjustmentStatusEnum,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.initiative_agreement.InitiativeAgreementHistory import (
    InitiativeAgreementHistory,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatus,
    InitiativeAgreementStatusEnum,
)
from lcfs.db.models.transaction.TransactionView import TransactionView
from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.transfer.TransferHistory import TransferHistory
from lcfs.db.models.transfer.TransferStatus import TransferStatus, TransferStatusEnum
from lcfs.web.api.credit_ledger.repo import CreditLedgerRepository
from lcfs.web.api.credit_ledger.services import compliance_year_envelope


async def _status_id(dbsession, column, id_column, value) -> int:
    return (
        await dbsession.execute(select(id_column).where(column == value))
    ).scalar_one()


def _transfer(transfer_id, status_id, effective_date, **extra):
    return Transfer(
        transfer_id=transfer_id,
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=datetime(2025, 1, 15),
        transaction_effective_date=effective_date,
        price_per_unit=1.0,
        quantity=100,
        transfer_category_id=1,
        current_status_id=status_id,
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True,
        **extra,
    )


async def _view_rows(dbsession, transaction_type, ids):
    await dbsession.execute(text("REFRESH MATERIALIZED VIEW mv_transaction_aggregate"))
    rows = await dbsession.execute(
        select(TransactionView).where(
            TransactionView.transaction_type == transaction_type,
            TransactionView.transaction_id.in_(ids),
        )
    )
    return {row.transaction_id: row for row in rows.scalars()}


@pytest.mark.anyio
async def test_transfer_dates_are_pacific_calendar_dates(dbsession, add_models):
    recorded_id = await _status_id(
        dbsession,
        TransferStatus.status,
        TransferStatus.transfer_status_id,
        TransferStatusEnum.Recorded,
    )
    await add_models(
        [
            # Recorded April 1, 2025 at 1 PM PDT
            _transfer(880101, recorded_id, datetime(2025, 4, 1)),
            # Recorded December 31, 2025 at 10:30 PM PST, with no effective date
            _transfer(880102, recorded_id, None),
        ]
    )
    await add_models(
        [
            TransferHistory(
                transfer_id=880101,
                transfer_status_id=recorded_id,
                create_date=datetime(2025, 4, 1, 20, 0, tzinfo=timezone.utc),
            ),
            TransferHistory(
                transfer_id=880102,
                transfer_status_id=recorded_id,
                create_date=datetime(2026, 1, 1, 6, 30, tzinfo=timezone.utc),
            ),
        ]
    )

    rows = await _view_rows(dbsession, "Transfer", [880101, 880102])

    assert rows[880101].transaction_effective_date == date(2025, 4, 1)
    assert rows[880101].recorded_date == date(2025, 4, 1)
    assert rows[880101].compliance_period == "2025"
    # With no effective date, the recorded date decides the compliance year
    assert rows[880102].recorded_date == date(2025, 12, 31)
    assert rows[880102].compliance_period == "2025"


@pytest.mark.anyio
async def test_initiative_agreement_and_admin_adjustment_dates(dbsession, add_models):
    ia_approved_id = await _status_id(
        dbsession,
        InitiativeAgreementStatus.status,
        InitiativeAgreementStatus.initiative_agreement_status_id,
        InitiativeAgreementStatusEnum.Approved,
    )
    aa_approved_id = await _status_id(
        dbsession,
        AdminAdjustmentStatus.status,
        AdminAdjustmentStatus.admin_adjustment_status_id,
        AdminAdjustmentStatusEnum.Approved,
    )
    # Effective January 1, 2025, approved that day at 10 AM PST
    await add_models(
        [
            InitiativeAgreement(
                initiative_agreement_id=880201,
                compliance_units=50,
                to_organization_id=1,
                current_status_id=ia_approved_id,
                transaction_effective_date=datetime(2025, 1, 1),
                effective_status=True,
            ),
            AdminAdjustment(
                admin_adjustment_id=880301,
                compliance_units=60,
                to_organization_id=1,
                current_status_id=aa_approved_id,
                transaction_effective_date=datetime(2025, 1, 1),
                effective_status=True,
            ),
        ]
    )
    approved_at = datetime(2025, 1, 1, 18, 0, tzinfo=timezone.utc)
    await add_models(
        [
            InitiativeAgreementHistory(
                initiative_agreement_id=880201,
                initiative_agreement_status_id=ia_approved_id,
                create_date=approved_at,
                effective_status=True,
            ),
            AdminAdjustmentHistory(
                admin_adjustment_id=880301,
                admin_adjustment_status_id=aa_approved_id,
                create_date=approved_at,
                effective_status=True,
            ),
        ]
    )

    ia = (await _view_rows(dbsession, "InitiativeAgreement", [880201]))[880201]
    aa = (await _view_rows(dbsession, "AdminAdjustment", [880301]))[880301]

    for row in (ia, aa):
        assert row.transaction_effective_date == date(2025, 1, 1)
        assert row.approved_date == date(2025, 1, 1)
        assert row.compliance_period == "2025"


@pytest.mark.anyio
async def test_period_envelopes_use_pacific_dates(dbsession, add_models):
    """
    A transfer effective April 1 opens the new compliance year. A pending
    transfer created at 6 PM PDT on March 31 (already April 1 in UTC) still
    belongs to the year that ends that day.
    """
    recorded_id = await _status_id(
        dbsession,
        TransferStatus.status,
        TransferStatus.transfer_status_id,
        TransferStatusEnum.Recorded,
    )
    submitted_id = await _status_id(
        dbsession,
        TransferStatus.status,
        TransferStatus.transfer_status_id,
        TransferStatusEnum.Submitted,
    )
    await add_models(
        [
            _transfer(880401, recorded_id, datetime(2025, 4, 1)),
            _transfer(
                880402,
                submitted_id,
                None,
                create_date=datetime(2025, 4, 1, 1, 0, tzinfo=timezone.utc),
            ),
        ]
    )
    await dbsession.execute(text("REFRESH MATERIALIZED VIEW mv_transaction_aggregate"))

    repo = CreditLedgerRepository(db=dbsession)

    async def ids_in(compliance_period):
        start, end = compliance_year_envelope(compliance_period)
        rows = await repo.get_period_rows(
            organization_id=1,
            compliance_period=compliance_period,
            envelope_start=start,
            envelope_end=end,
        )
        return {row.transaction_id for row, _version in rows}

    ids_2024, ids_2025 = await ids_in(2024), await ids_in(2025)
    assert 880401 in ids_2025 and 880401 not in ids_2024
    assert 880402 in ids_2024 and 880402 not in ids_2025
