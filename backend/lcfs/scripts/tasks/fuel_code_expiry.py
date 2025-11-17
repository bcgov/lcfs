"""
Task functions for the dynamic scheduler.
Contains async functions that can be called by the scheduler.
"""

from collections import defaultdict
import re
import structlog
from datetime import date, timedelta
from typing import List, Dict, Any
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

        # Group codes by contact email and then by company
        email_groups = _group_codes_by_email_then_company(expiring_codes)

        if not email_groups:
            logger.warning("No valid contact emails found for expiring fuel codes")
            return False

        # Send emails to each contact
        success_count = 0
        total_emails = len(email_groups)

        base_context = {
            "subject": "Important Notice from the Deputy Director: Upcoming Expiry of BC LCFS Fuel Codes",
            "message": {
                "id": "",
                "status": "Expiring",
            },
        }

        for contact_email, email_data in email_groups.items():
            for company_name, comp_data in email_data["companies"].items():
                try:
                    context = dict(base_context)  # shallow copy is fine here
                    context["fuel_codes"] = comp_data["codes"]
                    context["contact_email"] = contact_email
                    context["company"] = company_name
                    context["expiry_count"] = len(comp_data["codes"])

                    logger.info(
                        f"Sending notification to {contact_email} | {company_name} "
                        f"for {len(comp_data['codes'])} expiring codes"
                    )

                    sent = await email_service.send_fuel_code_expiry_notifications(
                        notification_type=NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__EXPIRY_NOTIFICATION,
                        email=contact_email,
                        notification_context=context,
                    )
                    if sent:
                        success_count += 1
                        logger.info(
                            f"Successfully sent to {contact_email} | {company_name}"
                        )
                    else:
                        logger.error(
                            f"Failed to send to {contact_email} | {company_name}"
                        )

                except Exception as e:
                    logger.error(
                        f"Error sending to {contact_email} | {company_name}: {e}"
                    )
        logger.info(
            f"Sent fuel code expiry notifications to {success_count}/{total_emails} contacts"
        )

        # Return True if at least some emails were sent successfully
        return success_count > 0

    except Exception as e:
        logger.error(f"Failed to execute fuel code expiry notification task: {e}")
        return False


def _group_codes_by_email_then_company(
    fuel_codes: List[Any],
) -> Dict[str, Dict[str, Any]]:
    """
    Returns a dict:
    {
      "<contact_email>": {
        "emails": set([...]),
        "companies": {
           "<company_name>": {"codes": [code, ...]}
        }
      },
      ...
    }
    Invalid emails are routed to lcfs@gov.bc.ca.
    """
    email_groups: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"emails": set(), "companies": defaultdict(lambda: {"codes": []})}
    )

    fallback_email = "lcfs@gov.bc.ca"
    invalid_emails: list[str] = []

    for code in fuel_codes:
        contact_email = getattr(code, "contact_email", None)
        if not _is_valid_email(contact_email):
            invalid_emails.append(contact_email)
            contact_email = fallback_email

        company_name = getattr(code, "company", "Unknown Company")

        bucket = email_groups[contact_email]
        bucket["emails"].add(contact_email if contact_email else fallback_email)
        bucket["companies"][company_name]["codes"].append(code)

    if invalid_emails:
        logger.warning(
            f"Found {len(invalid_emails)} invalid email addresses, routed to {fallback_email}: {invalid_emails}"
        )

    # convert nested defaultdicts/sets for JSON friendliness
    normalized: Dict[str, Dict[str, Any]] = {}
    for email, data in email_groups.items():
        companies_dict = {}
        for cname, cdata in data["companies"].items():
            companies_dict[cname] = {"codes": cdata["codes"]}
        normalized[email] = {
            "emails": list(data["emails"]),
            "companies": companies_dict,
        }

    logger.debug(
        f"Grouped {len(fuel_codes)} fuel codes into "
        f"{sum(len(v['companies']) for v in normalized.values())} (contact x company) buckets"
    )
    return normalized


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
