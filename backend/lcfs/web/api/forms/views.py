import structlog
from typing import Any, Literal

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from starlette.responses import StreamingResponse

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.form.Form import Form
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.forms.registry import FORM_REGISTRY
from lcfs.web.api.forms.schema import FormResponse
from lcfs.web.core.link_key_auth import anonymous_form_handler

logger = structlog.get_logger(__name__)
router = APIRouter()


def _org_name(request: Request) -> str | None:
    if (
        request.user
        and request.user.__class__.__name__ != "UnauthenticatedUser"
        and request.user.organization
    ):
        return request.user.organization.name

    if (
        hasattr(request.state, "user")
        and request.state.user
        and request.state.user.is_link_key_user
        and request.state.user.organization
    ):
        return request.state.user.organization.name

    return None


async def _get_form_or_404(db: AsyncSession, form_slug: str) -> Form:
    result = await db.execute(select(Form).where(Form.slug == form_slug))
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail=f"Form '{form_slug}' not found.")
    return form


async def _export(form: Form, body: dict, fmt: str) -> StreamingResponse:
    """Validate the request body against the form's registered schema and export."""
    handler = FORM_REGISTRY.get(form.slug)
    if not handler:
        raise HTTPException(
            status_code=400,
            detail=f"Export is not supported for form '{form.slug}'.",
        )
    try:
        payload = handler.schema.model_validate(body)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    exporter_cls = handler.pdf_exporter if fmt == "pdf" else handler.docx_exporter
    return await exporter_cls().export(payload, form_name=form.name)


def _form_response(form: Form, request: Request) -> FormResponse:
    return FormResponse(
        form_id=form.form_id,
        name=form.name,
        slug=form.slug,
        description=form.description,
        organization_name=_org_name(request),
        status="loaded",
        message=f"Form '{form.name}' loaded successfully.",
    )


# ── Read endpoints ─────────────────────────────────────────────────────────────


@router.get("/{form_slug}")
@anonymous_form_handler(
    allowed_roles=None,
    allow_link_key_access=False,
    require_authenticated_user=True,
)
async def get_form_authenticated(
    request: Request,
    form_slug: str,
    db: AsyncSession = Depends(get_async_db_session),
) -> FormResponse:
    form = await _get_form_or_404(db, form_slug)
    return _form_response(form, request)


@router.get("/{form_slug}/{link_key}")
@anonymous_form_handler(
    allowed_roles=[RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR],
    allow_link_key_access=True,
    require_authenticated_user=False,
)
async def get_form_by_link_key(
    request: Request,
    form_slug: str,
    link_key: str,
    db: AsyncSession = Depends(get_async_db_session),
) -> FormResponse:
    form = await _get_form_or_404(db, form_slug)
    return _form_response(form, request)


# ── Export endpoints ───────────────────────────────────────────────────────────


@router.post("/{form_slug}/export")
@anonymous_form_handler(
    allowed_roles=None,
    allow_link_key_access=False,
    require_authenticated_user=True,
)
async def export_form_authenticated(
    request: Request,
    form_slug: str,
    body: dict[str, Any] = Body(...),
    format: Literal["docx", "pdf"] = Query(default="docx"),
    db: AsyncSession = Depends(get_async_db_session),
) -> StreamingResponse:
    form = await _get_form_or_404(db, form_slug)
    logger.info("form export", form_slug=form_slug, format=format)
    return await _export(form, body, format)


@router.post("/{form_slug}/{link_key}/export")
@anonymous_form_handler(
    allowed_roles=[RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR],
    allow_link_key_access=True,
    require_authenticated_user=False,
)
async def export_form_by_link_key(
    request: Request,
    form_slug: str,
    link_key: str,
    body: dict[str, Any] = Body(...),
    format: Literal["docx", "pdf"] = Query(default="docx"),
    db: AsyncSession = Depends(get_async_db_session),
) -> StreamingResponse:
    form = await _get_form_or_404(db, form_slug)
    logger.info("form export via link key", form_slug=form_slug, format=format)
    return await _export(form, body, format)
