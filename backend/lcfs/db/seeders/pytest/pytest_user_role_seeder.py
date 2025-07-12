import structlog
from sqlalchemy import select
from lcfs.db.models.user.UserRole import UserRole

logger = structlog.get_logger(__name__)


async def seed_pytest_user_roles(session):
    """
    Seeds the user roles into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    user_roles_to_seed = [
        {"user_profile_id": 1, "role_id": 1},
        {"user_profile_id": 2, "role_id": 2},
        {"user_profile_id": 3, "role_id": 2},
        {"user_profile_id": 4, "role_id": 2},
        {"user_profile_id": 5, "role_id": 2},
        {"user_profile_id": 6, "role_id": 2},
        {"user_profile_id": 7, "role_id": 2},
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
            "function": "seed_pytest_user_roles",
        }
        logger.error(
            "Error occurred while seeding user roles",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise
