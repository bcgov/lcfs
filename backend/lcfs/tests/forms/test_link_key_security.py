"""
Security tests for anonymous form link keys and the declaration export.

Covers: keys bound to their form, expiry, inactive organizations, the
organization name on exported documents, where user text may appear in the PDF
template, the PDF URL fetcher, the render timeout, and field limits.
"""

import asyncio
import io
import re
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import structlog
from docx import Document as DocxDocument
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy import select
from starlette.requests import Request

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.form.Form import Form
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.organization.OrganizationLinkKey import OrganizationLinkKey
from lcfs.db.models.organization.OrganizationStatus import (
    OrganizationStatus,
    OrgStatusEnum,
)
from lcfs.services.redis.dependency import get_redis_client
from lcfs.settings import settings
from lcfs.web.api.forms import export as export_module
from lcfs.web.api.forms.export import (
    _JINJA_ENV,
    FuelSupplierDeclarationPdfExporter,
    _declaration_context,
    _declaration_filename,
    _pdf_url_fetcher,
)
from lcfs.web.api.forms.schema import DeclarationExportRequest
from lcfs.web.application import get_app
from lcfs.web.core.link_key_auth import (
    is_link_key_usable,
    link_key_expiry_from_now,
    validate_link_key_access,
)

SLUG = "fuel-supplier-declaration"
OTHER_SLUG = "other-anonymous-form"
KEY_ORG_NAME = "Key Holder Fuels Ltd."
HOSTILE_ORG_NAME = "Somebody Else Inc."

VALID_BODY = {
    "organization_name": HOSTILE_ORG_NAME,
    "reporting_period": "2025",
    "declaration_type": "Full",
    "contact_name": "Jane Doe",
    "contact_email": "jane@example.com",
    "fuel_type": "Biodiesel",
    "quantity": 1500.5,
    "units": "L",
    "notes": "ok",
    "certified": True,
}


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Pure unit tests: is_link_key_usable ──────────────────────────────────────


def make_record(
    form_slug=SLUG,
    expiry="future",
    org_status=OrgStatusEnum.Registered,
):
    if expiry == "future":
        expiry = _utcnow_naive() + timedelta(days=1)
    elif expiry == "past":
        expiry = _utcnow_naive() - timedelta(seconds=1)
    record = MagicMock()
    record.form_slug = form_slug
    record.expiry_date = expiry
    record.organization.org_status = (
        MagicMock(status=org_status) if org_status is not None else None
    )
    return record


def test_usable_key_is_accepted():
    assert is_link_key_usable(make_record(), SLUG) is True


def test_key_for_another_form_is_rejected():
    assert is_link_key_usable(make_record(form_slug="form-a"), "form-b") is False


def test_expired_key_is_rejected():
    assert is_link_key_usable(make_record(expiry="past"), SLUG) is False


def test_key_without_expiry_is_rejected():
    assert is_link_key_usable(make_record(expiry=None), SLUG) is False


def test_timezone_aware_expiry_is_handled():
    aware = datetime.now(timezone.utc) + timedelta(days=1)
    assert is_link_key_usable(make_record(expiry=aware), SLUG) is True


@pytest.mark.parametrize(
    "status",
    [
        OrgStatusEnum.Unregistered,
        OrgStatusEnum.Suspended,
        OrgStatusEnum.Canceled,
        None,
    ],
)
def test_key_of_inactive_organization_is_rejected(status):
    assert is_link_key_usable(make_record(org_status=status), SLUG) is False


def test_form_is_not_checked_when_no_slug_given():
    """The validate-link-key endpoint has no form in its path."""
    assert is_link_key_usable(make_record(form_slug="anything")) is True


def test_default_expiry_is_in_the_future_and_naive_utc():
    expiry = link_key_expiry_from_now()
    assert expiry.tzinfo is None
    delta = expiry - _utcnow_naive()
    assert timedelta(days=settings.link_key_ttl_days - 1) < delta
    assert delta <= timedelta(days=settings.link_key_ttl_days)


# ── Link key service ─────────────────────────────────────────────────────────


@pytest.fixture
def link_key_service():
    from lcfs.web.api.organizations.link_key_service import OrganizationLinkKeyService

    service = OrganizationLinkKeyService()
    service.repo = MagicMock()
    return service


