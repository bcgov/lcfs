import logging
from lcfs.db.models.UserProfile import UserProfile

logger = logging.getLogger(__name__)

async def seed_user_profiles(session):
    """
    Seeds the user profiles into the database.

    Args:
        session: The database session for committing the new records.
    """

    user_profiles = [
        UserProfile(
            user_profile_id=1,
            keycloak_user_id="",
            keycloak_email="",
            keycloak_username="",
            email="",
            username="",
            display_name="",
            title="",
            phone="123-456-7890",
            mobile_phone="123-456-7890",
            organization_id=1
        ),
    ]

    try:
        session.add_all(user_profiles)
        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding user profiles: %s", e)
        raise
