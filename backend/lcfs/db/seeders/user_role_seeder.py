import logging
from lcfs.db.models.UserRole import UserRole

logger = logging.getLogger(__name__)

async def seed_user_roles(session):
    """
    Seeds the user roles into the database.

    Args:
        session: The database session for committing the new records.
    """

    user_roles = [
        UserRole(
            user_role_id=1,
            user_profile_id=1,
            role_id=1
        ),
    ]

    try:
        session.add_all(user_roles)
        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding user roles: %s", e)
        raise
