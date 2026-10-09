"""
Data corrections in migration c4d6e8f0a2b5 (#4634), run against real rows.

Legacy transfers stored the UTC instant they were recorded. Initiative
agreements and admin adjustments approved with a blank effective date were
stamped with the UTC date. Both must hold Pacific calendar dates before the
transaction views read them as such.
"""

import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import select, text

from lcfs.db.models.admin_adjustment.AdminAdjustment import AdminAdjustment
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.transfer.TransferStatus import TransferStatus, TransferStatusEnum

MIGRATION_REVISION = "c4d6e8f0a2b5"
MIGRATION_VERSIONS_PATH = (
    Path(__file__).resolve().parents[2] / "db" / "migrations" / "versions"
)


def _load_migration():
    (migration_path,) = MIGRATION_VERSIONS_PATH.glob(f"*_{MIGRATION_REVISION}.py")
    spec = importlib.util.spec_from_file_location(
        "effective_date_migration", migration_path
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def _dates(dbsession, table, pk, ids):
    rows = await dbsession.execute(
        text(
            f"SELECT {pk}, transaction_effective_date FROM {table} "
            f"WHERE {pk} = ANY(:ids)"
        ),
        {"ids": ids},
    )
    return dict(rows.all())


@pytest.mark.anyio
async def test_legacy_transfer_instants_become_pacific_dates(dbsession, add_models):
    migration = _load_migration()
    recorded_id = (
        await dbsession.execute(
            select(TransferStatus.transfer_status_id).where(
                TransferStatus.status == TransferStatusEnum.Recorded
            )
        )
    ).scalar_one()

    def transfer(transfer_id, effective_date):
        return Transfer(
            transfer_id=transfer_id,
            from_organization_id=1,
            to_organization_id=2,
            agreement_date=datetime(2025, 1, 15),
            transaction_effective_date=effective_date,
            price_per_unit=1.0,
            quantity=100,
            transfer_category_id=1,
            current_status_id=recorded_id,
            recommendation=TransferRecommendationEnum.Record,
            effective_status=True,
        )

    await add_models(
        [
            # Recorded March 31, 2026 at 5:30 PM PDT: the UTC instant is April 1
            transfer(880501, datetime(2026, 4, 1, 0, 30, 15, 123456)),
            # Recorded June 10, 2025 at 11:05 AM PDT: same day in both zones
            transfer(880502, datetime(2025, 6, 10, 18, 5, 0, 1)),
            # Recorded December 31, 2025 at 4:30 PM PST
            transfer(880503, datetime(2026, 1, 1, 0, 30, 0, 42)),
            # Already Pacific calendar dates (TFRS and v1.3.1+), or no date yet
            transfer(880504, datetime(2026, 5, 4)),
            transfer(880505, None),
        ]
    )

    await dbsession.execute(text(migration.NORMALIZE_TRANSFER_EFFECTIVE_DATES))

    assert await _dates(
        dbsession, "transfer", "transfer_id", [880501, 880502, 880503, 880504, 880505]
    ) == {
        880501: datetime(2026, 3, 31),
        880502: datetime(2025, 6, 10),
        880503: datetime(2025, 12, 31),
        880504: datetime(2026, 5, 4),
        880505: None,
    }


async def _audit_update(dbsession, table, row_id, *, at, old, new):
    await dbsession.execute(
        text(
            "INSERT INTO audit_log "
            "(table_name, operation, row_id, old_values, new_values, create_date) "
            "VALUES (:table, 'UPDATE', CAST(:row_id AS jsonb), CAST(:old AS jsonb), "
            "CAST(:new AS jsonb), :at)"
        ),
        {
            "table": table,
            "row_id": json.dumps(row_id),
            "old": json.dumps(old),
            "new": json.dumps(new),
            "at": at,
        },
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "model, table, pk, fix",
    [
        (
            InitiativeAgreement,
            "initiative_agreement",
            "initiative_agreement_id",
            "FIX_INITIATIVE_AGREEMENT_DATES",
        ),
        (
            AdminAdjustment,
            "admin_adjustment",
            "admin_adjustment_id",
            "FIX_ADMIN_ADJUSTMENT_DATES",
        ),
    ],
)
async def test_blank_date_approvals_get_the_pacific_approval_date(
    dbsession, add_models, model, table, pk, fix
):
    migration = _load_migration()
    april_1 = datetime(2026, 4, 1)
    await add_models(
        [
            model(
                **{pk: row_id},
                compliance_units=10,
                to_organization_id=1,
                transaction_effective_date=effective_date,
                effective_status=True,
            )
            for row_id, effective_date in (
                (880601, april_1),
                (880602, april_1),
                (880603, april_1),
                (880604, datetime(2026, 4, 2)),
            )
        ]
    )

    stamped = "2026-04-01T00:00:00"
    evening = datetime(2026, 4, 1, 0, 30, tzinfo=timezone.utc)  # 5:30 PM PDT, Mar 31
    afternoon = datetime(2026, 4, 1, 20, 0, tzinfo=timezone.utc)  # 1 PM PDT, Apr 1
    approval_fills = {
        "old": {"transaction_effective_date": None, "transaction_id": None},
        "new": {"transaction_effective_date": stamped, "transaction_id": 42},
    }
    # Approved March 31 at 5:30 PM PDT with a blank date: stamped April 1 (UTC)
    await _audit_update(dbsession, table, 880601, at=evening, **approval_fills)
    # Approved April 1 at 1 PM PDT: the UTC stamp is already the Pacific date
    await _audit_update(dbsession, table, 880602, at=afternoon, **approval_fills)
    # Analyst entered April 1 on a draft in the evening. No transaction yet,
    # so this is not the approval stamp and the date is kept.
    await _audit_update(
        dbsession,
        table,
        880603,
        at=evening,
        old={"transaction_effective_date": None, "transaction_id": None},
        new={"transaction_effective_date": stamped, "transaction_id": None},
    )
    # Stamped in the evening, then edited to April 2 after approval: kept
    await _audit_update(dbsession, table, 880604, at=evening, **approval_fills)

    await dbsession.execute(text(getattr(migration, fix)))

    assert await _dates(dbsession, table, pk, [880601, 880602, 880603, 880604]) == {
        880601: datetime(2026, 3, 31),
        880602: datetime(2026, 4, 1),
        880603: datetime(2026, 4, 1),
        880604: datetime(2026, 4, 2),
    }
