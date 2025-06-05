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
        # Government users (1-6) with administrative roles
        {"user_profile_id": 1, "role_id": 1},  # Alex Zorkin - GOVERNMENT
        {"user_profile_id": 1, "role_id": 3},  # Alex Zorkin - ADMINISTRATOR
        {"user_profile_id": 1, "role_id": 4},  # Alex Zorkin - ANALYST
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
        # Organization users (7-16) with supplier roles
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
        # Additional government users (17-22)
        {"user_profile_id": 17, "role_id": 1},  # Kailee Douglas - GOVERNMENT
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
        # Additional test users from bulk insert (23-54) with roles 1 and 3
        {"user_profile_id": 23, "role_id": 1},  # Alexander LePage - GOVERNMENT
        {"user_profile_id": 23, "role_id": 3},  # Alexander LePage - ADMINISTRATOR
        {"user_profile_id": 24, "role_id": 1},  # Arthur Wong - GOVERNMENT
        {"user_profile_id": 24, "role_id": 3},  # Arthur Wong - ADMINISTRATOR
        {"user_profile_id": 25, "role_id": 1},  # Behzad Bahtooi - GOVERNMENT
        {"user_profile_id": 25, "role_id": 3},  # Behzad Bahtooi - ADMINISTRATOR
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
    ]

    try:
        for user_role_data in user_roles_to_seed:
            # Check if the UserRole already exists based on user_profile_id and role_id
            exists = await session.execute(
                select(UserRole).where(
                    UserRole.user_profile_id == user_role_data["user_profile_id"],
                    UserRole.role_id == user_role_data["role_id"],
                )
            )
            if not exists.scalars().first():
                user_role = UserRole(**user_role_data)
                session.add(user_role)

        await session.flush()
        logger.info(f"Seeded {len(user_roles_to_seed)} user role assignments.")

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
