import structlog
from sqlalchemy import select
from lcfs.db.models.user.UserRole import UserRole

logger = structlog.get_logger(__name__)


async def seed_user_roles(session):
    """
    Seeds the user roles into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    user_roles_to_seed = [
        {"user_profile_id": 1, "role_id": 1},
        {"user_profile_id": 1, "role_id": 3},
        {"user_profile_id": 2, "role_id": 1},
        {"user_profile_id": 2, "role_id": 3},
        {"user_profile_id": 3, "role_id": 1},
        {"user_profile_id": 3, "role_id": 3},
        {"user_profile_id": 4, "role_id": 1},
        {"user_profile_id": 4, "role_id": 3},
        {"user_profile_id": 5, "role_id": 1},
        {"user_profile_id": 5, "role_id": 3},
        {"user_profile_id": 6, "role_id": 1},
        {"user_profile_id": 6, "role_id": 3},
        {"user_profile_id": 7, "role_id": 2},
        {"user_profile_id": 7, "role_id": 8},
        {"user_profile_id": 7, "role_id": 9},
        {"user_profile_id": 7, "role_id": 10},
        {"user_profile_id": 8, "role_id": 2},
        {"user_profile_id": 8, "role_id": 8},
        {"user_profile_id": 8, "role_id": 10},
        {"user_profile_id": 9, "role_id": 2},
        {"user_profile_id": 9, "role_id": 8},
        {"user_profile_id": 9, "role_id": 9},
        {"user_profile_id": 9, "role_id": 10},
        {"user_profile_id": 10, "role_id": 2},
        {"user_profile_id": 10, "role_id": 8},
        {"user_profile_id": 10, "role_id": 10},
        {"user_profile_id": 11, "role_id": 2},
        {"user_profile_id": 11, "role_id": 8},
        {"user_profile_id": 11, "role_id": 10},
        {"user_profile_id": 12, "role_id": 2},
        {"user_profile_id": 13, "role_id": 2},
        {"user_profile_id": 14, "role_id": 2},
        {"user_profile_id": 15, "role_id": 2},
        {"user_profile_id": 16, "role_id": 2},
        {"user_profile_id": 17, "role_id": 1},
        {"user_profile_id": 17, "role_id": 3},
        {"user_profile_id": 18, "role_id": 1},
        {"user_profile_id": 18, "role_id": 3},
        {"user_profile_id": 19, "role_id": 1},
        {"user_profile_id": 19, "role_id": 3},
        {"user_profile_id": 20, "role_id": 1},
        {"user_profile_id": 20, "role_id": 3},
        {"user_profile_id": 21, "role_id": 1},
        {"user_profile_id": 21, "role_id": 3},
        {"user_profile_id": 21, "role_id": 4},
        {"user_profile_id": 22, "role_id": 1},
        {"user_profile_id": 22, "role_id": 3},
    ]

    try:
        for user_role_data in user_roles_to_seed:
            # Check if the UserRole already exists based on user_profile_id and role_id
            exists = await session.execute(
                select(UserRole).where(
                    UserRole.user_profile_id == user_role_data["user_profile_id"],
                    UserRole.role_id == user_role_data["role_id"],
                )
            )
            if not exists.scalars().first():
                user_role = UserRole(**user_role_data)
                session.add(user_role)

    except Exception as e:
        context = {
            "function": "seed_user_roles",
        }
        logger.error(
            "Error occurred while seeding user roles",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise
