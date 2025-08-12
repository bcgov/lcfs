# TODO: Example APIs! Replace with actual business logic.

import structlog
from typing import Optional

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from lcfs.web.core.link_key_auth import anonymous_form_handler

from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.form.Form import Form

logger = structlog.get_logger(__name__)
router = APIRouter()


# Schemas
class FormResponse(BaseModel):
    form_id: int
    name: str
    slug: str
    description: Optional[str] = None
    organization_name: Optional[str] = None
    status: str
    message: str


@router.get("/{form_slug}")
@anonymous_form_handler(
    allowed_roles=None,  # Allow any authenticated user
    allow_link_key_access=False,
    require_authenticated_user=True,
)
async def get_form_by_slug_authenticated(
    request: Request,
    form_slug: str,
    db: AsyncSession = Depends(get_async_db_session),
):
    """
    Get form by slug for authenticated users (BCeID users)
    """
    logger.info(
        "Authenticated user accessing form",
        form_slug=form_slug,
        user=getattr(request.user, "username", "unknown"),
    )

    result = await db.execute(select(Form).where(Form.slug == form_slug))
    form = result.scalar_one_or_none()

    if not form:
        raise HTTPException(
            status_code=404, detail=f"Form '{form_slug}' not found or not available"
        )

    # For authenticated users, get organization name from their profile
    organization_name = None
    if hasattr(request.user, "organization") and request.user.organization:
        organization_name = request.user.organization.name

    return FormResponse(
        form_id=form.form_id,
        name=form.name,
        slug=form.slug,
        description=form.description,
        organization_name=organization_name,
        status="loaded",
        message=f"Form '{form.name}' has been successfully loaded.",
    )


@router.get("/{form_slug}/{link_key}")
@anonymous_form_handler(
    allowed_roles=[RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR],
    allow_link_key_access=True,
    require_authenticated_user=False,
)
async def get_form_by_slug_and_key(
    request: Request,
    form_slug: str,
    link_key: str,
    db: AsyncSession = Depends(get_async_db_session),
):
    """
    Get form by slug with link key - accessible with link key or government/admin users
    """

    result = await db.execute(select(Form).where(Form.slug == form_slug))
    form = result.scalar_one_or_none()

    if not form:
        raise HTTPException(
            status_code=404, detail=f"Form '{form_slug}' not found or not available"
        )

    organization_name = None
    # Check if we have a link key user from the state
    link_key_user = getattr(request.state, "user", None)
    if link_key_user and getattr(link_key_user, "is_link_key_user", False):
        organization_name = link_key_user.organization.name

    return FormResponse(
        form_id=form.form_id,
        name=form.name,
        slug=form.slug,
        description=form.description,
        organization_name=organization_name,
        status="loaded",
        message=f"Form '{form.name}' has been successfully loaded.",
    )
