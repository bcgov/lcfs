import structlog
from sqlalchemy import select
from lcfs.db.models.user.UserRole import UserRole

logger = structlog.get_logger(__name__)


async def seed_test_user_roles(session):
    """
    Seeds comprehensive user roles into the database based on actual test data,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    user_roles_to_seed = [
        # System user (1)
        {"user_profile_id": 1, "role_id": 1},  # System User - GOVERNMENT
        {"user_profile_id": 1, "role_id": 3},  # System User - ADMINISTRATOR
        {"user_profile_id": 1, "role_id": 4},  # System User - ANALYST
        # Government users (2-6)
        {"user_profile_id": 2, "role_id": 1},  # Hamed Bayeki - GOVERNMENT
        {"user_profile_id": 2, "role_id": 3},  # Hamed Bayeki - ADMINISTRATOR
        {"user_profile_id": 3, "role_id": 1},  # Kevin Hashimoto - GOVERNMENT
        {"user_profile_id": 3, "role_id": 3},  # Kevin Hashimoto - ADMINISTRATOR
        {"user_profile_id": 4, "role_id": 1},  # Prashanth V - GOVERNMENT
        {"user_profile_id": 4, "role_id": 3},  # Prashanth V - ADMINISTRATOR
        {"user_profile_id": 5, "role_id": 1},  # Justin Lepitzki - GOVERNMENT
        {"user_profile_id": 5, "role_id": 3},  # Justin Lepitzki - ADMINISTRATOR
        {"user_profile_id": 6, "role_id": 1},  # Lindsy Grunert - GOVERNMENT
        {"user_profile_id": 6, "role_id": 3},  # Lindsy Grunert - ADMINISTRATOR
        {"user_profile_id": 6, "role_id": 4},  # Lindsy Grunert - ANALYST
        # Organization users (7-16)
        {"user_profile_id": 7, "role_id": 2},  # Jane Doe - SUPPLIER
        {"user_profile_id": 7, "role_id": 7},  # Jane Doe - MANAGE_USERS
        {"user_profile_id": 7, "role_id": 8},  # Jane Doe - TRANSFER
        {"user_profile_id": 7, "role_id": 9},  # Jane Doe - COMPLIANCE_REPORTING
        {"user_profile_id": 7, "role_id": 10},  # Jane Doe - SIGNING_AUTHORITY
        {"user_profile_id": 8, "role_id": 2},  # John Smith - SUPPLIER
        {"user_profile_id": 8, "role_id": 7},  # John Smith - MANAGE_USERS
        {"user_profile_id": 8, "role_id": 8},  # John Smith - TRANSFER
        {"user_profile_id": 8, "role_id": 9},  # John Smith - COMPLIANCE_REPORTING
        {"user_profile_id": 8, "role_id": 10},  # John Smith - SIGNING_AUTHORITY
        {"user_profile_id": 9, "role_id": 2},  # Alice Woo - SUPPLIER
        {"user_profile_id": 9, "role_id": 7},  # Alice Woo - MANAGE_USERS
        {"user_profile_id": 9, "role_id": 8},  # Alice Woo - TRANSFER
        {"user_profile_id": 9, "role_id": 9},  # Alice Woo - COMPLIANCE_REPORTING
        {"user_profile_id": 9, "role_id": 10},  # Alice Woo - SIGNING_AUTHORITY
        {"user_profile_id": 10, "role_id": 2},  # Bob Lee - SUPPLIER
        {"user_profile_id": 10, "role_id": 7},  # Bob Lee - MANAGE_USERS
        {"user_profile_id": 10, "role_id": 8},  # Bob Lee - TRANSFER
        {"user_profile_id": 10, "role_id": 9},  # Bob Lee - COMPLIANCE_REPORTING
        {"user_profile_id": 10, "role_id": 10},  # Bob Lee - SIGNING_AUTHORITY
        {"user_profile_id": 11, "role_id": 2},  # David Clark - SUPPLIER
        {"user_profile_id": 11, "role_id": 7},  # David Clark - MANAGE_USERS
        {"user_profile_id": 11, "role_id": 8},  # David Clark - TRANSFER
        {"user_profile_id": 11, "role_id": 9},  # David Clark - COMPLIANCE_REPORTING
        {"user_profile_id": 11, "role_id": 10},  # David Clark - SIGNING_AUTHORITY
        {"user_profile_id": 12, "role_id": 2},  # Frank Wilson - SUPPLIER
        {"user_profile_id": 12, "role_id": 7},  # Frank Wilson - MANAGE_USERS
        {"user_profile_id": 12, "role_id": 8},  # Frank Wilson - TRANSFER
        {"user_profile_id": 12, "role_id": 9},  # Frank Wilson - COMPLIANCE_REPORTING
        {"user_profile_id": 12, "role_id": 10},  # Frank Wilson - SIGNING_AUTHORITY
        {"user_profile_id": 13, "role_id": 2},  # Bill Teller - SUPPLIER
        {"user_profile_id": 13, "role_id": 7},  # Bill Teller - MANAGE_USERS
        {"user_profile_id": 13, "role_id": 8},  # Bill Teller - TRANSFER
        {"user_profile_id": 13, "role_id": 9},  # Bill Teller - COMPLIANCE_REPORTING
        {"user_profile_id": 13, "role_id": 10},  # Bill Teller - SIGNING_AUTHORITY
        {"user_profile_id": 14, "role_id": 2},  # James Bell - SUPPLIER
        {"user_profile_id": 14, "role_id": 7},  # James Bell - MANAGE_USERS
        {"user_profile_id": 14, "role_id": 8},  # James Bell - TRANSFER
        {"user_profile_id": 14, "role_id": 9},  # James Bell - COMPLIANCE_REPORTING
        {"user_profile_id": 14, "role_id": 10},  # James Bell - SIGNING_AUTHORITY
        {"user_profile_id": 15, "role_id": 2},  # Leo Martin - SUPPLIER
        {"user_profile_id": 15, "role_id": 7},  # Leo Martin - MANAGE_USERS
        {"user_profile_id": 15, "role_id": 8},  # Leo Martin - TRANSFER
        {"user_profile_id": 15, "role_id": 9},  # Leo Martin - COMPLIANCE_REPORTING
        {"user_profile_id": 15, "role_id": 10},  # Leo Martin - SIGNING_AUTHORITY
        {"user_profile_id": 16, "role_id": 2},  # Noah Thomas - SUPPLIER
        {"user_profile_id": 16, "role_id": 7},  # Noah Thomas - MANAGE_USERS
        {"user_profile_id": 16, "role_id": 8},  # Noah Thomas - TRANSFER
        {"user_profile_id": 16, "role_id": 9},  # Noah Thomas - COMPLIANCE_REPORTING
        {"user_profile_id": 16, "role_id": 10},  # Noah Thomas - SIGNING_AUTHORITY
        # Government users (17-22)
        {"user_profile_id": 17, "role_id": 1},  # Kailee Douglas - GOVERNMENT
        {"user_profile_id": 17, "role_id": 4},  # Kailee Douglas - ANALYST
        {"user_profile_id": 18, "role_id": 1},  # Al Ring - GOVERNMENT
        {"user_profile_id": 18, "role_id": 3},  # Al Ring - ADMINISTRATOR
        {"user_profile_id": 18, "role_id": 4},  # Al Ring - ANALYST
        {"user_profile_id": 19, "role_id": 1},  # Rebekah Ford - GOVERNMENT
        {"user_profile_id": 19, "role_id": 3},  # Rebekah Ford - ADMINISTRATOR
        {"user_profile_id": 20, "role_id": 1},  # Stuart Galloway - GOVERNMENT
        {"user_profile_id": 20, "role_id": 3},  # Stuart Galloway - ADMINISTRATOR
        {"user_profile_id": 20, "role_id": 4},  # Stuart Galloway - ANALYST
        {"user_profile_id": 21, "role_id": 1},  # LCFS_IDIR TESTER - GOVERNMENT
        {"user_profile_id": 21, "role_id": 4},  # LCFS_IDIR TESTER - ANALYST
        {"user_profile_id": 22, "role_id": 1},  # Jackie Duys - GOVERNMENT
        {"user_profile_id": 22, "role_id": 3},  # Jackie Duys - ADMINISTRATOR
        {"user_profile_id": 22, "role_id": 4},  # Jackie Duys - ANALYST
        # Government test users (23-54)
        {"user_profile_id": 23, "role_id": 1},  # Alexander LePage - GOVERNMENT
        {"user_profile_id": 23, "role_id": 3},  # Alexander LePage - ADMINISTRATOR
        {"user_profile_id": 24, "role_id": 1},  # Arthur Wong - GOVERNMENT
        {"user_profile_id": 24, "role_id": 3},  # Arthur Wong - ADMINISTRATOR
        {"user_profile_id": 25, "role_id": 1},  # Behzad Bantool - GOVERNMENT
        {"user_profile_id": 25, "role_id": 3},  # Behzad Bantool - ADMINISTRATOR
        {"user_profile_id": 26, "role_id": 1},  # Binaipal Gill - GOVERNMENT
        {"user_profile_id": 26, "role_id": 3},  # Binaipal Gill - ADMINISTRATOR
        {"user_profile_id": 27, "role_id": 1},  # Brodie Nicholls - GOVERNMENT
        {"user_profile_id": 27, "role_id": 3},  # Brodie Nicholls - ADMINISTRATOR
        {"user_profile_id": 28, "role_id": 1},  # Christine Laycock - GOVERNMENT
        {"user_profile_id": 28, "role_id": 3},  # Christine Laycock - ADMINISTRATOR
        {"user_profile_id": 29, "role_id": 1},  # Dianne McGuire - GOVERNMENT
        {"user_profile_id": 29, "role_id": 3},  # Dianne McGuire - ADMINISTRATOR
        {"user_profile_id": 30, "role_id": 1},  # David Zhang - GOVERNMENT
        {"user_profile_id": 30, "role_id": 3},  # David Zhang - ADMINISTRATOR
        {"user_profile_id": 31, "role_id": 1},  # Graham Wheating - GOVERNMENT
        {"user_profile_id": 31, "role_id": 3},  # Graham Wheating - ADMINISTRATOR
        {"user_profile_id": 32, "role_id": 1},  # Haris Ishaq - GOVERNMENT
        {"user_profile_id": 32, "role_id": 3},  # Haris Ishaq - ADMINISTRATOR
        {"user_profile_id": 33, "role_id": 1},  # Harpaul Padda - GOVERNMENT
        {"user_profile_id": 33, "role_id": 3},  # Harpaul Padda - ADMINISTRATOR
        {"user_profile_id": 34, "role_id": 1},  # James Thomas - GOVERNMENT
        {"user_profile_id": 34, "role_id": 3},  # James Thomas - ADMINISTRATOR
        {"user_profile_id": 35, "role_id": 1},  # Jennifer Kroll - GOVERNMENT
        {"user_profile_id": 35, "role_id": 3},  # Jennifer Kroll - ADMINISTRATOR
        {"user_profile_id": 36, "role_id": 1},  # Joel Zushman - GOVERNMENT
        {"user_profile_id": 36, "role_id": 3},  # Joel Zushman - ADMINISTRATOR
        {"user_profile_id": 37, "role_id": 1},  # Kenneth Chan - GOVERNMENT
        {"user_profile_id": 37, "role_id": 3},  # Kenneth Chan - ADMINISTRATOR
        {"user_profile_id": 38, "role_id": 1},  # Mahon Lamont - GOVERNMENT
        {"user_profile_id": 38, "role_id": 3},  # Mahon Lamont - ADMINISTRATOR
        {"user_profile_id": 39, "role_id": 1},  # Molly Hackett - GOVERNMENT
        {"user_profile_id": 39, "role_id": 3},  # Molly Hackett - ADMINISTRATOR
        {"user_profile_id": 40, "role_id": 1},  # Nicole Anderson - GOVERNMENT
        {"user_profile_id": 40, "role_id": 3},  # Nicole Anderson - ADMINISTRATOR
        {"user_profile_id": 41, "role_id": 1},  # Oloruntobi Muniru - GOVERNMENT
        {"user_profile_id": 41, "role_id": 3},  # Oloruntobi Muniru - ADMINISTRATOR
        {"user_profile_id": 42, "role_id": 1},  # Quentin Mowat-Amiet - GOVERNMENT
        {"user_profile_id": 42, "role_id": 3},  # Quentin Mowat-Amiet - ADMINISTRATOR
        {"user_profile_id": 43, "role_id": 1},  # Raj Chopra - GOVERNMENT
        {"user_profile_id": 43, "role_id": 3},  # Raj Chopra - ADMINISTRATOR
        {"user_profile_id": 44, "role_id": 1},  # Samantha Horan - GOVERNMENT
        {"user_profile_id": 44, "role_id": 3},  # Samantha Horan - ADMINISTRATOR
        {"user_profile_id": 45, "role_id": 1},  # Samuel LeRoux - GOVERNMENT
        {"user_profile_id": 45, "role_id": 3},  # Samuel LeRoux - ADMINISTRATOR
        {"user_profile_id": 46, "role_id": 1},  # Sarah Anderson - GOVERNMENT
        {"user_profile_id": 46, "role_id": 3},  # Sarah Anderson - ADMINISTRATOR
        {"user_profile_id": 47, "role_id": 1},  # Shamas UI Deen - GOVERNMENT
        {"user_profile_id": 47, "role_id": 3},  # Shamas UI Deen - ADMINISTRATOR
        {"user_profile_id": 48, "role_id": 1},  # Shannon Payne - GOVERNMENT
        {"user_profile_id": 48, "role_id": 3},  # Shannon Payne - ADMINISTRATOR
        {"user_profile_id": 49, "role_id": 1},  # Shelby Fondrick - GOVERNMENT
        {"user_profile_id": 49, "role_id": 3},  # Shelby Fondrick - ADMINISTRATOR
        {"user_profile_id": 50, "role_id": 1},  # Steven SE Lee - GOVERNMENT
        {"user_profile_id": 50, "role_id": 3},  # Steven SE Lee - ADMINISTRATOR
        {"user_profile_id": 51, "role_id": 1},  # Tapiwa Nyabadza - GOVERNMENT
        {"user_profile_id": 51, "role_id": 3},  # Tapiwa Nyabadza - ADMINISTRATOR
        {"user_profile_id": 52, "role_id": 1},  # Tristen McCartney - GOVERNMENT
        {"user_profile_id": 52, "role_id": 3},  # Tristen McCartney - ADMINISTRATOR
        {"user_profile_id": 53, "role_id": 1},  # Victoria Gagnon - GOVERNMENT
        {"user_profile_id": 53, "role_id": 3},  # Victoria Gagnon - ADMINISTRATOR
        {"user_profile_id": 54, "role_id": 1},  # Wesley Hawley - GOVERNMENT
        {"user_profile_id": 54, "role_id": 3},  # Wesley Hawley - ADMINISTRATOR
        # Government users (55-82)
        {"user_profile_id": 55, "role_id": 1},  # Alex Zorkin - GOVERNMENT
        {"user_profile_id": 55, "role_id": 3},  # Alex Zorkin - ADMINISTRATOR
        {"user_profile_id": 56, "role_id": 1},  # Cindy Sonne - GOVERNMENT
        {"user_profile_id": 56, "role_id": 3},  # Cindy Sonne - ADMINISTRATOR
        {"user_profile_id": 57, "role_id": 1},  # Jasmine Zhang - GOVERNMENT
        {"user_profile_id": 57, "role_id": 3},  # Jasmine Zhang - ADMINISTRATOR
        {"user_profile_id": 58, "role_id": 1},  # Kuan Fan - GOVERNMENT
        {"user_profile_id": 58, "role_id": 3},  # Kuan Fan - ADMINISTRATOR
        {"user_profile_id": 59, "role_id": 1},  # Sean LeRoy - GOVERNMENT
        {"user_profile_id": 59, "role_id": 3},  # Sean LeRoy - ADMINISTRATOR
        {"user_profile_id": 60, "role_id": 1},  # Alisa Holtz - GOVERNMENT
        {"user_profile_id": 60, "role_id": 3},  # Alisa Holtz - ADMINISTRATOR
        {"user_profile_id": 61, "role_id": 1},  # Amy Teucher - GOVERNMENT
        {"user_profile_id": 61, "role_id": 3},  # Amy Teucher - ADMINISTRATOR
        {"user_profile_id": 62, "role_id": 1},  # Anna Ringsred - GOVERNMENT
        {"user_profile_id": 62, "role_id": 3},  # Anna Ringsred - ADMINISTRATOR
        {"user_profile_id": 63, "role_id": 1},  # Caitlin Moran - GOVERNMENT
        {"user_profile_id": 63, "role_id": 3},  # Caitlin Moran - ADMINISTRATOR
        {"user_profile_id": 64, "role_id": 1},  # Victor Rizov - GOVERNMENT
        {"user_profile_id": 64, "role_id": 3},  # Victor Rizov - ADMINISTRATOR
        {"user_profile_id": 65, "role_id": 1},  # Cindy Sonne - GOVERNMENT
        {"user_profile_id": 65, "role_id": 3},  # Cindy Sonne - ADMINISTRATOR
        {"user_profile_id": 66, "role_id": 1},  # Debbie Oyebanji - GOVERNMENT
        {"user_profile_id": 66, "role_id": 3},  # Debbie Oyebanji - ADMINISTRATOR
        {"user_profile_id": 67, "role_id": 1},  # Devon Willey-Pichette - GOVERNMENT
        {"user_profile_id": 67, "role_id": 3},  # Devon Willey-Pichette - ADMINISTRATOR
        {"user_profile_id": 68, "role_id": 1},  # Richard Tan - GOVERNMENT
        {"user_profile_id": 68, "role_id": 3},  # Richard Tan - ADMINISTRATOR
        {"user_profile_id": 69, "role_id": 1},  # Michael Rensing - GOVERNMENT
        {"user_profile_id": 69, "role_id": 3},  # Michael Rensing - ADMINISTRATOR
        {"user_profile_id": 70, "role_id": 1},  # Daniel Green - GOVERNMENT
        {"user_profile_id": 70, "role_id": 3},  # Daniel Green - ADMINISTRATOR
        {"user_profile_id": 71, "role_id": 1},  # Jasmin Gabriel - GOVERNMENT
        {"user_profile_id": 71, "role_id": 3},  # Jasmin Gabriel - ADMINISTRATOR
        {"user_profile_id": 72, "role_id": 1},  # Jordan Kummerfield - GOVERNMENT
        {"user_profile_id": 72, "role_id": 3},  # Jordan Kummerfield - ADMINISTRATOR
        {"user_profile_id": 73, "role_id": 1},  # Mehdi Bagheri - GOVERNMENT
        {"user_profile_id": 73, "role_id": 3},  # Mehdi Bagheri - ADMINISTRATOR
        {"user_profile_id": 74, "role_id": 1},  # Magdalena Gronowska - GOVERNMENT
        {"user_profile_id": 74, "role_id": 3},  # Magdalena Gronowska - ADMINISTRATOR
        {"user_profile_id": 75, "role_id": 1},  # Nick Clark - GOVERNMENT
        {"user_profile_id": 75, "role_id": 3},  # Nick Clark - ADMINISTRATOR
        {
            "user_profile_id": 76,
            "role_id": 1,
        },  # Pravallikha Samuthirarajan - GOVERNMENT
        {"user_profile_id": 76, "role_id": 3},  # Pravallikha Samuthirarajan - ADMINISTRATOR
        {"user_profile_id": 77, "role_id": 1},  # Ryan Foxall - GOVERNMENT
        {"user_profile_id": 77, "role_id": 3},  # Ryan Foxall - ADMINISTRATOR
        {"user_profile_id": 78, "role_id": 1},  # Sunny Singh - GOVERNMENT
        {"user_profile_id": 78, "role_id": 3},  # Sunny Singh - ADMINISTRATOR
        {"user_profile_id": 79, "role_id": 1},  # Taylor Lorenzen - GOVERNMENT
        {"user_profile_id": 79, "role_id": 3},  # Taylor Lorenzen - ADMINISTRATOR
        {"user_profile_id": 80, "role_id": 1},  # Taylor Reiger - GOVERNMENT
        {"user_profile_id": 80, "role_id": 3},  # Taylor Reiger - ADMINISTRATOR
        {"user_profile_id": 81, "role_id": 1},  # Veronika Fremlin - GOVERNMENT
        {"user_profile_id": 81, "role_id": 3},  # Veronika Fremlin - ADMINISTRATOR
    ]

    try:
        # Query all existing user roles at once to avoid autoflush issues
        result = await session.execute(select(UserRole))
        existing_roles = result.scalars().all()
        existing_pairs = {
            (role.user_profile_id, role.role_id) for role in existing_roles
        }

        # Filter out user roles that already exist
        roles_to_add = []
        for user_role_data in user_roles_to_seed:
            pair = (user_role_data["user_profile_id"], user_role_data["role_id"])
            if pair not in existing_pairs:
                roles_to_add.append(UserRole(**user_role_data))

        # Add all new user roles at once
        if roles_to_add:
            session.add_all(roles_to_add)
            await session.flush()
            logger.info(f"Seeded {len(roles_to_add)} new user role assignments.")
        else:
            logger.info("All user role assignments already exist, skipping.")

    except Exception as e:
        context = {
            "function": "seed_test_user_roles",
        }
        logger.error(
            "Error occurred while seeding user roles",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise
