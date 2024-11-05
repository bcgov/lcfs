import structlog
from sqlalchemy import select
from lcfs.db.models.user.UserProfile import UserProfile

logger = structlog.get_logger(__name__)


async def seed_test_user_profiles(session):
    """
    Seeds the user profiles into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the user profiles to seed
    user_profiles_to_seed = [
        {
            "keycloak_email": "john.doe1@example.tld",
            "keycloak_username": "john_doe_01",
            "email": "john.doe1@example.tld",
            "title": "Developer",
            "phone": "+1-555-123-4567",
            "mobile_phone": "+1-555-234-5678",
            "first_name": "John",
            "last_name": "Doe",
            "organization_id": 1,
        },
        {
            "keycloak_email": "jane.smith2@example.tld",
            "keycloak_username": "jane_smith_02",
            "email": "jane.smith2@example.tld",
            "title": "Developer",
            "phone": "+1-555-345-6789",
            "mobile_phone": "+1-555-456-7890",
            "first_name": "Jane",
            "last_name": "Smith",
            "organization_id": 2,
        },
        {
            "keycloak_email": "alice.jones3@example.tld",
            "keycloak_username": "alice_jones_03",
            "email": "alice.jones3@example.tld",
            "title": "Developer",
            "phone": "+1-555-567-8901",
            "mobile_phone": "+1-555-678-9012",
            "first_name": "Alice",
            "last_name": "Jones",
            "organization_id": 3,
        },
        {
            "keycloak_email": "idir@test.tld",
            "keycloak_username": "IDIRUSER",
            "email": "user@test.tld",
            "title": "Developer",
            "phone": "+1-555-789-0123",
            "mobile_phone": "+1-555-890-1234",
            "first_name": "Bob",
            "last_name": "Johnson",
            "organization_id": None,
            "is_active": True,
        },
        {
            "keycloak_email": "bceid@test.tld",
            "keycloak_username": "BCEIDUSER",
            "email": "user@test.tld",
            "title": "Developer",
            "phone": "+1-555-901-2345",
            "mobile_phone": "+1-555-012-3456",
            "first_name": "Charlie",
            "last_name": "Brown",
            "organization_id": 2,
            "is_active": True,
        },
        {
            "keycloak_email": "active@test.tld",
            "keycloak_username": "ACTIVEUSER",
            "email": "user@test.tld",
            "title": "Developer",
            "phone": "+1-555-234-5678",
            "mobile_phone": "+1-555-345-6789",
            "first_name": "Diana",
            "last_name": "Evans",
            "organization_id": 3,
            "is_active": True,
        },
        {
            "keycloak_email": "inactive@test.tld",
            "keycloak_username": "INACTIVEUSER",
            "email": "user@test.tld",
            "title": "Developer",
            "phone": "+1-555-456-7890",
            "mobile_phone": "+1-555-567-8901",
            "first_name": "Eve",
            "last_name": "Harris",
            "organization_id": 3,
            "is_active": False,
        },
    ]

    try:
        for user_data in user_profiles_to_seed:
            # Check if the user already exists based on a unique attribute
            exists = await session.execute(
                select(UserProfile).where(
                    UserProfile.keycloak_email == user_data["keycloak_email"]
                )
            )
            if not exists.scalars().first():
                user_profile = UserProfile(**user_data)
                session.add(user_profile)

    except Exception as e:
        context = {
                "function": "seed_test_user_profiles",
        }
        logger.error(
            "Error occurred while seeding user profiles",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise
