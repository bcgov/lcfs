import structlog
from sqlalchemy import text

logger = structlog.get_logger(__name__)

# Role ids fixed by the role seed migrations:
# 8 TRANSFER, 9 COMPLIANCE_REPORTING, 12 CI_APPLICANT, 13 IA_PROPONENT
TYPE_DEFAULT_ROLES = [
    ("fuel_supplier", 9),
    ("fuel_supplier", 8),
    ("exempted_supplier", 9),
    ("credit_trader", 8),
    ("aggregator", 8),
    ("fuel_producer", 12),
    ("initiative_agreement_holder", 13),
]


async def seed_org_type_and_available_role_associations(session):
    """
    Mirror the #4565 migration backfill for seeded organizations: give each
    organization its legacy single type as an association row, and derive
    available roles from per-type defaults plus the controllable roles its
    seeded users already hold. Idempotent — safe to re-run.
    """
    try:
        await session.execute(
            text(
                """
                INSERT INTO organization_type_association
                    (organization_id, organization_type_id)
                SELECT organization_id, organization_type_id
                FROM organization
                WHERE organization_type_id IS NOT NULL
                ON CONFLICT DO NOTHING;
                """
            )
        )

        values = ", ".join(f"('{t}', {r})" for t, r in TYPE_DEFAULT_ROLES)
        await session.execute(
            text(
                f"""
                INSERT INTO organization_available_role (organization_id, role_id)
                SELECT o.organization_id, m.role_id
                FROM organization o
                JOIN organization_type ot
                    ON ot.organization_type_id = o.organization_type_id
                JOIN (VALUES {values}) AS m(org_type, role_id)
                    ON m.org_type = ot.org_type
                ON CONFLICT DO NOTHING;
                """
            )
        )

        await session.execute(
            text(
                """
                INSERT INTO organization_available_role (organization_id, role_id)
                SELECT DISTINCT up.organization_id, ur.role_id
                FROM user_role ur
                JOIN user_profile up ON up.user_profile_id = ur.user_profile_id
                WHERE up.organization_id IS NOT NULL
                  AND ur.role_id IN (8, 9, 12, 13)
                ON CONFLICT DO NOTHING;
                """
            )
        )
    except Exception as e:
        logger.error(
            "Error occurred while seeding organization type/role associations",
            error=str(e),
            exc_info=e,
        )
        raise
