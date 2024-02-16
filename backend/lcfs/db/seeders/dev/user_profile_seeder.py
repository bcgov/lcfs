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
            "keycloak_email": "alex.zorkin@gov.bc.ca",
            "keycloak_username": "ALZORKIN",
            "email": "alex.zorkin@gov.bc.ca",
            "title": "Developer",
            "phone": "1234567890",
            "mobile_phone": "1234567890",
            "organization_id": None,
            "is_active": True,
            "first_name": "Alex",
            "last_name": "Zorkin",
        },
        {
            "keycloak_email": "hamed.valiollahibayeki@gov.bc.ca",
            "keycloak_username": "HVALIOLL",
            "email": "hamed.valiollahibayeki@gov.bc.ca",
            "title": "Developer",
            "phone": "1234567890",
            "mobile_phone": "1234567890",
            "organization_id": None,
            "is_active": True,
            "first_name": "Hamed",
            "last_name": "Bayeki",
        },
        {
            "keycloak_email": "kevin.hashimoto@gov.bc.ca",
            "keycloak_username": "KHASHIMO",
            "email": "kevin.hashimoto@gov.bc.ca",
            "title": "Developer",
            "phone": "1234567890",
            "mobile_phone": "1234567890",
            "organization_id": None,
            "is_active": True,
            "first_name": "Kevin",
            "last_name": "Hashimoto",
        },
        {
            "keycloak_email": "prashanth.venkateshappa@gov.bc.ca",
            "keycloak_username": "PVENKATE",
            "email": "prashanth.venkateshappa@gov.bc.ca",
            "title": "Developer",
            "phone": "1234567890",
            "mobile_phone": "1234567890",
            "organization_id": None,
            "is_active": True,
            "first_name": "Prashanth",
            "last_name": "V",
        },
        {
            "keycloak_email": "justin.lepitzki@gov.bc.ca",
            "keycloak_username": "JLEPITZ",
            "email": "justin.lepitzki@gov.bc.ca",
            "title": "Admin",
            "phone": "1234567890",
            "mobile_phone": "1234567890",
            "organization_id": None,
            "is_active": True,
            "first_name": "Justin",
            "last_name": "Lepitzki",
        },
        {
            "keycloak_email": "lindsy.grunert@gov.bc.ca",
            "keycloak_username": "LGRUNERT",
            "email": "lindsy.grunert@gov.bc.ca",
            "title": "Admin",
            "phone": "1234567890",
            "mobile_phone": "1234567890",
            "organization_id": None,
            "is_active": True,
            "first_name": "Lindsy",
            "last_name": "Grunert",
        },
        {
            "keycloak_email": "tfrs@gov.bc.ca",
            "keycloak_username": "lcfs1",
            "email": "tfrs@gov.bc.ca",
            "title": "Analyst",
            "phone": "1112223333",
            "mobile_phone": "1112223333",
            "organization_id": 1,
            "is_active": True,
            "first_name": "Jane",
            "last_name": "Doe",
        },
        {
            "keycloak_email": "tfrs@gov.bc.ca",
            "keycloak_username": "LCFS2",
            "email": "tfrs@gov.bc.ca",
            "title": "Analyst",
            "phone": "2223334444",
            "mobile_phone": "2223334444",
            "organization_id": 2,
            "is_active": True,
            "first_name": "John",
            "last_name": "Smith",
        },
        {
            "keycloak_email": "tfrs@gov.bc.ca",
            "keycloak_username": "LCFS3",
            "email": "tfrs@gov.bc.ca",
            "title": "Analyst",
            "phone": "3334445555",
            "mobile_phone": "3334445555",
            "organization_id": 3,
            "is_active": True,
            "first_name": "Alice",
            "last_name": "Woo",
        },
        {
            "keycloak_email": "tfrs@gov.bc.ca",
            "keycloak_username": "LCFS4",
            "email": "tfrs@gov.bc.ca",
            "title": "Analyst",
            "phone": "4445556666",
            "mobile_phone": "4445556666",
            "organization_id": 4,
            "is_active": True,
            "first_name": "Bob",
            "last_name": "Lee",
        },
        {
            "keycloak_email": "tfrs@gov.bc.ca",
            "keycloak_username": "LCFS5",
            "email": "tfrs@gov.bc.ca",
            "title": "Analyst",
            "phone": "6667778888",
            "mobile_phone": "6667778888",
            "organization_id": 5,
            "is_active": True,
            "first_name": "David",
            "last_name": "Clark",
        },
        {
            "keycloak_email": "tfrs@gov.bc.ca",
            "keycloak_username": "LCFS6",
            "email": "tfrs@gov.bc.ca",
            "title": "Analyst",
            "phone": "8889990000",
            "mobile_phone": "8889990000",
            "organization_id": 6,
            "is_active": True,
            "first_name": "Frank",
            "last_name": "Wilson",
        },
        {
            "keycloak_email": "tfrs@gov.bc.ca",
            "keycloak_username": "LCFS7",
            "email": "tfrs@gov.bc.ca",
            "title": "Analyst",
            "phone": "0001112222",
            "mobile_phone": "0001112222",
            "organization_id": 7,
            "is_active": True,
            "first_name": "Bill",
            "last_name": "Teller",
        },
        {
            "keycloak_email": "tfrs@gov.bc.ca",
            "keycloak_username": "LCFS8",
            "email": "tfrs@gov.bc.ca",
            "title": "Analyst",
            "phone": "2223334445",
            "mobile_phone": "2223334445",
            "organization_id": 8,
            "is_active": True,
            "first_name": "James",
            "last_name": "Bell",
        },
        {
            "keycloak_email": "tfrs@gov.bc.ca",
            "keycloak_username": "LCFS9",
            "email": "tfrs@gov.bc.ca",
            "title": "Analyst",
            "phone": "4445556667",
            "mobile_phone": "4445556667",
            "organization_id": 9,
            "is_active": True,
            "first_name": "Leo",
            "last_name": "Martin",
        },
        {
            "keycloak_email": "tfrs@gov.bc.ca",
            "keycloak_username": "LCFS10",
            "email": "tfrs@gov.bc.ca",
            "title": "Analyst",
            "phone": "6667778889",
            "mobile_phone": "6667778889",
            "organization_id": 10,
            "is_active": True,
            "first_name": "Noah",
            "last_name": "Thomas",
        }
    ]

    try:
        for user_data in user_profiles_to_seed:
            # Check if the user already exists based on a unique attribute
            exists = await session.execute(
                select(UserProfile).where(
                    UserProfile.keycloak_username == user_data["keycloak_username"]
                )
            )
            if not exists.scalars().first():
                user_profile = UserProfile(**user_data)
                session.add(user_profile)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding user profiles: %s", e)
        raise
