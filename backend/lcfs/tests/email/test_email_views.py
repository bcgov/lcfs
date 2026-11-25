import pytest
from unittest.mock import AsyncMock, patch

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.email.views import TEST_EMAIL_RATE_LIMIT

ALLOWED_ROLES = [RoleEnum.ADMINISTRATOR, RoleEnum.SYSTEM_ADMIN]
FORBIDDEN_ROLES = [role for role in RoleEnum if role not in ALLOWED_ROLES]

SEND_PATH = "lcfs.web.api.email.views.CHESEmailService.send_notification_email"
PAYLOAD = {
    "notification_type": "BCEID__TRANSFER__PARTNER_ACTIONS",
    "organization_id": 2,
}


@pytest.mark.anyio
@pytest.mark.parametrize("role", ALLOWED_ROLES)
async def test_test_email_notification_allowed_roles(
    client, fastapi_app, set_mock_user, role
):
    set_mock_user(fastapi_app, [role])

    with patch(SEND_PATH, new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True
        url = fastapi_app.url_path_for("test_email_notification")
        response = await client.post(url, json=PAYLOAD)

    assert response.status_code == 200
    assert response.json()["status"] == "success"
    mock_send.assert_awaited_once()
    assert mock_send.await_args.kwargs["organization_id"] == 2


@pytest.mark.anyio
@pytest.mark.parametrize("role", FORBIDDEN_ROLES)
async def test_test_email_notification_forbidden_roles(
    client, fastapi_app, set_mock_user, role
):
    """Every role other than Administrator / System Admin (incl. all supplier
    roles) is rejected and no email is sent."""
    set_mock_user(fastapi_app, [role])

    with patch(SEND_PATH, new_callable=AsyncMock) as mock_send:
        url = fastapi_app.url_path_for("test_email_notification")
        response = await client.post(url, json=PAYLOAD)

    assert response.status_code == 403
    mock_send.assert_not_awaited()


@pytest.mark.anyio
async def test_test_email_notification_supplier_cannot_target_other_org(
    client, fastapi_app, set_mock_user
):
    """A supplier cannot trigger email to another organization's subscribers."""
    set_mock_user(
        fastapi_app,
        [RoleEnum.SUPPLIER, RoleEnum.TRANSFER],
        {"organization_id": 1},
    )

    with patch(SEND_PATH, new_callable=AsyncMock) as mock_send:
        url = fastapi_app.url_path_for("test_email_notification")
        response = await client.post(url, json={**PAYLOAD, "organization_id": 99})

    assert response.status_code == 403
    mock_send.assert_not_awaited()


@pytest.mark.anyio
async def test_test_email_notification_rate_limited(client, fastapi_app, set_mock_user):
    set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])

    with patch(SEND_PATH, new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True
        url = fastapi_app.url_path_for("test_email_notification")

        for _ in range(TEST_EMAIL_RATE_LIMIT.times):
            response = await client.post(url, json=PAYLOAD)
            assert response.status_code == 200

        response = await client.post(url, json=PAYLOAD)

    assert response.status_code == 429
    assert "Retry-After" in response.headers
    assert mock_send.await_count == TEST_EMAIL_RATE_LIMIT.times


@pytest.mark.anyio
async def test_test_email_notification_forbidden_requests_do_not_consume_limit(
    client, fastapi_app, fake_redis_client, set_mock_user
):
    """Rejected callers must not burn rate-limit budget (authorization runs first)."""
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    with patch(SEND_PATH, new_callable=AsyncMock) as mock_send:
        url = fastapi_app.url_path_for("test_email_notification")
        for _ in range(TEST_EMAIL_RATE_LIMIT.times + 1):
            response = await client.post(url, json=PAYLOAD)
            assert response.status_code == 403

    assert await fake_redis_client.keys("lcfs:ratelimit:email:*") == []
    mock_send.assert_not_awaited()


@pytest.mark.anyio
async def test_test_email_notification_send_failure_returns_500(
    client, fastapi_app, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SYSTEM_ADMIN])

    with patch(SEND_PATH, new_callable=AsyncMock) as mock_send:
        mock_send.return_value = False
        url = fastapi_app.url_path_for("test_email_notification")
        response = await client.post(url, json=PAYLOAD)

    assert response.status_code == 500
