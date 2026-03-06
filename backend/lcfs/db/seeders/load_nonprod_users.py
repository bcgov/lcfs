import argparse
import asyncio

import structlog
from sqlalchemy import delete, text, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.UserRole import UserRole
from lcfs.db.models.user.Role import Role
from lcfs.db.seeders.user_seed_data import get_seed_user_data
from lcfs.settings import settings

logger = structlog.get_logger(__name__)


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
    seeded_user_ids = sorted(
        {
            int(profile["user_profile_id"])
            for profile in profiles
            if profile.get("user_profile_id") is not None
        }
    )

    engine = create_async_engine(str(settings.db_url))
    session_factory = sessionmaker(bind=engine, class_=AsyncSession)

    async with session_factory() as session:
        async with session.begin():
            # Move conflicting usernames out of the way if they are attached to
            # a different user_profile_id.
            for profile in profiles:
                seeded_user_id = int(profile["user_profile_id"])
                seeded_username = profile["keycloak_username"]

                result = await session.execute(
                    text(
                        """
                        SELECT user_profile_id
                        FROM user_profile
                        WHERE keycloak_username = :username
                        LIMIT 1
                        """
                    ),
                    {"username": seeded_username},
                )
                existing_user_id = result.scalar_one_or_none()
                if (
                    existing_user_id is not None
                    and int(existing_user_id) != seeded_user_id
                ):
                    await session.execute(
                        text(
                            """
                            UPDATE user_profile
                            SET keycloak_username = :replacement,
                                update_user = 'ANONYMIZER',
                                update_date = now()
                            WHERE user_profile_id = :user_id
                            """
                        ),
                        {
                            "replacement": f"anon_conflict_{existing_user_id}",
                            "user_id": existing_user_id,
                        },
                    )

            for profile in profiles:
                payload = {
                    "user_profile_id": int(profile["user_profile_id"]),
                    "keycloak_user_id": profile.get("keycloak_user_id"),
                    "keycloak_email": profile.get("keycloak_email"),
                    "keycloak_username": profile.get("keycloak_username"),
                    "email": profile.get("email"),
                    "title": profile.get("title"),
                    "phone": profile.get("phone"),
                    "mobile_phone": profile.get("mobile_phone"),
                    "first_name": profile.get("first_name"),
                    "last_name": profile.get("last_name"),
                    "is_active": bool(profile.get("is_active", True)),
                    # Seeded users are loaded without org binding.
                    # Admin UI is used to associate orgs after anonymization.
                    "organization_id": None,
                    "update_user": "ANONYMIZER",
                }

                stmt = insert(UserProfile).values(**payload)
                stmt = stmt.on_conflict_do_update(
                    index_elements=[UserProfile.user_profile_id],
                    set_={
                        "keycloak_user_id": stmt.excluded.keycloak_user_id,
                        "keycloak_email": stmt.excluded.keycloak_email,
                        "keycloak_username": stmt.excluded.keycloak_username,
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
                await session.execute(stmt)

            # Only operate on seeded users that currently exist.
            existing_seeded_ids = set(
                (
                    await session.execute(
                        select(UserProfile.user_profile_id).where(
                            UserProfile.user_profile_id.in_(seeded_user_ids)
                        )
                    )
                )
                .scalars()
                .all()
            )

            # Reset role mappings for seeded users then re-apply from seed data.
            await session.execute(
                delete(UserRole).where(UserRole.user_profile_id.in_(existing_seeded_ids))
            )

            valid_role_ids = set((await session.execute(select(Role.role_id))).scalars().all())
            skipped_role_rows = 0

            for role in roles:
                role_user_id = int(role["user_profile_id"])
                role_id = int(role["role_id"])
                if role_user_id not in existing_seeded_ids or role_id not in valid_role_ids:
                    skipped_role_rows += 1
                    continue
                role_payload = {
                    "user_profile_id": role_user_id,
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
        role_count=len(roles),
        skipped_role_rows=skipped_role_rows,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", required=True, choices=["local", "test"])
    args = parser.parse_args()

    asyncio.run(load_nonprod_users(args.env))
