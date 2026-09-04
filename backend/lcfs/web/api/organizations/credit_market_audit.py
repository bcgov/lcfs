"""Helpers for building credit trading market audit entries.

The credit market audit log stores a snapshot of an organization's listing after
each change, plus a field-level diff so IDIR users can see exactly what changed.
These helpers are shared by every code path that can modify the listing fields.
"""

from typing import Any, Dict, Optional

CREDIT_MARKET_FIELDS = (
    "credit_market_contact_name",
    "credit_market_contact_email",
    "credit_market_contact_phone",
    "credit_market_is_seller",
    "credit_market_is_buyer",
    "credits_to_sell",
    "display_in_credit_market",
)

AUDIT_ACTION_ADDED = "Added"
AUDIT_ACTION_UPDATED = "Updated"
AUDIT_ACTION_REMOVED = "Removed"


def credit_market_snapshot(organization: Any) -> Dict[str, Any]:
    """Build a normalized snapshot of the credit market fields for diffing."""
    return {
        "credit_market_contact_name": organization.credit_market_contact_name,
        "credit_market_contact_email": organization.credit_market_contact_email,
        "credit_market_contact_phone": organization.credit_market_contact_phone,
        "credit_market_is_seller": bool(organization.credit_market_is_seller),
        "credit_market_is_buyer": bool(organization.credit_market_is_buyer),
        "credits_to_sell": int(organization.credits_to_sell or 0),
        "display_in_credit_market": bool(organization.display_in_credit_market),
    }


def diff_credit_market_snapshots(
    before: Dict[str, Any], after: Dict[str, Any]
) -> Dict[str, Dict[str, Any]]:
    """Return {field: {"from": old, "to": new}} for every field that changed."""
    return {
        field: {"from": before.get(field), "to": after.get(field)}
        for field in CREDIT_MARKET_FIELDS
        if before.get(field) != after.get(field)
    }


def credit_market_audit_action(
    before: Dict[str, Any], after: Dict[str, Any]
) -> Optional[str]:
    """Classify a change as Added / Removed / Updated, or None when nothing changed."""
    if before == after:
        return None
    was_displayed = bool(before.get("display_in_credit_market"))
    is_displayed = bool(after.get("display_in_credit_market"))
    if is_displayed and not was_displayed:
        return AUDIT_ACTION_ADDED
    if was_displayed and not is_displayed:
        return AUDIT_ACTION_REMOVED
    return AUDIT_ACTION_UPDATED
