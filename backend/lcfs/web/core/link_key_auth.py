"""
Link Key Authentication Middleware
Handles anonymous form access using secure link keys
"""

import structlog
from typing import Callable, Optional
from functools import wraps

from fastapi import Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta, timezone

from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.organization.OrganizationLinkKey import OrganizationLinkKey
from lcfs.db.models.organization.OrganizationStatus import OrgStatusEnum
from lcfs.db.models.form.Form import Form
from lcfs.settings import settings
from lcfs.web.core.decorators import request_var, session_var


logger = structlog.get_logger(__name__)


class LinkKeyUser:
    """
    Mock user object for anonymous access via link key
    """

    def __init__(self, link_key_record: OrganizationLinkKey):
        self.organization_id = link_key_record.organization_id
        self.organization = link_key_record.organization
        self.form = link_key_record.form
        self.form_id = link_key_record.form_id
        self.form_name = link_key_record.form_name
        self.form_slug = link_key_record.form_slug
        self.form_description = link_key_record.form_description
        self.username = f"anonymous_user_{link_key_record.organization_id}_{link_key_record.form_slug}"
        self.keycloak_username = f"link_key_user_{link_key_record.organization_id}_{link_key_record.form_slug}"
        self.is_link_key_user = True
        self.role_names = ["ANONYMOUS"]


def link_key_expiry_from_now() -> datetime:
    """
    Default expiry for a newly issued or regenerated link key.

    The column is a naive DateTime that is read back as UTC, so this returns a
    naive UTC value.
    """
    return (
        datetime.now(timezone.utc) + timedelta(days=settings.link_key_ttl_days)
    ).replace(tzinfo=None)


def is_link_key_usable(
    link_key_record: OrganizationLinkKey, form_slug: Optional[str] = None
) -> bool:
    """
    Single source of truth for whether a link key may grant access.

    A key is usable only when it
    - has an expiry date that is still in the future (a key with no expiry is
      rejected, not treated as permanent),
    - belongs to a Registered organization, and
    - when ``form_slug`` is given, was issued for that exact form.
    """
    if form_slug is not None and link_key_record.form_slug != form_slug:
        return False

    expiry = link_key_record.expiry_date
    if expiry is None:
        return False
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if expiry <= datetime.now(timezone.utc):
        return False

    organization = link_key_record.organization
    org_status = getattr(organization, "org_status", None)
    if org_status is None or org_status.status != OrgStatusEnum.Registered:
        return False

    return True


async def validate_link_key_access(
    request: Request, db: AsyncSession
) -> Optional[LinkKeyUser]:
    """
    Validate the link key in the request path and return an anonymous user.

    The key must have been issued for the form named in the same path. Callers
    get ``None`` for every kind of rejection so the response does not reveal
    why a key was refused. Key material is never logged.
    """
    link_key = request.path_params.get("link_key")
    form_slug = request.path_params.get("form_slug")

    if not link_key or not form_slug:
        logger.info("No link key provided")
        return None

    # Query organization link key with organization and form data
    result = await db.execute(
        select(OrganizationLinkKey)
        .join(Organization)
        .join(Form)
        .where(OrganizationLinkKey.link_key == link_key)
    )
    link_key_record = result.scalar_one_or_none()

    if not link_key_record or not is_link_key_usable(link_key_record, form_slug):
        logger.info("Link key rejected", form_slug=form_slug)
        return None

    logger.info(
        "Link key access granted",
        organization_id=link_key_record.organization_id,
        organization_name=link_key_record.organization.name,
        form_id=link_key_record.form_id,
        form_name=link_key_record.form_name,
        form_slug=link_key_record.form_slug,
        ip_address=request.client.host if request.client else "unknown",
    )

    return LinkKeyUser(link_key_record)


def anonymous_form_handler(
    allowed_roles: list = None,
    allow_link_key_access: bool = True,
    require_authenticated_user: bool = False,
):
    """
    Decorator for handling both authenticated users and anonymous link key access

    Args:
        allowed_roles: List of roles allowed to access (e.g., [RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR])
        allow_link_key_access: Whether to allow access via link key
        require_authenticated_user: Whether to require an authenticated user
    """

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            request_var.set(request)
            session = (
                request.state.session if hasattr(request.state, "session") else None
            )
            session_var.set(session)

            user = getattr(request, "user", None)

            # Check for authenticated user first (but skip UnauthenticatedUser)
            if (
                user
                and not getattr(user, "is_link_key_user", False)
                and not user.__class__.__name__ == "UnauthenticatedUser"
            ):
                # Check if user has required role
                if allowed_roles:
                    user_roles = getattr(user, "role_names", [])
                    if not any(role.value in user_roles for role in allowed_roles):
                        raise HTTPException(
                            status_code=403, detail="Insufficient permissions"
                        )
                # Normal authenticated flow
                return await func(request, *args, **kwargs)

            # Check for link key access if allowed
            if allow_link_key_access:
                # Get database session manually
                from lcfs.db.dependencies import get_async_db_session

                db_gen = get_async_db_session(request)
                db = await db_gen.__anext__()
                try:
                    link_key_user = await validate_link_key_access(request, db)
                    if link_key_user:
                        # Set the link key user in request state
                        request.state.user = link_key_user
                        return await func(request, *args, **kwargs)
                finally:
                    await db_gen.aclose()

            # If we require an authenticated user and have neither
            if require_authenticated_user:
                raise HTTPException(status_code=401, detail="Authentication required")

            # No valid authentication found
            raise HTTPException(
                status_code=404, detail="Invalid or expired access link"
            )

        return wrapper

    return decorator
