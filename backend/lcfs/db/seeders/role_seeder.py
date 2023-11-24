import logging
from lcfs.db.models.Role import Role, RoleEnum

logger = logging.getLogger(__name__)

async def seed_roles(session):
    """
    Seeds the roles into the database.

    Args:
        session: The database session for committing the new records.
    """

    roles = [
        Role(
            role_id=1,
            name=RoleEnum.ADMINISTRATOR,
            is_government_role=True
        ),
    ]

    try:
        session.add_all(roles)
        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding roles: %s", e)
        raise
