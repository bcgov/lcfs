"""
Task functions for the dynamic scheduler.
Contains async functions that can be called by the scheduler.
"""

import asyncio
from collections import defaultdict
import re
import structlog
from datetime import datetime, date, timedelta
from typing import List, Dict, Any
from sqlalchemy import select, and_
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

# Import application modules
from lcfs.web.api.base import NotificationTypeEnum
from lcfs.web.api.email.services import CHESEmailService
from lcfs.web.api.email.repo import CHESEmailRepository
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.settings import settings

logger = structlog.get_logger(__name__)


async def notify_expiring_fuel_code(db_session: AsyncSession):
    """
    Task function to send notifications for fuel codes expiring in the next 90 days.
    This function is designed to be called by the dynamic scheduler.

    Args:
        db_session: Database session provided by the scheduler
    """
    logger.info("Starting fuel code expiry notification task")

    if not settings.feature_fuel_code_expiry_email:
        logger.info("Fuel code expiry email feature is disabled. Exiting task.")
        return True

    try:
        # Initialize repositories and services using the provided session
        fuel_code_repo = FuelCodeRepository(db=db_session)
        email_repo = CHESEmailRepository(db=db_session)
        email_service = CHESEmailService(repo=email_repo)

        # Calculate the date 90 days from now
        expiry_date = date.today() + timedelta(days=90)

        # Get expiring fuel codes
        logger.info(f"Looking for fuel codes expiring before {expiry_date}")
        expiring_codes = await fuel_code_repo.get_expiring_fuel_codes()

        if not expiring_codes:
            logger.info("No fuel codes expiring in the next 90 days")
            return True

        logger.info(f"Found {len(expiring_codes)} expiring fuel codes")

        # Group codes by contact email
        email_groups = _group_codes_by_email(expiring_codes)

        if not email_groups:
            logger.warning("No valid contact emails found for expiring fuel codes")
            return False

        # Send emails to each contact
        success_count = 0
        total_emails = len(email_groups)

        base_context = {
            "subject": "Fuel Code Expiry Notification - Action Required",
            "message": {
                "id": "",
                "status": "Expiring",
            },
        }

        for contact_email, codes_data in email_groups.items():
            try:
                # Create context for this specific email
                context = base_context.copy()
                context["fuel_codes"] = codes_data["codes"]
                context["contact_email"] = "prashanth.venkateshappa@gov.bc.ca"
                context["expiry_count"] = len(codes_data["codes"])

                logger.info(
                    f"Sending notification to {contact_email} for {len(codes_data['codes'])} expiring codes"
                )

                # Send notification
                if await email_service.send_fuel_code_expiry_notifications(
                    notification_type=NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__EXPIRY_NOTIFICATION,
                    email=contact_email,
                    notification_context=context,
                ):
                    success_count += 1
                    logger.info(f"Successfully sent notification to {contact_email}")
                else:
                    logger.error(f"Failed to send notification to {contact_email}")

            except Exception as e:
                logger.error(f"Error sending notification to {contact_email}: {e}")

        logger.info(
            f"Sent fuel code expiry notifications to {success_count}/{total_emails} contacts"
        )

        # Return True if at least some emails were sent successfully
        return success_count > 0

    except Exception as e:
        logger.error(f"Failed to execute fuel code expiry notification task: {e}")
        return False


def _group_codes_by_email(fuel_codes: List[Any]) -> Dict[str, Dict[str, Any]]:
    """
    Group fuel codes by contact email and validate emails.

    Returns:
        Dict with email as key and dict containing 'codes' and 'contact_emails' as value
    """
    email_groups = defaultdict(lambda: {"codes": [], "emails": set()})
    invalid_emails = []

    for code in fuel_codes:
        contact_email = code.contact_email

        # Validate email format
        if not _is_valid_email(contact_email):
            email_groups["tfrs@gov.bc.ca"]["codes"].append(code)
            email_groups["tfrs@gov.bc.ca"]["emails"].add("tfrs@gov.bc.ca")
            logger.warning(
                f"Invalid email format for fuel code {code.fuel_code}: {contact_email}"
            )
            continue

        # Group by email
        email_groups[contact_email]["codes"].append(code)
        email_groups[contact_email]["emails"].add(code.contact_email)

    if invalid_emails:
        logger.warning(
            f"Found {len(invalid_emails)} invalid email addresses: {invalid_emails}"
        )

    # Convert defaultdict to regular dict and convert sets to lists for JSON serialization
    result = {}
    for email, data in email_groups.items():
        result[email] = {
            "codes": data["codes"],
            "emails": data["emails"],
        }

    logger.debug(
        f"Grouped {len(fuel_codes)} fuel codes into {len(result)} email groups"
    )
    return result


def _is_valid_email(email: str) -> bool:
    """
    Validate email format using regex.

    Args:
        email: Email string to validate

    Returns:
        bool: True if email format is valid
    """
    if not email or not isinstance(email, str):
        return False

    # Basic email regex pattern
    email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(email_pattern, email) is not None
