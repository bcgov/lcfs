"""The dev seeder must insert agreement-kind rows and be idempotent —
seed_database runs it on every startup of a dev stack."""

import pytest
from sqlalchemy import func, select

from lcfs.db.models.initiative_agreement import DesignatedAction
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    RECORD_KIND_AGREEMENT,
    InitiativeAgreement,
)
from lcfs.db.seeders.dev.initiative_agreement_seeder import (
    seed_initiative_agreements,
)


@pytest.mark.anyio
async def test_dev_seeder_inserts_agreements_and_is_idempotent(dbsession):
    await seed_initiative_agreements(dbsession)
    await seed_initiative_agreements(dbsession)

    codes = ("IA-26DEV1", "IA-26DEV2", "IA-25DEV3")
    agreements = (
        (
            await dbsession.execute(
                select(InitiativeAgreement).where(
                    InitiativeAgreement.ia_code.in_(codes)
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(agreements) == 3
    assert all(a.record_kind == RECORD_KIND_AGREEMENT for a in agreements)
    assert all(a.lifecycle_status_id is not None for a in agreements)

    first = next(a for a in agreements if a.ia_code == "IA-26DEV1")
    action_count = (
        await dbsession.execute(
            select(func.count())
            .select_from(DesignatedAction)
            .where(
                DesignatedAction.initiative_agreement_id
                == first.initiative_agreement_id
            )
        )
    ).scalar_one()
    assert action_count == 3
