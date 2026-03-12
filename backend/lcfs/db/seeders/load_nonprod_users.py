import argparse
import asyncio
import re

import structlog
from sqlalchemy import delete, text, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.UserRole import UserRole
from lcfs.db.models.user.Role import Role
from lcfs.db.models.user.role_domains import validate_seed_user_roles
from lcfs.db.seeders.user_seed_data import get_seed_user_data
from lcfs.settings import settings

logger = structlog.get_logger(__name__)
ORG_BOUND_TEST_USER_RE = re.compile(r"^(lcfs|tfs)\d+$", re.IGNORECASE)


async def _update_user_sequences(session: AsyncSession) -> None:
    await session.execute(
        text(
            """
            SELECT setval(
                'user_profile_user_profile_id_seq',
                COALESCE((SELECT MAX(user_profile_id) + 1 FROM user_profile), 1),
                false
            )
            """
        )
    )
    await session.execute(
        text(
            """
            SELECT setval(
                'user_role_user_role_id_seq',
                COALESCE((SELECT MAX(user_role_id) + 1 FROM user_role), 1),
                false
            )
            """
        )
    )


async def load_nonprod_users(env: str) -> None:
    profiles, roles = get_seed_user_data(env)
    seed_id_to_username: dict[int, str] = {}
    usernames_seen: set[str] = set()
    for profile in profiles:
        seed_profile_id = profile.get("user_profile_id")
        username = profile.get("keycloak_username")
        if seed_profile_id is None or not username:
            continue
        seed_profile_id_int = int(seed_profile_id)
        username_str = str(username)
        if username_str in usernames_seen:
            raise ValueError(
                f"Duplicate keycloak_username in seeded profiles: {username_str}"
            )
        usernames_seen.add(username_str)
        seed_id_to_username[seed_profile_id_int] = username_str

    profile_user_ids = set(seed_id_to_username.keys())
    filtered_roles = [
        role
        for role in roles
        if role.get("user_profile_id") is not None
        and int(role["user_profile_id"]) in profile_user_ids
    ]
    dropped_role_rows = len(roles) - len(filtered_roles)

    engine = create_async_engine(str(settings.db_url))
    session_factory = sessionmaker(bind=engine, class_=AsyncSession)

    async with session_factory() as session:
        async with session.begin():
            role_id_to_enum = {
                role_id: role_name
                for role_id, role_name in (
                    await session.execute(select(Role.role_id, Role.name))
                ).all()
            }
            validate_seed_user_roles(profiles, filtered_roles, role_id_to_enum)

            seed_id_to_db_id: dict[int, int] = {}
            username_to_db_id: dict[str, int] = {}

            for profile in profiles:
                username = profile.get("keycloak_username")
                if not username:
                    raise ValueError("Seeded profile is missing keycloak_username")
                organization_id = (
                    4 if ORG_BOUND_TEST_USER_RE.match(str(username)) else None
                )

                payload = {
                    "keycloak_user_id": profile.get("keycloak_user_id"),
                    "keycloak_email": profile.get("keycloak_email"),
                    "keycloak_username": username,
                    "email": profile.get("email"),
                    "title": profile.get("title"),
                    "phone": profile.get("phone"),
                    "mobile_phone": profile.get("mobile_phone"),
                    "first_name": profile.get("first_name"),
                    "last_name": profile.get("last_name"),
                    "is_active": bool(profile.get("is_active", True)),
                    # Keep tfs/lcfs synthetic org users bound to org 4.
                    # Other seeded users are loaded without org binding.
                    "organization_id": organization_id,
                    "create_user": "ANONYMIZER",
                    "update_user": "ANONYMIZER",
                }

                stmt = insert(UserProfile).values(**payload)
                stmt = stmt.on_conflict_do_update(
                    index_elements=[UserProfile.keycloak_username],
                    set_={
                        "keycloak_user_id": stmt.excluded.keycloak_user_id,
                        "keycloak_email": stmt.excluded.keycloak_email,
                        "email": stmt.excluded.email,
                        "title": stmt.excluded.title,
                        "phone": stmt.excluded.phone,
                        "mobile_phone": stmt.excluded.mobile_phone,
                        "first_name": stmt.excluded.first_name,
                        "last_name": stmt.excluded.last_name,
                        "is_active": stmt.excluded.is_active,
                        "organization_id": stmt.excluded.organization_id,
                        "update_user": "ANONYMIZER",
                        "update_date": text("now()"),
                    },
                )
                stmt = stmt.returning(UserProfile.user_profile_id)
                resolved_id = int((await session.execute(stmt)).scalar_one())
                username_to_db_id[str(username)] = resolved_id
                if profile.get("user_profile_id") is not None:
                    seed_id_to_db_id[int(profile["user_profile_id"])] = resolved_id

            # Reset role mappings for seeded users then re-apply from seed data.
            existing_seeded_ids = set(username_to_db_id.values())
            if existing_seeded_ids:
                await session.execute(
                    delete(UserRole).where(
                        UserRole.user_profile_id.in_(existing_seeded_ids)
                    )
                )

            for role in filtered_roles:
                seed_role_user_id = int(role["user_profile_id"])
                role_id = int(role["role_id"])
                resolved_user_profile_id = seed_id_to_db_id.get(seed_role_user_id)
                if resolved_user_profile_id is None:
                    raise ValueError(
                        "Validated role row user_profile_id="
                        f"{seed_role_user_id} missing after user upsert."
                    )
                role_payload = {
                    "user_profile_id": resolved_user_profile_id,
                    "role_id": role_id,
                    "create_user": "ANONYMIZER",
                    "update_user": "ANONYMIZER",
                }
                role_stmt = insert(UserRole).values(**role_payload)
                role_stmt = role_stmt.on_conflict_do_nothing(
                    index_elements=[UserRole.user_profile_id, UserRole.role_id]
                )
                await session.execute(role_stmt)

            await _update_user_sequences(session)

    await engine.dispose()
    logger.info(
        "Loaded non-prod seeded users",
        env=env,
        profile_count=len(profiles),
        role_count=len(filtered_roles),
        dropped_role_rows=dropped_role_rows,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", required=True, choices=["local", "test"])
    args = parser.parse_args()

    asyncio.run(load_nonprod_users(args.env))