@pytest.mark.anyio
async def test_generate_link_key_sets_default_expiry(link_key_service):
    repo = link_key_service.repo
    repo.get_organization = AsyncMock(return_value=MagicMock())
    repo.get_form_by_id = AsyncMock(
        return_value=MagicMock(allows_anonymous=True, slug=SLUG)
    )
    repo.get_form_by_id.return_value.name = "Form"
    repo.get_link_key_by_form_id = AsyncMock(return_value=None)
    repo.create_link_key = AsyncMock(side_effect=lambda record: record)

    await link_key_service.generate_link_key(1, 1)

    created = repo.create_link_key.await_args.args[0]
    assert created.expiry_date is not None
    assert created.expiry_date > _utcnow_naive() + timedelta(
        days=settings.link_key_ttl_days - 1
    )


@pytest.mark.anyio
async def test_regenerate_link_key_resets_expiry(link_key_service):
    repo = link_key_service.repo
    repo.get_organization = AsyncMock(return_value=MagicMock())
    repo.get_form_by_id = AsyncMock(return_value=MagicMock(slug=SLUG))
    repo.get_form_by_id.return_value.name = "Form"
    existing = MagicMock(link_key="old", expiry_date=_utcnow_naive())
    repo.get_link_key_by_form_id = AsyncMock(return_value=existing)
    repo.update_link_key = AsyncMock(side_effect=lambda record: record)

    await link_key_service.regenerate_link_key(1, 1)

    assert existing.link_key != "old"
    assert existing.expiry_date > _utcnow_naive() + timedelta(
        days=settings.link_key_ttl_days - 1
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "record",
    [
        make_record(expiry="past"),
        make_record(expiry=None),
        make_record(org_status=OrgStatusEnum.Suspended),
    ],
    ids=["expired", "no-expiry", "inactive-org"],
)
async def test_validate_link_key_rejects_unusable_keys(link_key_service, record):
    link_key_service.repo.get_link_key_by_key = AsyncMock(return_value=record)

    result = await link_key_service.validate_link_key("whatever")

    assert result.is_valid is False


@pytest.mark.anyio
async def test_validate_link_key_accepts_usable_key(link_key_service):
    record = make_record()
    record.organization_id = 1
    record.form_id = 1
    record.form_name = "Form"
    record.organization.name = KEY_ORG_NAME
    link_key_service.repo.get_link_key_by_key = AsyncMock(return_value=record)

    result = await link_key_service.validate_link_key("whatever")

    assert result.is_valid is True


# ── Request-level tests against the real app and database ────────────────────


async def _status(dbsession, status: OrgStatusEnum) -> OrganizationStatus:
    row = await dbsession.scalar(
        select(OrganizationStatus).where(OrganizationStatus.status == status)
    )
    if row is None:
        row = OrganizationStatus(status=status)
        dbsession.add(row)
        await dbsession.flush()
    return row


async def _make_org(
    dbsession, code, status=OrgStatusEnum.Registered, name=KEY_ORG_NAME
):
    org = Organization(
        organization_code=code,
        name=name,
        organization_status_id=(
            await _status(dbsession, status)
        ).organization_status_id,
    )
    dbsession.add(org)
    await dbsession.flush()
    return org


async def _make_form(dbsession, slug, name):
    form = await dbsession.scalar(select(Form).where(Form.slug == slug))
    if form is None:
        form = Form(name=name, slug=slug, allows_anonymous=True)
        dbsession.add(form)
        await dbsession.flush()
    return form


async def _make_key(dbsession, org, form, key, expiry="future"):
    if expiry == "future":
        expiry = _utcnow_naive() + timedelta(days=30)
    elif expiry == "past":
        expiry = _utcnow_naive() - timedelta(days=1)
    record = OrganizationLinkKey(
        organization_id=org.organization_id,
        form_id=form.form_id,
        link_key=key,
        expiry_date=expiry,
    )
    dbsession.add(record)
    await dbsession.flush()
    return record


