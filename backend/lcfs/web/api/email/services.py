import os

from pydantic import EmailStr
from lcfs.web.api.base import AudienceType, NotificationTypeEnum
import requests
import structlog
from fastapi import Depends
from jinja2 import Environment, FileSystemLoader
from typing import Dict, List, Any, Optional
from datetime import datetime

from lcfs.settings import settings
from lcfs.web.api.email.repo import CHESEmailRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.email.schema import TEMPLATE_MAPPING

logger = structlog.get_logger(__name__)


class CHESEmailService:
    """
    Service layer for sending email notifications via CHES.
    Handles CHES-specific logic and coordinates with the repository.
    """

    def __init__(self, repo: CHESEmailRepository = Depends()):
        self.repo = repo
        self._access_token = None
        self._token_expiry = None

        # Update template directory path to the root templates directory
        template_dir = os.path.join(os.path.dirname(__file__), "templates")
        self.template_env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=True,  # Enable autoescaping for security
        )

    def determine_audience_type(self, notification_type: NotificationTypeEnum) -> AudienceType:
        """
        Determine the target audience type based on the notification type.
        Business logic for notification audience determination is centralized here.
        """
        if notification_type == NotificationTypeEnum.BCEID__CREDIT_MARKET__CREDITS_LISTED_FOR_SALE:
            # For credit market notifications, notify OTHER organizations (not the posting org)
            # Exclude government users for this notification type
            return AudienceType.OTHER_ORGANIZATIONS
        else:
            # For all other notifications, use the original logic (notify the specific org + government)
            return AudienceType.SAME_ORGANIZATION

    @service_handler
    async def send_fuel_code_expiry_notifications(
        self,
        notification_type: NotificationTypeEnum,
        email: EmailStr,
        notification_context: Dict[str, Any] = None,
    ) -> bool:
        """
        Send an email notification to users subscribed to the specified notification type.
        """
        if not settings.ches_enabled:
            return False

        # Validate configuration before performing any operations
        if not self._validate_configuration():
            return

        # Retrieve subscribed user emails
        recipient_emails = [email]
        if not recipient_emails:
            logger.info(
                f"""No subscribers for notification type: {
                        notification_type.value}"""
            )
            return False

        # Include environment in the context
        notification_context["environment"] = settings.environment.lower()

        # Render the email content
        email_body = self._render_email_template(
            notification_type.value, notification_context
        )

        # Build email payload
        email_payload = self._build_email_payload(
            recipient_emails, notification_context, email_body
        )

        # Send email
        return await self.send_email(email_payload)

    @service_handler
    async def send_notification_email(
        self,
        notification_type: NotificationTypeEnum,
        notification_context: Dict[str, Any],
        organization_id: int = None,
        audience_type: Optional[AudienceType] = None,
    ) -> bool:
        """
        Send an email notification to users subscribed to the specified notification type.
        """
        if not settings.ches_enabled:
            return False

        # Validate configuration before performing any operations
        if not self._validate_configuration():
            return

        # Determine audience type if not provided
        if audience_type is None:
            audience_type = self.determine_audience_type(notification_type)

        # Retrieve subscribed user emails
        recipient_emails = await self.repo.get_subscribed_user_emails(
            notification_type.value, organization_id, audience_type
        )
        if not recipient_emails:
            logger.info(
                f"""No subscribers for notification type: {
                        notification_type.value}"""
            )
            return False

        # Include environment in the context
        notification_context["environment"] = settings.environment.lower()

        # Render the email content
        email_body = self._render_email_template(
            notification_type.value, notification_context
        )

        # Build email payload
        email_payload = self._build_email_payload(
            recipient_emails, notification_context, email_body
        )

        # Send email
        return await self.send_email(email_payload)

    @service_handler
    async def send_email(self, payload: Dict[str, Any]) -> bool:
        """
        Send an email using CHES.
        """
        if not settings.ches_enabled:
            return False

        try:
            if not self._validate_configuration():
                return False
        except Exception as e:
            logger.info(f"Email configuration error: {e}")
            return False

        token = await self._get_ches_token()
        if not token:
            logger.warn("Email sending skipped: failed to retrieve a valid CHES token.")
            return False

        try:
            response = requests.post(
                settings.ches_email_url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                timeout=15,
            )
            response.raise_for_status()
            logger.info("Email sent successfully.")
            return True
        except Exception as e:
            logger.error(
                f"Email sending failed: {e}. Response: {response.text} Payload: {payload}"
            )
            return False

    def _render_email_template(
        self, template_name: str, context: Dict[str, Any]
    ) -> str:
        """
        Render an email template using a predefined mapping of template names to file paths.
        Raises an exception if template is not found.
        """
        try:
            template_file = TEMPLATE_MAPPING[template_name]
            template = self.template_env.get_template(template_file)
            return template.render(**context).strip()
        except Exception as e:
            logger.error(f"Template rendering error: {str(e)}")
            raise ValueError(f"Failed to render email template for {template_name}")

    def _build_email_payload(
        self, recipients: List[str], context: Dict[str, Any], body: str
    ) -> Dict[str, Any]:
        payload = {
            "to": ["donotreply@gov.bc.ca"],
            "from": f"{settings.ches_sender_name} <{settings.ches_sender_email}>",
            "delayTS": 0,
            "encoding": "utf-8",
            "priority": "normal",
            "subject": context.get("subject", "LCFS Notification"),
            "body": body,
            "tag": "lcfs_email",
            "bodyType": "html",
        }

        # Filter out None or empty strings
        valid_recipients = [email for email in recipients if email]

        if valid_recipients:
            payload["bcc"] = valid_recipients
        else:
            logger.warning("Attempted to send email with no valid BCC recipients.")

        return payload

    async def _get_ches_token(self) -> Optional[str]:
        """
        Retrieve and cache the CHES access token.
        """
        try:
            if not self._validate_configuration():
                return None

            if self._access_token and datetime.now().timestamp() < self._token_expiry:
                return self._access_token

            response = requests.post(
                settings.ches_auth_url,
                data={"grant_type": "client_credentials"},
                auth=(settings.ches_client_id, settings.ches_client_secret),
                timeout=10,
            )
            response.raise_for_status()

            token_data = response.json()
            self._access_token = token_data.get("access_token")
            self._token_expiry = datetime.now().timestamp() + token_data.get(
                "expires_in", 3600
            )
            logger.info("Retrieved new CHES token.")
            return self._access_token

        except Exception as e:
            logger.error(f"Token retrieval failed: {e}")
            return None

    def _validate_configuration(self):
        """
        Validate the CHES configuration to ensure all necessary environment variables are set.
        """
        missing_configs = []

        # Check each required CHES configuration setting
        if not settings.ches_auth_url:
            missing_configs.append("ches_auth_url")
        if not settings.ches_email_url:
            missing_configs.append("ches_email_url")
        if not settings.ches_client_id:
            missing_configs.append("ches_client_id")
        if not settings.ches_client_secret:
            missing_configs.append("ches_client_secret")
        if not settings.ches_sender_email:
            missing_configs.append("ches_sender_email")
        if not settings.ches_sender_name:
            missing_configs.append("ches_sender_name")

        if missing_configs or len(missing_configs) > 0:
            logger.error(f"Missing CHES configuration: {', '.join(missing_configs)}")
            return False
        return True
