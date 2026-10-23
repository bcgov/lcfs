"""Build an account-change email from immutable before/after snapshots."""

from datetime import datetime
from typing import Any

from lcfs.db.models.user.Role import RoleEnum
from lcfs.utils.dates import PACIFIC_TZ
from lcfs.web.api.user.schema import UserBaseSchema

SubscriptionSnapshot = dict[tuple[str, str], bool]


def notification_label(subscription: tuple[str, str]) -> str:
    type_name, channel = subscription
    # Notification type names contain an audience prefix, category and event.
    parts = type_name.split("__")[1:]
    label = ": ".join(part.replace("_", " ").title() for part in parts)
    channel_label = "In-app" if channel == "IN_APP" else "Email"
    return f"{label or type_name} ({channel_label})"


def subscription_snapshot(subscriptions: list[dict[str, Any]]) -> SubscriptionSnapshot:
    return {
        (sub["notification_type_name"], sub["notification_channel_name"]): bool(
            sub["is_enabled"]
        )
        for sub in subscriptions
    }


def build_account_change_context(
    before: UserBaseSchema,
    after: UserBaseSchema,
    before_subscriptions: SubscriptionSnapshot,
    after_subscriptions: SubscriptionSnapshot,
    changed_by: str,
) -> dict[str, Any] | None:
    old_roles = {role.name for role in (before.roles or []) if role.name}
    new_roles = {role.name for role in (after.roles or []) if role.name}
    old_enabled = {key for key, enabled in before_subscriptions.items() if enabled}
    new_enabled = {key for key, enabled in after_subscriptions.items() if enabled}
    preferences_removed = before_subscriptions.keys() - after_subscriptions.keys()
    preferences_added = after_subscriptions.keys() - before_subscriptions.keys()
    if (
        old_roles == new_roles
        and before.is_active == after.is_active
        and before_subscriptions == after_subscriptions
    ):
        return None

    descriptions = {
        role.name: role.description
        for role in [*(before.roles or []), *(after.roles or [])]
        if role.name
    }
    removed_roles = old_roles - new_roles
    return {
        "subject": "LCFS account change notification",
        "user_name": " ".join(
            name for name in [after.first_name, after.last_name] if name
        )
        or after.keycloak_username,
        "changed_by": changed_by,
        "changed_at": datetime.now(PACIFIC_TZ).strftime("%Y-%m-%d %H:%M:%S %Z"),
        "status_changed": before.is_active != after.is_active,
        "old_status": "Active" if before.is_active else "Inactive",
        "new_status": "Active" if after.is_active else "Inactive",
        "roles_added": sorted(new_roles - old_roles),
        "roles_removed": sorted(removed_roles),
        "new_roles": sorted(new_roles),
        "role_descriptions": descriptions,
        "preferences_changed": before_subscriptions != after_subscriptions,
        "notifications_removed": [
            notification_label(key) for key in sorted(old_enabled - new_enabled)
        ],
        "notifications_added": [
            notification_label(key) for key in sorted(new_enabled - old_enabled)
        ],
        "preferences_removed": [
            notification_label(key) for key in sorted(preferences_removed)
        ],
        "preferences_added": [
            f"{notification_label(key)}: {'enabled' if after_subscriptions[key] else 'disabled'}"
            for key in sorted(preferences_added)
        ],
        "assigned_work": {},
        "loses_assigned_work_access": before.is_active
        and (not after.is_active or RoleEnum.ANALYST.value in removed_roles),
    }
