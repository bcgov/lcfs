import structlog
from datetime import date

from sqlalchemy import select

from lcfs.db.models.initiative_agreement.DesignatedAction import DesignatedAction
from lcfs.db.models.initiative_agreement.DesignatedActionStatus import (
    DesignatedActionStatus,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    RECORD_KIND_AGREEMENT,
    InitiativeAgreement,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementLifecycleStatus import (
    InitiativeAgreementLifecycleStatus,
)

logger = structlog.get_logger(__name__)


async def _lifecycle_status_id(session, status):
    return (
        await session.execute(
            select(
                InitiativeAgreementLifecycleStatus.initiative_agreement_lifecycle_status_id
            ).where(InitiativeAgreementLifecycleStatus.status == status)
        )
    ).scalar_one()


async def _action_status_id(session, status):
    return (
        await session.execute(
            select(DesignatedActionStatus.designated_action_status_id).where(
                DesignatedActionStatus.status == status
            )
        )
    ).scalar_one()


async def seed_initiative_agreements(session):
    """
    Seeds agreement-kind initiative agreements with designated actions, if
    they do not already exist. Legacy award rows are untouched; these rows
    carry record_kind='agreement' so the module's grids can render locally
    before the consolidation backfill runs.
    """

    agreements_to_seed = [
        {
            "ia_code": "IA-26DEV1",
            "to_organization_id": 1,
            "record_kind": RECORD_KIND_AGREEMENT,
            "lifecycle_status": "Underway",
            "title": "Hydrogen fueling network expansion",
            "project_description": (
                "Construction and commissioning of hydrogen fueling stations "
                "in the Lower Mainland with associated production capacity."
            ),
            "entry_date": date(2026, 1, 15),
            "agreement_start_date": date(2026, 6, 19),
            "agreement_end_date": date(2027, 5, 3),
            "total_credits_allocated": 30234,
            "actions": [
                {
                    "action_number": 1,
                    "name": "Commission first fueling station",
                    "credit_allocation": 1850,
                    "status": "Underway",
                    "specified_date": date(2026, 9, 30),
                },
                {
                    "action_number": 2,
                    "name": "Commission second fueling station",
                    "credit_allocation": 1075,
                    "status": "Not started",
                    "specified_date": date(2027, 1, 31),
                },
                {
                    "action_number": 3,
                    "name": "Commission electrolysis production facility",
                    "credit_allocation": 27309,
                    "status": "Not started",
                    "specified_date": date(2027, 4, 30),
                },
            ],
        },
        {
            "ia_code": "IA-26DEV2",
            "to_organization_id": 2,
            "record_kind": RECORD_KIND_AGREEMENT,
            "lifecycle_status": "Draft",
            "title": "Renewable diesel co-processing upgrade",
            "project_description": (
                "Refinery upgrades enabling co-processing of renewable "
                "feedstock. Agreement drafting is underway."
            ),
            "entry_date": date(2026, 3, 2),
            "total_credits_allocated": 12000,
            "actions": [],
        },
        {
            "ia_code": "IA-25DEV3",
            "to_organization_id": 3,
            "record_kind": RECORD_KIND_AGREEMENT,
            "lifecycle_status": "Completed",
            "title": "Public DC fast-charging corridor",
            "project_description": (
                "Deployment of DC fast-charging sites along Highway 97, "
                "completed and verified."
            ),
            "entry_date": date(2025, 2, 10),
            "agreement_start_date": date(2025, 4, 1),
            "agreement_end_date": date(2026, 3, 31),
            "total_credits_allocated": 5400,
            "total_credits_issued": 5400,
            "actions": [
                {
                    "action_number": 1,
                    "name": "Energize all corridor sites",
                    "credit_allocation": 5400,
                    "status": "Approved",
                    "specified_date": date(2026, 1, 31),
                    "completed_date": date(2026, 1, 20),
                    "determination": "Compliant",
                    "determination_date": date(2026, 2, 14),
                },
            ],
        },
    ]

    try:
        for agreement_data in agreements_to_seed:
            exists = (
                (
                    await session.execute(
                        select(InitiativeAgreement).where(
                            InitiativeAgreement.ia_code == agreement_data["ia_code"]
                        )
                    )
                )
                .scalars()
                .first()
            )
            if exists:
                continue

            actions = agreement_data.pop("actions")
            lifecycle_status = agreement_data.pop("lifecycle_status")
            agreement = InitiativeAgreement(
                **agreement_data,
                lifecycle_status_id=await _lifecycle_status_id(
                    session, lifecycle_status
                ),
            )
            session.add(agreement)
            await session.flush()

            for action_data in actions:
                action_status = action_data.pop("status")
                session.add(
                    DesignatedAction(
                        **action_data,
                        initiative_agreement_id=agreement.initiative_agreement_id,
                        current_status_id=await _action_status_id(
                            session, action_status
                        ),
                    )
                )
        await session.flush()
    except Exception as e:
        logger.error("Error occurred while seeding initiative agreements: %s", e)
        raise
