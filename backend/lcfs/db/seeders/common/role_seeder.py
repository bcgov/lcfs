import logging
from sqlalchemy import select
from lcfs.db.models.user.Role import Role, RoleEnum

logger = logging.getLogger(__name__)

async def seed_roles(session):
    """
    Seeds the roles into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    roles_to_seed = [
        {
            "name": RoleEnum.GOVERNMENT,
            "description": 'Identifies a government user in the system.',
            "is_government_role": True,
            "display_order": 1
        },
        {
            "name": RoleEnum.SUPPLIER,
            "description": 'Identifies a supplier user in the system.',
            "is_government_role": False,
            "display_order": 2
        },
        {
            "name": RoleEnum.ADMINISTRATOR,
            "description": 'Can add/edit IDIR users and assign roles, add/edit organizations, BCeID users, and assign roles',
            "is_government_role": True,
            "display_order": 3
        },
        {
            "name": RoleEnum.ANALYST,
            "description": 'Can make recommendations on transfers, transactions, and compliance reports, manage file submissions, and add/edit fuel codes',
            "is_government_role": True,
            "display_order": 4
        },
        {
            "name": RoleEnum.COMPLIANCE_MANAGER,
            "description": 'Can make recommendations on compliance reports',
            "is_government_role": True,
            "display_order": 5
        },
        {
            "name": RoleEnum.DIRECTOR,
            "description": 'Can assess compliance reports and approve transactions',
            "is_government_role": True,
            "display_order": 6
        },
        {
            "name": RoleEnum.MANAGE_USERS,
            "description": 'Can add/edit BCeID users and assign roles',
            "is_government_role": False,
            "display_order": 7
        },
        {
            "name": RoleEnum.TRANSFER,
            "description": 'Can create/save transfers and submit files',
            "is_government_role": False,
            "display_order": 8
        },
        {
            "name": RoleEnum.COMPLIANCE_REPORTING,
            "description": 'Can create/save compliance reports and submit files',
            "is_government_role": False,
            "display_order": 9
        },
        {
            "name": RoleEnum.SIGNING_AUTHORITY,
            "description": 'Can sign and submit compliance reports to government and transfers to trade partners/government',
            "is_government_role": False,
            "display_order": 10
        },
        {
            "name": RoleEnum.READ_ONLY,
            "description": 'Can view transactions, compliance reports, and files',
            "is_government_role": False,
            "display_order": 11
        }
    ]

    try:
        for role_data in roles_to_seed:
            # Check if the Role already exists based on the name
            exists = await session.execute(
                select(Role).where(Role.name == role_data["name"])
            )
            if not exists.scalars().first():
                role = Role(**role_data)
                session.add(role)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding roles: %s", e)
        raise
