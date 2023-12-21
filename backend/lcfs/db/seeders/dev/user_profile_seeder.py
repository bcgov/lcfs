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
            "organization_id": 1,
            "is_active": True
        },
        {
            "keycloak_email": "hamed.valiollahibayeki@gov.bc.ca",
            "keycloak_username": "HVALIOLL",
            "email": "hamed.valiollahibayeki@gov.bc.ca",
            "username": "hvalioll",
            "display_name": "Hamed Valiollahi Bayeki",
            "title": "Developer",
            "phone": "1234567890",
            "mobile_phone": "1234567890",
            "organization_id": 1,
            "is_active": True
        },
        {
            "keycloak_email": 'kevin.hashimoto@gov.bc.ca',
            "keycloak_username": 'KHASHIMO',
            "email": 'kevin.hashimoto@gov.bc.ca',
            "username": 'khashimo',
            "display_name": 'Kevin Hashimoto',
            "title": 'Developer',
            "phone": "1234567890",
            "mobile_phone": "1234567890",
            "organization_id": 1,
            "is_active": True
        },
        {
            "keycloak_email": 'protonater@live.com',
            "keycloak_username": 'PVENKATE',
            "email": 'protonater@live.com',
            "username": 'pvenkate',
            "display_name": 'Prashanth V',
            "title": 'Developer',
            "phone": "1234567890",
            "mobile_phone": "1234567890",
            "organization_id": 1,
            "is_active": True
        },
    ]

    try:
        for user_data in user_profiles_to_seed:
            # Check if the user already exists based on a unique attribute, e.g., username
            exists = await session.execute(
                select(UserProfile).where(UserProfile.keycloak_email == user_data["keycloak_email"])
            )
            if not exists.scalars().first():
                user_profile = UserProfile(**user_data)
                session.add(user_profile)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding user profiles: %s", e)
        raise