@pytest.fixture
async def link_key_app(dbsession, dbsession_factory, fake_redis_client):
    """The real app (real auth middleware) wired to the test database session."""
    application = get_app()
    application.dependency_overrides[get_async_db_session] = lambda: dbsession
    application.dependency_overrides[get_redis_client] = lambda: fake_redis_client
    application.state.redis_client = fake_redis_client
    application.state.db_session_factory = dbsession_factory
    application.state.settings = settings

    # anonymous_form_handler opens its own session; point it at the test one.
    async def _session_gen(request):
        yield dbsession

    with patch("lcfs.db.dependencies.get_async_db_session", _session_gen):
        yield application


@pytest.fixture
async def anon_client(link_key_app, anyio_backend):
    async with AsyncClient(
        transport=ASGITransport(app=link_key_app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
async def seeded(dbsession):
    """Two anonymous forms and keys covering each rejection case."""
    form_a = await _make_form(dbsession, SLUG, "Fuel Supplier Declaration")
    form_b = await _make_form(dbsession, OTHER_SLUG, "Other Form")
    org = await _make_org(dbsession, "K001")
    suspended = await _make_org(
        dbsession, "K002", OrgStatusEnum.Suspended, "Suspended Org"
    )
    expired_org = await _make_org(dbsession, "K003", name="Expired Org")
    no_expiry_org = await _make_org(dbsession, "K004", name="No Expiry Org")
    return {
        "good": await _make_key(dbsession, org, form_a, "good-key-" + "a" * 40),
        "other_form": await _make_key(dbsession, org, form_b, "formb-key-" + "b" * 40),
        "expired": await _make_key(
            dbsession, expired_org, form_a, "expired-key-" + "c" * 40, expiry="past"
        ),
        "no_expiry": await _make_key(
            dbsession, no_expiry_org, form_a, "noexpiry-key-" + "d" * 40, expiry=None
        ),
        "suspended": await _make_key(
            dbsession, suspended, form_a, "suspended-key-" + "e" * 40
        ),
    }


@pytest.mark.anyio
async def test_valid_key_loads_form_for_its_organization(anon_client, seeded):
    response = await anon_client.get(f"/api/forms/{SLUG}/{seeded['good'].link_key}")

    assert response.status_code == 200
    assert response.json()["organization_name"] == KEY_ORG_NAME


@pytest.mark.anyio
async def test_key_for_form_a_is_rejected_on_form_b(anon_client, seeded):
    """The key issued for OTHER_SLUG must not open SLUG, or export it."""
    key = seeded["other_form"].link_key

    get_response = await anon_client.get(f"/api/forms/{SLUG}/{key}")
    export_response = await anon_client.post(
        f"/api/forms/{SLUG}/{key}/export?format=docx", json=VALID_BODY
    )
    own_form = await anon_client.get(f"/api/forms/{OTHER_SLUG}/{key}")

    assert get_response.status_code == 404
    assert export_response.status_code == 404
    assert own_form.status_code == 200


@pytest.mark.anyio
@pytest.mark.parametrize("case", ["expired", "no_expiry", "suspended"])
async def test_unusable_keys_are_rejected(anon_client, seeded, case):
    key = seeded[case].link_key

    get_response = await anon_client.get(f"/api/forms/{SLUG}/{key}")
    export_response = await anon_client.post(
        f"/api/forms/{SLUG}/{key}/export?format=docx", json=VALID_BODY
    )

    assert get_response.status_code == 404
    assert export_response.status_code == 404


@pytest.mark.anyio
async def test_export_uses_key_organization_not_body(anon_client, seeded):
    """DOCX export names the key's organization, whatever the body says."""
    response = await anon_client.post(
        f"/api/forms/{SLUG}/{seeded['good'].link_key}/export?format=docx",
        json=VALID_BODY,
    )

    assert response.status_code == 200
    doc = DocxDocument(io.BytesIO(response.content))
    text = "\n".join(
        [p.text for p in doc.paragraphs]
        + [c.text for t in doc.tables for r in t.rows for c in r.cells]
        + [p.text for p in doc.sections[0].footer.paragraphs]
    )
    assert KEY_ORG_NAME in text
    assert HOSTILE_ORG_NAME not in text
    assert "Key_Holder_Fuels_Ltd_" in response.headers["content-disposition"]


@pytest.mark.anyio
async def test_pdf_export_renders_key_organization_even_if_body_omits_it(
    anon_client, seeded
):
    captured = {}

    def fake_render(html_str):
        captured["html"] = html_str
        return b"%PDF-1.7 fake"

    body = {k: v for k, v in VALID_BODY.items() if k != "organization_name"}
    with patch.object(export_module, "_render_pdf", fake_render):
        response = await anon_client.post(
            f"/api/forms/{SLUG}/{seeded['good'].link_key}/export?format=pdf",
            json=body,
        )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert KEY_ORG_NAME in captured["html"]
    assert HOSTILE_ORG_NAME not in captured["html"]


@pytest.mark.anyio
async def test_key_material_is_not_logged(anon_client, seeded):
    key = seeded["good"].link_key
    bad_key = seeded["expired"].link_key

    with structlog.testing.capture_logs() as logs:
        await anon_client.get(f"/api/forms/{SLUG}/{key}")
        await anon_client.get(f"/api/forms/{SLUG}/{bad_key}")

    rendered = repr(logs)
    for secret in (key, bad_key):
        assert secret not in rendered
        assert secret[:20] not in rendered


@pytest.mark.anyio
async def test_validate_link_key_access_ignores_query_string_key(dbsession, seeded):
    """The key comes from the path only; ``?key=`` is not an alternative."""
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": f"/api/forms/{SLUG}",
            "query_string": f"key={seeded['good'].link_key}".encode(),
            "headers": [],
            "path_params": {"form_slug": SLUG},
        }
    )

    assert await validate_link_key_access(request, dbsession) is None


