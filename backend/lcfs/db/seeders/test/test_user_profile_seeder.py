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
            "keycloak_email": "stuart.galloway@gov.bc.ca",
            "keycloak_username": "SGALLOWA",
            "email": "stuart.galloway@gov.bc.ca",
            "title": "Sr. UX Practitioner",
            "phone": "1234567890",
            "mobile_phone": "1234567890",
            "first_name": "Stuart",
            "last_name": "Galloway",
            "organization_id": None,
            "is_active": True,
        },
        {
            "keycloak_email": "Haris.Ishaq@gov.bc.ca",
            "keycloak_username": "HISHAQ",
            "email": "Haris.Ishaq@gov.bc.ca",
            "title": "Chief Engineer",
            "phone": None,
            "mobile_phone": None,
            "first_name": "Haris",
            "last_name": "Ishaq",
            "organization_id": None,
            "is_active": True,
        },
        {
            "keycloak_email": "shannon.payne@gov.bc.ca",
            "keycloak_username": "shpayne",
            "email": "shannon.payne@gov.bc.ca",
            "title": "Chief Engineer",
            "phone": None,
            "mobile_phone": None,
            "first_name": "Shannon",
            "last_name": "Payne",
            "organization_id": None,
            "is_active": True,
        },
        {
            "keycloak_email": "tfrs@gov.bc.ca",
            "keycloak_username": "LCFS1_bat",
            "email": "tfrs@gov.bc.ca",
            "title": "CEO",
            "phone": None,
            "mobile_phone": None,
            "first_name": "Donald",
            "last_name": "Freeman",
            "organization_id": 1,
            "is_active": True,
        },
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
            "keycloak_email": "alasdair.ring@gov.bc.ca",
            "keycloak_username": "AIRING",
            "email": "alasdair.ring@gov.bc.ca",
            "title": "Product Owner",
            "phone": "1234567890",
            "mobile_phone": "1234567890",
            "organization_id": None,
            "is_active": True,
            "first_name": "Al",
            "last_name": "Ring",
        },
        {
            "keycloak_email": "rebekah.ford@gov.bc.ca",
            "keycloak_username": "RRFORD",
            "email": "rebekah.ford@gov.bc.ca",
            "title": "Scrum Master",
            "phone": "1234567890",
            "mobile_phone": "1234567890",
            "organization_id": None,
            "is_active": True,
            "first_name": "Rebekah",
            "last_name": "Ford",
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
