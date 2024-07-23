import logging
from sqlalchemy import select
from datetime import datetime
from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod

logger = logging.getLogger(__name__)

async def seed_compliance_periods(session):
    """
    Seeds the compliance periods into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    compliance_periods_to_seed = [
        {
            "compliance_period_id": 1,
            "description": "2010",
            "display_order": 1,
            "effective_date": datetime.strptime("2010-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2010-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 2,
            "description": "2011",
            "display_order": 2,
            "effective_date": datetime.strptime("2011-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2011-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 3,
            "description": "2012",
            "display_order": 3,
            "effective_date": datetime.strptime("2012-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2012-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 4,
            "description": "2013",
            "display_order": 4,
            "effective_date": datetime.strptime("2013-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2013-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 5,
            "description": "2014",
            "display_order": 5,
            "effective_date": datetime.strptime("2014-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2014-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 6,
            "description": "2015",
            "display_order": 6,
            "effective_date": datetime.strptime("2015-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2015-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 7,
            "description": "2016",
            "display_order": 7,
            "effective_date": datetime.strptime("2016-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2016-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 8,
            "description": "2017",
            "display_order": 8,
            "effective_date": datetime.strptime("2017-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2017-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 9,
            "description": "2018",
            "display_order": 9,
            "effective_date": datetime.strptime("2018-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2018-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 10,
            "description": "2019",
            "display_order": 10,
            "effective_date": datetime.strptime("2019-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2019-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 11,
            "description": "2020",
            "display_order": 11,
            "effective_date": datetime.strptime("2020-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2020-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 12,
            "description": "2021",
            "display_order": 12,
            "effective_date": datetime.strptime("2021-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2021-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 13,
            "description": "2022",
            "display_order": 13,
            "effective_date": datetime.strptime("2022-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2022-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 14,
            "description": "2023",
            "display_order": 14,
            "effective_date": datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2023-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 15,
            "description": "2024",
            "display_order": 15,
            "effective_date": datetime.strptime("2024-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2024-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 16,
            "description": "2025",
            "display_order": 16,
            "effective_date": datetime.strptime("2025-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2025-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 17,
            "description": "2026",
            "display_order": 17,
            "effective_date": datetime.strptime("2026-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2026-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 18,
            "description": "2027",
            "display_order": 18,
            "effective_date": datetime.strptime("2027-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2027-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 19,
            "description": "2028",
            "display_order": 19,
            "effective_date": datetime.strptime("2028-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2028-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 20,
            "description": "2029",
            "display_order": 20,
            "effective_date": datetime.strptime("2029-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2029-12-31", "%Y-%m-%d").date()
        },
        {
            "compliance_period_id": 21,
            "description": "2030",
            "display_order": 21,
            "effective_date": datetime.strptime("2030-01-01", "%Y-%m-%d").date(),
            "expiration_date": datetime.strptime("2030-12-31", "%Y-%m-%d").date()
        }
    ]

    try:
        for compliance_period_data in compliance_periods_to_seed:
            # Check if the CompliancePeriod already exists based on the description
            exists = await session.execute(
                select(CompliancePeriod).where(CompliancePeriod.description == compliance_period_data["description"])
            )
            if not exists.scalars().first():
                compliance_period = CompliancePeriod(**compliance_period_data)
                session.add(compliance_period)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding compliance periods: %s", e)
        raise