@pytest.mark.anyio
@pytest.mark.parametrize(
    "case,is_valid",
    [
        ("good", True),
        ("expired", False),
        ("no_expiry", False),
        ("suspended", False),
    ],
)
async def test_validate_link_key_endpoint_logic_with_real_repo(
    dbsession, seeded, case, is_valid
):
    """validate-link-key applies the same rules, reading real rows (no lazy loads)."""
    from lcfs.web.api.organizations.link_key_service import OrganizationLinkKeyService
    from lcfs.web.api.organizations.repo import OrganizationsRepository

    service = OrganizationLinkKeyService(repo=OrganizationsRepository(db=dbsession))

    result = await service.validate_link_key(seeded[case].link_key)

    assert result.is_valid is is_valid


# ── PDF template ─────────────────────────────────────────────────────────────

CSS_PAYLOAD = (
    '"; } </style><img src="file:///etc/passwd"> '
    "@import url(http://169.254.169.254/latest/meta-data/); {{ 7*7 }}"
)


def _render_template(**overrides) -> str:
    payload = DeclarationExportRequest.model_validate(
        {**VALID_BODY, "organization_name": CSS_PAYLOAD, **overrides}
    )
    ctx = _declaration_context(payload, "Fuel Supplier Declaration")
    return _JINJA_ENV.get_template("fuel-supplier-declaration.html").render(**ctx)


def test_template_renders_no_user_text_inside_style():
    html = _render_template(reporting_period="2025", contact_name="<b>x</b>")

    style_blocks = re.findall(r"<style>(.*?)</style>", html, re.S)
    assert len(style_blocks) == 1
    style = style_blocks[0]
    for fragment in ("passwd", "169.254", "@import", "</style", "49", "<b>"):
        assert fragment not in style


def test_template_escapes_user_text_in_body():
    html = _render_template()

    assert "<img src=" not in html
    assert "&lt;img src=" in html
    assert "</style><img" not in html


def test_template_style_block_is_independent_of_user_input():
    a = _render_template(reporting_period="2025", organization_name="Alpha")
    b = _render_template(reporting_period="2026", organization_name="Beta")

    get_style = lambda h: re.search(r"<style>(.*?)</style>", h, re.S).group(1)
    assert get_style(a) == get_style(b)


# ── PDF URL fetcher ──────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/hostname",
        "http://127.0.0.1:1/internal",
        "https://169.254.169.254/latest/meta-data/",
        "ftp://example.com/x",
    ],
)
def test_pdf_url_fetcher_refuses_external_urls(url):
    fetcher = _pdf_url_fetcher()
    call = getattr(fetcher, "fetch", fetcher)

    with pytest.raises(Exception):
        call(url)


