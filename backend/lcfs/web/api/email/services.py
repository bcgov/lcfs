import os
from lcfs.db.models.notification.NotificationType import NotificationTypeEnum
import requests
import structlog
from fastapi import Depends
from jinja2 import Environment, FileSystemLoader
from typing import Dict, List, Any
from datetime import datetime

from lcfs.web.api.email.repo import CHESEmailRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.email.template_mapping import TEMPLATE_MAPPING

logger = structlog.get_logger(__name__)


class CHESEmailService:
    """
    Service layer for sending email notifications via CHES.
    Handles CHES-specific logic and coordinates with the repository.
    """

    def __init__(self, repo: CHESEmailRepository = Depends()):
        self.repo = repo

        # CHES configuration
        self.config = {
            "AUTH_URL": os.getenv("CHES_AUTH_URL", ""),
            "EMAIL_URL": os.getenv("CHES_EMAIL_URL", ""),
            "CLIENT_ID": os.getenv("CHES_CLIENT_ID", ""),
            "CLIENT_SECRET": os.getenv("CHES_CLIENT_SECRET", ""),
            "SENDER_EMAIL": os.getenv("CHES_SENDER_EMAIL", "noreply@gov.bc.ca"),
            "SENDER_NAME": os.getenv("CHES_SENDER_NAME", "LCFS Notification System"),
        }
        self._access_token = None
        self._token_expiry = None
        self._validate_configuration()

        # Initialize template environment
        template_dir = os.path.join(os.path.dirname(__file__), "templates")
        self.template_env = Environment(loader=FileSystemLoader(template_dir))

    def _validate_configuration(self):
        """
        Validate the CHES configuration to ensure all necessary environment variables are set.
        """
        missing = [key for key, value in self.config.items() if not value]
        if missing:
            raise ValueError(f"Missing configuration: {', '.join(missing)}")

    @service_handler
    async def send_notification_email(
        self,
        notification_type: str,
        notification_context: Dict[str, Any],
        organization_id: int,
    ) -> bool:
        """
        Send an email notification to users subscribed to the specified notification type.
        """
        # Retrieve subscribed user emails
        recipient_emails = await self.repo.get_subscribed_user_emails(
            notification_type, organization_id
        )
        if not recipient_emails:
            logger.info(f"No subscribers for notification type: {notification_type}")
            return False

        # Render the email content
        email_body = self._render_email_template(
            notification_type, notification_context
        )

        # Build email payload
        email_payload = self._build_email_payload(
            recipient_emails, notification_context, email_body
        )

        # Send email
        return await self.send_email(email_payload)

    def _render_email_template(
        self, template_name: str, context: Dict[str, Any]
    ) -> str:
        """
        Render an email template using a predefined mapping of template names to file paths.
        """
        # Fetch template file path from the imported mapping
        template_file = TEMPLATE_MAPPING.get(
            NotificationTypeEnum[template_name], TEMPLATE_MAPPING["default"]
        )

        # Render the template
        template = self.template_env.get_template(template_file)
        return template.render(context)

    def _build_email_payload(
        self, recipients: List[str], context: Dict[str, Any], body: str
    ) -> Dict[str, Any]:
        """
        Build the payload for sending an email via CHES.
        """
        return {
            "bcc": recipients,
            "to": ["Undisclosed recipients<donotreply@gov.bc.ca>"],
            "from": f"{self.config['SENDER_NAME']} <{self.config['SENDER_EMAIL']}>",
            "delayTS": 0,
            "encoding": "utf-8",
            "priority": "normal",
            "subject": context.get("subject", "LCFS Notification"),
            "body": body,
            "tag": "lcfs_email",
            "bodyType": "html",
        }

    @service_handler
    async def send_email(self, payload: Dict[str, Any]) -> bool:
        """
        Send an email using CHES.
        """
        token = await self.get_ches_token()
        response = requests.post(
            self.config["EMAIL_URL"],
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

    async def get_ches_token(self) -> str:
        """
        Retrieve and cache the CHES access token.
        """
        if self._access_token and datetime.now().timestamp() < self._token_expiry:
            return self._access_token
        response = requests.post(
            self.config["AUTH_URL"],
            data={"grant_type": "client_credentials"},
            auth=(self.config["CLIENT_ID"], self.config["CLIENT_SECRET"]),
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
