"""Seed local Keycloak test identities and their LCFS role profiles."""

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.user.Role import Role, RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.UserRole import UserRole

logger = structlog.get_logger(__name__)


LOCAL_ROLE_USERS = [
    ("idir-government", "idir", RoleEnum.GOVERNMENT),
    ("idir-administrator", "idir", RoleEnum.ADMINISTRATOR),
    ("idir-system-admin", "idir", RoleEnum.SYSTEM_ADMIN),
    ("idir-analyst", "idir", RoleEnum.ANALYST),
    ("idir-compliance-manager", "idir", RoleEnum.COMPLIANCE_MANAGER),
    ("idir-director", "idir", RoleEnum.DIRECTOR),
    ("idir-ia-analyst", "idir", RoleEnum.IA_ANALYST),
    ("idir-ia-manager", "idir", RoleEnum.IA_MANAGER),
    ("bceid-supplier", "bceidbusiness", RoleEnum.SUPPLIER),
    ("bceid-manage-users", "bceidbusiness", RoleEnum.MANAGE_USERS),
    ("bceid-transfer", "bceidbusiness", RoleEnum.TRANSFER),
    (
        "bceid-compliance-reporting",
        "bceidbusiness",
        RoleEnum.COMPLIANCE_REPORTING,
    ),
    ("bceid-signing-authority", "bceidbusiness", RoleEnum.SIGNING_AUTHORITY),
    ("bceid-read-only", "bceidbusiness", RoleEnum.READ_ONLY),
    ("bceid-ci-applicant", "bceidbusiness", RoleEnum.CI_APPLICANT),
    ("bceid-ia-proponent", "bceidbusiness", RoleEnum.IA_PROPONENT),
    ("bceid-ia-signer", "bceidbusiness", RoleEnum.IA_SIGNER),
]


def _roles_for_identity(
    identity_provider: str, assigned_role: RoleEnum
) -> list[RoleEnum]:
    base_role = (
        RoleEnum.GOVERNMENT if identity_provider == "idir" else RoleEnum.SUPPLIER
    )
    roles = [base_role]
    if assigned_role != base_role:
        roles.append(assigned_role)
    if assigned_role == RoleEnum.IA_SIGNER:
        roles.append(RoleEnum.IA_PROPONENT)
    return roles


async def seed_local_keycloak_users(session: AsyncSession) -> None:
    """Create local-only profiles covering every IDIR and BCeID role."""
    role_rows = await session.execute(select(Role.name, Role.role_id))
    role_id_by_enum = {role_name: role_id for role_name, role_id in role_rows.all()}

    for username, identity_provider, assigned_role in LOCAL_ROLE_USERS:
        email = f"{username}@example.com"
        organization_id = None if identity_provider == "idir" else 1
        profile_result = await session.execute(
            select(UserProfile).where(UserProfile.keycloak_username == username)
        )
        profile = profile_result.scalar_one_or_none()

        if profile is None:
            profile = UserProfile(
                keycloak_email=email,
                keycloak_username=username,
                email=email,
                title=f"Local {identity_provider} role fixture",
                first_name="Local",
                last_name=assigned_role.value,
                organization_id=organization_id,
                is_active=True,
            )
            session.add(profile)
            await session.flush()
        else:
            profile.keycloak_email = email
            profile.email = email
            profile.organization_id = organization_id
            profile.is_active = True

        existing_role_result = await session.execute(
            select(UserRole.role_id).where(
                UserRole.user_profile_id == profile.user_profile_id
            )
        )
        existing_role_ids = set(existing_role_result.scalars().all())

        for role in _roles_for_identity(identity_provider, assigned_role):
            role_id = role_id_by_enum.get(role)
            if role_id is None:
                raise ValueError(f"Role {role.value} is missing from the role table")
            if role_id not in existing_role_ids:
                session.add(
                    UserRole(
                        user_profile_id=profile.user_profile_id,
                        role_id=role_id,
                    )
                )
                existing_role_ids.add(role_id)

    logger.info("Local Keycloak role profiles seeded", count=len(LOCAL_ROLE_USERS))
