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
from datetime import datetime, timezone

from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.organization.OrganizationLinkKey import OrganizationLinkKey
from lcfs.db.models.form.Form import Form
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


async def validate_link_key_access(
    request: Request, db: AsyncSession
) -> Optional[LinkKeyUser]:
    """
    Validate link key from query parameters and return anonymous user
    """
    # Accept link key from query parameter or path parameter (mounted routes pass path params)
    link_key = request.path_params.get("link_key") or request.query_params.get("key")

    logger.info(
        "Validating link key access",
        link_key=link_key[:20] + "..." if link_key else None,
    )

    if not link_key:
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

    logger.info("Link key query result", found=link_key_record is not None)

    if not link_key_record:
        return None

    # Enforce expiry if set
    if getattr(link_key_record, "expiry_date", None):
        now = datetime.now(timezone.utc)
        expiry = link_key_record.expiry_date
        # Ensure both are timezone-aware for safe comparison
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        if expiry <= now:
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
