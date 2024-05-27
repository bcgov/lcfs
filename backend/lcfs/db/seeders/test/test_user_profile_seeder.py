import logging
from sqlalchemy import select
from lcfs.db.models.user.UserProfile import UserProfile
from faker import Faker

logger = logging.getLogger(__name__)

async def seed_test_user_profiles(session):
    """
    Seeds the user profiles into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """
    fake = Faker()

    # Define the user profiles to seed
    user_profiles_to_seed = [
        {
            "keycloak_email": fake.email(),
            "keycloak_username": fake.user_name(),
            "email": fake.email(),
            "title": "Developer",
            "phone": fake.phone_number(),
            "mobile_phone": fake.phone_number(),
            "first_name": fake.first_name(),
            "last_name": fake.last_name(),
            "organization_id": 1
        },
        {
            "keycloak_email": fake.email(),
            "keycloak_username": fake.user_name(),
            "email": fake.email(),
            "title": "Developer",
            "phone": fake.phone_number(),
            "mobile_phone": fake.phone_number(),
            "first_name": fake.first_name(),
            "last_name": fake.last_name(),
            "organization_id": 2
        },
        {
            "keycloak_email": fake.email(),
            "keycloak_username": fake.user_name(),
            "email": fake.email(),
            "title": "Developer",
            "phone": fake.phone_number(),
            "mobile_phone": fake.phone_number(),
            "first_name": fake.first_name(),
            "last_name": fake.last_name(),
            "organization_id": 3
        },
        {
            "keycloak_email": 'idir@test.com',
            "keycloak_username": 'IDIRUSER',
            "email": 'user@test.com',
            "title": "Developer",
            "phone": fake.phone_number(),
            "mobile_phone": fake.phone_number(),
            "first_name": fake.first_name(),
            "last_name": fake.last_name(),
            "organization_id": None,
            "is_active": True
        },
        {
            "keycloak_email": 'bceid@test.com',
            "keycloak_username": 'BCEIDUSER',
            "email": 'user@test.com',
            "title": "Developer",
            "phone": fake.phone_number(),
            "mobile_phone": fake.phone_number(),
            "first_name": fake.first_name(),
            "last_name": fake.last_name(),
            "organization_id": 2,
            "is_active": True
        },
        {
            "keycloak_email": 'active@test.com',
            "keycloak_username": 'ACTIVEUSER',
            "email": 'user@test.com',
            "title": "Developer",
            "phone": fake.phone_number(),
            "mobile_phone": fake.phone_number(),
            "first_name": fake.first_name(),
            "last_name": fake.last_name(),
            "organization_id": 3,
            "is_active": True
        },
        {
            "keycloak_email": 'inactive@test.com',
            "keycloak_username": 'INACTIVEUSER',
            "email": 'user@test.com',
            "title": "Developer",
            "phone": fake.phone_number(),
            "mobile_phone": fake.phone_number(),
            "first_name": fake.first_name(),
            "last_name": fake.last_name(),
            "organization_id": 3,
            "is_active": False
        },
    ]

    try:
        for user_data in user_profiles_to_seed:
            # Check if the user already exists based on a unique attribute
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
