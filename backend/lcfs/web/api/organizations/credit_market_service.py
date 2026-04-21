import json
import math
from typing import Dict

import structlog
from fastapi import Depends

from lcfs.db.models.organization.CreditMarketAuditLog import CreditMarketAuditLog
from lcfs.db.models.organization.Organization import Organization
from lcfs.settings import settings
from lcfs.web.api.base import (
    NotificationTypeEnum,
    PaginationRequestSchema,
    PaginationResponseSchema,
    apply_filter_conditions,
    get_field_for_filter,
    validate_pagination,
)
from lcfs.web.api.notification.schema import (
    NotificationMessageSchema,
    NotificationRequestSchema,
)
from lcfs.web.api.notification.services import NotificationService
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

from .repo import OrganizationsRepository
from .schema import (
    CreditMarketAuditLogItemSchema,
    CreditMarketAuditLogListResponseSchema,
    OrganizationCreditMarketListingSchema,
)


logger = structlog.get_logger(__name__)


class OrganizationCreditMarketService:
    def __init__(
        self,
        repo: OrganizationsRepository = Depends(OrganizationsRepository),
        transaction_repo: TransactionRepository = Depends(TransactionRepository),
        notification_service: NotificationService = Depends(NotificationService),
    ) -> None:
        self.repo = repo
        self.transaction_repo = transaction_repo
        self.notification_service = notification_service

    @staticmethod
    def _credit_market_snapshot(organization: Organization) -> Dict[str, object]:
        """Build a normalized snapshot for credit market change detection."""
        return {
            "credit_market_contact_name": organization.credit_market_contact_name,
            "credit_market_contact_email": organization.credit_market_contact_email,
            "credit_market_contact_phone": organization.credit_market_contact_phone,
            "credit_market_is_seller": bool(organization.credit_market_is_seller),
            "credit_market_is_buyer": bool(organization.credit_market_is_buyer),
            "credits_to_sell": int(organization.credits_to_sell or 0),
            "display_in_credit_market": bool(organization.display_in_credit_market),
        }

    @staticmethod
    def _role_in_market(is_seller: bool, is_buyer: bool) -> str | None:
        roles = []
        if is_seller:
            roles.append("Seller")
        if is_buyer:
            roles.append("Buyer")
        return ", ".join(roles) if roles else None

    async def calculate_total_balance(self, organization_id: int) -> int:
        return await self.transaction_repo.calculate_total_balance(organization_id)

    @service_handler
    async def update_organization_credit_market_details(
        self,
        organization_id: int,
        credit_market_data: dict,
        user=None,
        skip_notifications: bool = False,
    ):
        """
        Update only the credit market contact details for an organization.
        This method only updates the specific credit market fields without affecting other organization data.

        Args:
            organization_id: Target organization identifier.
            credit_market_data: Credit market fields to update.
            user: Requesting user profile (used for auditing).
            skip_notifications: When True, suppresses outbound credit market notifications
                even if the update would normally trigger them. Intended for IDIR/government edits.
        """
        organization = await self.repo.get_organization(organization_id)
        if not organization:
            raise DataNotFoundException("Organization not found")

        before_snapshot = self._credit_market_snapshot(organization)

        was_displayed_in_market = organization.display_in_credit_market or False
        old_credits_to_sell = organization.credits_to_sell or 0

        allowed_fields = {
            "credit_market_contact_name",
            "credit_market_contact_email",
            "credit_market_contact_phone",
            "credit_market_is_seller",
            "credit_market_is_buyer",
            "credits_to_sell",
            "display_in_credit_market",
        }

        for key, value in credit_market_data.items():
            if key in allowed_fields and hasattr(organization, key):
                if key == "credits_to_sell" and value is not None:
                    if value < 0:
                        raise ValueError("Credits to sell cannot be negative")

                    total_balance = await self.calculate_total_balance(
                        organization.organization_id
                    )
                    if value > total_balance:
                        raise ValueError(
                            f"Credits to sell ({value}) cannot exceed available balance ({total_balance})"
                        )

                setattr(organization, key, value)

        if user:
            organization.update_user = user.keycloak_username

        updated_organization = await self.repo.update_organization(organization)
        after_snapshot = self._credit_market_snapshot(updated_organization)

        if before_snapshot != after_snapshot and bool(
            updated_organization.display_in_credit_market
        ):
            changed_by = (
                user.keycloak_username if user else updated_organization.update_user
            )
            await self.repo.create_credit_market_audit_log(
                organization=updated_organization, changed_by=changed_by
            )

        is_now_displayed = updated_organization.display_in_credit_market or False
        new_credits_to_sell = updated_organization.credits_to_sell or 0

        is_new_listing = (
            is_now_displayed
            and new_credits_to_sell > 0
            and (not was_displayed_in_market or old_credits_to_sell == 0)
        )

        if (
            is_new_listing
            and settings.feature_credit_market_notifications
            and not skip_notifications
        ):
            await self._send_credit_market_notification(updated_organization, user)

        return updated_organization

    @service_handler
    async def get_credit_market_listings(self):
        """
        Get organizations that have opted to display in the credit trading market.
        Returns organizations with their credit market contact details for public viewing.
        """
        organizations = await self.repo.get_credit_market_organizations()

        return [
            OrganizationCreditMarketListingSchema(
                organization_id=org.organization_id,
                organization_name=org.name,
                credits_to_sell=org.credits_to_sell or 0,
                display_in_credit_market=org.display_in_credit_market,
                credit_market_is_seller=org.credit_market_is_seller or False,
                credit_market_is_buyer=org.credit_market_is_buyer or False,
                credit_market_contact_name=org.credit_market_contact_name,
                credit_market_contact_email=org.credit_market_contact_email,
                credit_market_contact_phone=org.credit_market_contact_phone,
            )
            for org in organizations
        ]

    @service_handler
    async def get_credit_market_audit_logs_paginated(
        self, pagination: PaginationRequestSchema
    ) -> CreditMarketAuditLogListResponseSchema:
        """
        Fetch paginated credit market audit logs with filtering and sorting.
        """
        conditions = []
        pagination = validate_pagination(pagination)

        if pagination.filters:
            for filter_model in pagination.filters:
                filter_value = filter_model.filter
                filter_option = filter_model.type
                filter_type = filter_model.filter_type

                if filter_type == "date":
                    filter_value = []
                    if filter_model.date_from:
                        filter_value.append(filter_model.date_from)
                    if filter_model.date_to:
                        filter_value.append(filter_model.date_to)
                    if not filter_value:
                        continue

                if filter_model.field == "organization_name":
                    field = get_field_for_filter(Organization, "name")
                else:
                    field = get_field_for_filter(
                        CreditMarketAuditLog, filter_model.field
                    )
                if field is None:
                    continue

                condition = apply_filter_conditions(
                    field, filter_value, filter_option, filter_type
                )
                if condition is not None:
                    conditions.append(condition)

        offset = (pagination.page - 1) * pagination.size
        limit = pagination.size
        audit_logs, total_count = (
            await self.repo.get_credit_market_audit_logs_paginated(
                offset, limit, conditions, pagination.sort_orders
            )
        )

        rows = [
            CreditMarketAuditLogItemSchema(
                credit_market_audit_log_id=entry.credit_market_audit_log_id,
                organization_name=entry.organization.name if entry.organization else "",
                credits_to_sell=entry.credits_to_sell or 0,
                role_in_market=self._role_in_market(
                    bool(entry.credit_market_is_seller),
                    bool(entry.credit_market_is_buyer),
                ),
                contact_person=entry.contact_person,
                phone=entry.phone,
                email=entry.email,
                changed_by=entry.changed_by,
                uploaded_date=entry.create_date,
            )
            for entry in audit_logs
        ]

        return CreditMarketAuditLogListResponseSchema(
            credit_market_audit_logs=rows,
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size)
                if pagination.size
                else 0,
            ),
        )

    async def _send_credit_market_notification(
        self, organization: Organization, user=None
    ):
        """
        Send notification to subscribed BCeID users when new credits are listed for sale.
        """
        try:
            message_data = {
                "organizationName": organization.name,
                "creditsToSell": organization.credits_to_sell,
                "service": "CreditMarket",
                "action": "CreditsListedForSale",
            }

            notification_data = NotificationMessageSchema(
                type="Credit market - credits listed for sale",
                related_transaction_id=f"CM{organization.organization_id}",
                message=json.dumps(message_data),
                related_organization_id=organization.organization_id,
                origin_user_profile_id=user.user_profile_id if user else None,
            )

            await self.notification_service.send_notification(
                NotificationRequestSchema(
                    notification_types=[
                        NotificationTypeEnum.BCEID__CREDIT_MARKET__CREDITS_LISTED_FOR_SALE
                    ],
                    notification_context={
                        "subject": f"LCFS Credit Market - New Credits Available from {organization.name}"
                    },
                    notification_data=notification_data,
                )
            )

            logger.info(
                f"Credit market notification sent for organization {organization.organization_id}"
            )

        except Exception as e:
            logger.error(f"Failed to send credit market notification: {str(e)}")
