import logging
from sqlalchemy import select
from lcfs.db.models.UserProfile import UserProfile

logger = logging.getLogger(__name__)

async def seed_user_profiles(session):
    """
    Seeds the user profiles into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the user profiles to seed
    user_profiles_to_seed = [
        {
            "keycloak_email": "alex@thecruxstudios.com",
            "keycloak_username": "ALZORKIN",
            "email": "alex@thecruxstudios.com",
            "username": "azorkin",
            "display_name": "Alex Zorkin",
            "title": "Developer",
            "phone": "1234567890",
            "mobile_phone": "1234567890",
            "organization_id": 1
        },
    ]

    try:
        for user_data in user_profiles_to_seed:
            # Check if the user already exists based on a unique attribute, e.g., username
            exists = await session.execute(
                select(UserProfile).where(UserProfile.username == user_data["keycloak_email"])
            )
            if not exists.scalars().first():
                user_profile = UserProfile(**user_data)
                session.add(user_profile)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding user profiles: %s", e)
        raise