def test_render_pdf_passes_the_restricted_fetcher_to_weasyprint():
    pytest.importorskip("weasyprint")
    html_cls = MagicMock()
    html_cls.return_value.write_pdf.return_value = b"%PDF"

    with patch("weasyprint.HTML", html_cls):
        export_module._render_pdf("<p>x</p>")

    fetcher = html_cls.call_args.kwargs["url_fetcher"]
    call = getattr(fetcher, "fetch", fetcher)
    with pytest.raises(Exception):
        call("file:///etc/hostname")


def test_real_render_refuses_local_file_references(tmp_path, caplog):
    """A stylesheet reference to a local file is refused, not loaded."""
    pytest.importorskip("weasyprint")
    stylesheet = tmp_path / "secret.css"
    stylesheet.write_text("body { background: red }")
    html = f'<link rel="stylesheet" href="{stylesheet.as_uri()}"><p>hello</p>'

    with caplog.at_level("WARNING", logger="weasyprint"):
        pdf = export_module._render_pdf(html)

    assert pdf.startswith(b"%PDF")
    assert "not allowed" in caplog.text or "disallowed protocol" in caplog.text


# ── Render off the loop, with a timeout ──────────────────────────────────────


def _declaration_payload():
    return DeclarationExportRequest.model_validate(VALID_BODY)


@pytest.mark.anyio
async def test_pdf_render_does_not_block_the_event_loop():
    ticks = 0

    async def ticker():
        nonlocal ticks
        while True:
            await asyncio.sleep(0.01)
            ticks += 1

    def slow_render(html_str):
        time.sleep(0.3)
        return b"%PDF"

    task = asyncio.create_task(ticker())
    try:
        with patch.object(export_module, "_render_pdf", slow_render):
            await FuelSupplierDeclarationPdfExporter().export(_declaration_payload())
    finally:
        task.cancel()

    assert ticks >= 10  # a blocked loop would have ticked ~0 times


@pytest.mark.anyio
async def test_pdf_render_times_out_with_504():
    def slow_render(html_str):
        time.sleep(0.5)
        return b"%PDF"

    with patch.object(export_module, "_render_pdf", slow_render), patch.object(
        settings, "pdf_render_timeout_seconds", 0.05
    ):
        with pytest.raises(HTTPException) as exc_info:
            await FuelSupplierDeclarationPdfExporter().export(_declaration_payload())

    assert exc_info.value.status_code == 504


# ── Field limits and filenames ───────────────────────────────────────────────


@pytest.mark.parametrize(
    "field,limit",
    [
        ("organization_name", 500),
        ("contact_name", 200),
        ("fuel_type", 200),
        ("units", 50),
        ("notes", 2000),
        ("reporting_period", 9),
    ],
)
def test_string_fields_have_a_maximum_length(field, limit):
    DeclarationExportRequest.model_validate({**VALID_BODY, field: "x" * limit})
    with pytest.raises(ValidationError):
        DeclarationExportRequest.model_validate(
            {**VALID_BODY, field: "x" * (limit + 1)}
        )


def test_email_has_a_maximum_length():
    long_email = "a" * 250 + "@example.com"
    with pytest.raises(ValidationError):
        DeclarationExportRequest.model_validate(
            {**VALID_BODY, "contact_email": long_email}
        )


@pytest.mark.parametrize("quantity", [float("inf"), float("nan"), 1e300])
def test_quantity_rejects_non_finite_and_absurd_values(quantity):
    with pytest.raises(ValidationError):
        DeclarationExportRequest.model_validate({**VALID_BODY, "quantity": quantity})


def test_filename_is_ascii_and_header_safe():
    payload = DeclarationExportRequest.model_validate(
        {
            **VALID_BODY,
            "organization_name": 'Évian "Fuels"\r\nX-Evil: 1',
            "reporting_period": '20"\r\n25',
        }
    )

    name = _declaration_filename(payload, "pdf")

    assert name.isascii()
    assert not any(c in name for c in '"\r\n:')
    assert name.endswith(".pdf")
