import os
from lcfs.web.api.base import NotificationTypeEnum
import requests
import structlog
from fastapi import Depends
from jinja2 import Environment, FileSystemLoader
from typing import Dict, List, Any
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
            autoescape=True  # Enable autoescaping for security
        )

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

        if missing_configs:
            raise ValueError(f"Missing CHES configuration: {', '.join(missing_configs)}")

    @service_handler
    async def send_notification_email(
        self,
        notification_type: NotificationTypeEnum,
        notification_context: Dict[str, Any],
        organization_id: int,
    ) -> bool:
        """
        Send an email notification to users subscribed to the specified notification type.
        """
        # Validate configuration before performing any operations
        self._validate_configuration()

        # Retrieve subscribed user emails
        recipient_emails = await self.repo.get_subscribed_user_emails(
            notification_type.value, organization_id
        )
        if not recipient_emails:
            logger.info(f"""No subscribers for notification type: {
                        notification_type.value}""")
            return False

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
            return template.render(**context)
        except Exception as e:
            logger.error(f"Template rendering error: {str(e)}")
            raise ValueError(
                f"Failed to render email template for {template_name}")

    def _build_email_payload(
        self, recipients: List[str], context: Dict[str, Any], body: str
    ) -> Dict[str, Any]:
        """
        Build the payload for sending an email via CHES.
        """
        return {
            "bcc": recipients,
            "to": ["Undisclosed recipients<donotreply@gov.bc.ca>"],
            "from": f"{settings.ches_sender_name} <{settings.ches_sender_email}>",
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
        # Validate configuration before performing any operations
        self._validate_configuration()

        token = await self.get_ches_token()
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

    async def get_ches_token(self) -> str:
        """
        Retrieve and cache the CHES access token.
        """
        # Validate configuration before performing any operations
        self._validate_configuration()

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