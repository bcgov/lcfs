import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from lcfs.db.models.compliance.EndUserType import EndUserType

logger = structlog.get_logger(__name__)


async def seed_end_user_types(session):
    """
    Seeds the end_user_type table with predefined values if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    end_user_types_to_seed = [
        {"type_name": "Multi-unit residential building"},
        {"type_name": "Fleet"},
        {"type_name": "Public"},
        {"type_name": "Employee"},
    ]

    try:
        for end_user_type_data in end_user_types_to_seed:
            # Check if the EndUserType already exists
            exists = await session.execute(
                select(EndUserType).where(
                    EndUserType.type_name == end_user_type_data["type_name"]
                )
            )
            if not exists.scalars().first():
                end_user_type = EndUserType(**end_user_type_data)
                session.add(end_user_type)

    except IntegrityError as ie:
        logger.warning(
            "Integrity error while seeding end_user_type",
            error=str(ie),
            exc_info=ie,
        )
    except Exception as e:
        context = {
            "function": "seed_end_user_types",
        }
        logger.error(
            "Error occurred while seeding end_user_type",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise
