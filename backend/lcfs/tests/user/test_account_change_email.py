from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.user.Role import Role, RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.UserRole import UserRole
from lcfs.web.api.email.services import CHESEmailService
from lcfs.web.api.notification.services import NotificationService
from lcfs.web.api.user.repo import UserRepository
from lcfs.web.api.user.schema import UserCreateSchema
from lcfs.web.api.user.services import UserServices
from lcfs.web.exception.exceptions import ServiceException


def user_roles(*roles):
    return [
        UserRole(
            role=Role(
                role_id=index,
                name=role,
                description=f"Access for {role.value}",
                is_government_role=True,
            )
        )
        for index, role in enumerate(roles, start=1)
    ]


def subscription(type_name, enabled=True, channel="EMAIL"):
    return {
        "notification_type_name": type_name,
        "notification_channel_name": channel,
        "is_enabled": enabled,
    }


@pytest.fixture
def account_service():
    user = UserProfile(
        user_profile_id=42,
        keycloak_username="affected_user",
        keycloak_email="account@example.com",
        email="notifications@example.com",
        first_name="Affected",
        last_name="User",
        is_active=True,
        organization=None,
        user_roles=user_roles(RoleEnum.GOVERNMENT, RoleEnum.ANALYST),
    )
    repo = AsyncMock(spec=UserRepository)
    repo.get_user_by_id.return_value = user
    repo.is_user_safe_to_remove.return_value = False
    repo.get_user_assigned_work.return_value = {
        "compliance_reports": [{"organization": "Sensitive organization", "id": 99}],
        "ci_applications": [{"id": 100}, {"id": 101}],
    }

    async def update_user(existing_user, payload):
        # Exercise snapshots around mutation of the same ORM object.
        existing_user.is_active = payload.is_active
        existing_user.email = payload.email
        existing_user.phone = payload.phone
        existing_user.user_roles = user_roles(
            *(role for role in RoleEnum if role.value in payload.roles)
        )
        return existing_user

    async def update_email(user_id, email):
        user.email = email
        return user

    repo.update_user.side_effect = update_user
    repo.update_email.side_effect = update_email
    notifications = AsyncMock(spec=NotificationService)
    notifications.get_notification_channel_subscriptions_by_user_id.return_value = []
    email = AsyncMock(spec=CHESEmailService)
    email.send_account_change_email.return_value = True
    session = AsyncMock(spec=AsyncSession)
    request = SimpleNamespace(
        user=SimpleNamespace(
            first_name="Account",
            last_name="Administrator",
            keycloak_username="admin_user",
            role_names=[RoleEnum.GOVERNMENT],
            is_government=True,
        )
    )
    service = UserServices(
        request=request,
        repo=repo,
        session=session,
        notification_service=notifications,
        email_service=email,
    )
    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        yield service, user


def payload(user, **changes):
    data = {
        "title": "Analyst",
        "first_name": user.first_name,
        "last_name": user.last_name,
        "keycloak_username": user.keycloak_username,
        "keycloak_email": user.keycloak_email,
        "email": user.email,
        "is_active": user.is_active,
        "roles": [role.value for role in user.role_names],
    }
    data.update(changes)
    return UserCreateSchema(**data)


@pytest.mark.anyio
async def test_role_removal_emails_after_commit_even_when_subscriptions_deleted(
    account_service,
):
    service, user = account_service
    service.notification_service.get_notification_channel_subscriptions_by_user_id.side_effect = [
        [
            subscription("IDIR_ANALYST__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW"),
            subscription("IDIR_ANALYST__TRANSFER__DIRECTOR_RECORDED", enabled=False),
        ],
        [],
    ]
    order = []
    service.session.commit.side_effect = lambda: order.append("commit")

    async def send(recipient, context):
        order.append("email")
        assert recipient == "notifications@example.com"
        assert context["roles_removed"] == ["Analyst"]
        assert context["roles_added"] == []
        assert context["notifications_removed"] == [
            "Compliance Report: Submitted For Review (Email)"
        ]
        assert len(context["preferences_removed"]) == 2
        assert context["assigned_work"] == {
            "Compliance reports": 1,
            "CI applications": 2,
        }
        assert context["loses_assigned_work_access"] is True
        assert "Sensitive organization" not in str(context)
        assert "Account Administrator (admin_user)" == context["changed_by"]
        assert context["changed_at"].split()[-1] in {"PST", "PDT"}
        return True

    service.email_service.send_account_change_email.side_effect = send
    result = await service.update_user_and_notify(
        payload(user, roles=[RoleEnum.GOVERNMENT.value]), user.user_profile_id
    )
    assert order == ["commit", "email"]
    assert result.account_change_email_sent is True
    assert result.model_dump(by_alias=True)["accountChangeEmailSent"] is True
    service.notification_service.delete_subscriptions_for_user_role.assert_awaited_once_with(
        42, RoleEnum.ANALYST
    )


@pytest.mark.anyio
@pytest.mark.parametrize("was_active,is_active", [(True, False), (False, True)])
async def test_activation_and_deactivation_send_email(
    account_service, was_active, is_active
):
    service, user = account_service
    user.is_active = was_active
    result = await service.update_user_and_notify(
        payload(user, is_active=is_active), 42
    )
    context = service.email_service.send_account_change_email.call_args.args[1]
    assert context["status_changed"] is True
    assert context["new_status"] == ("Active" if is_active else "Inactive")
    assert result.account_change_email_sent is True


@pytest.mark.anyio
async def test_role_addition_reports_only_subscriptions_actually_enabled(
    account_service,
):
    service, user = account_service
    user.user_roles = user_roles(RoleEnum.GOVERNMENT)
    service.notification_service.get_notification_channel_subscriptions_by_user_id.side_effect = [
        [],
        [subscription("IDIR_ANALYST__GOVERNMENT_NOTIFICATION", channel="IN_APP")],
    ]
    await service.update_user_and_notify(
        payload(user, roles=["Government", "Analyst"]), 42
    )
    context = service.email_service.send_account_change_email.call_args.args[1]
    assert context["roles_added"] == ["Analyst"]
    assert context["notifications_added"] == ["Government Notification (In-app)"]
    service.notification_service.add_subscriptions_for_user_role.assert_not_awaited()


@pytest.mark.anyio
async def test_role_change_uses_current_notification_email(account_service):
    service, user = account_service
    result = await service.update_user_and_notify(
        payload(user, email="new@example.com", roles=["Government"]), 42
    )
    recipient, context = service.email_service.send_account_change_email.call_args.args
    assert recipient == "new@example.com"
    assert context["roles_removed"] == ["Analyst"]
    assert result.account_change_email_sent is True


@pytest.mark.anyio
async def test_missing_notification_email_uses_account_email(account_service):
    service, user = account_service
    user.email = None
    # UserCreateSchema allows None and the account email is still available.
    await service.update_user_and_notify(payload(user, is_active=False), 42)
    assert (
        service.email_service.send_account_change_email.call_args.args[0]
        == "account@example.com"
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "changes", [{"phone": "555-0100"}, {"email": "new@example.com"}]
)
async def test_unrelated_account_changes_do_not_send_email(account_service, changes):
    service, user = account_service
    result = await service.update_user_and_notify(payload(user, **changes), 42)
    assert result.account_change_email_sent is None
    service.email_service.send_account_change_email.assert_not_awaited()
    service.session.commit.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("raises", [False, True])
async def test_email_failure_returns_saved_change_and_failure_status(
    account_service, raises
):
    service, user = account_service
    service.email_service.send_account_change_email.return_value = False
    if raises:
        service.email_service.send_account_change_email.side_effect = RuntimeError(
            "CHES unavailable"
        )
    result = await service.update_user_and_notify(payload(user, is_active=False), 42)
    assert result.is_active is False
    assert result.account_change_email_sent is False
    service.session.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_commit_failure_does_not_send_email(account_service):
    service, user = account_service
    service.session.commit.side_effect = RuntimeError("Database unavailable")
    with pytest.raises(ServiceException):
        await service.update_user_and_notify(payload(user, is_active=False), 42)
    service.email_service.send_account_change_email.assert_not_awaited()


@pytest.mark.anyio
async def test_rejected_update_does_not_commit_or_send_email(account_service):
    service, user = account_service
    service.repo.update_user.side_effect = HTTPException(400, "Invalid update")
    with pytest.raises(HTTPException):
        await service.update_user_and_notify(payload(user, is_active=False), 42)
    service.session.commit.assert_not_awaited()
    service.email_service.send_account_change_email.assert_not_awaited()


@pytest.mark.anyio
async def test_unauthorized_manager_cannot_update_user_or_send_email(account_service):
    from lcfs.db.models.organization.Organization import Organization

    service, user = account_service
    user.organization = Organization(organization_id=5, name="Another organization")
    service.request.user.role_names = [RoleEnum.SUPPLIER, RoleEnum.MANAGE_USERS]
    service.request.user.organization = SimpleNamespace(organization_id=9)
    service.request.user.is_government = False

    with pytest.raises(HTTPException) as error:
        await service.update_user_and_notify(payload(user, is_active=False), 42)

    assert error.value.status_code == 403
    service.repo.update_user.assert_not_awaited()
    service.session.commit.assert_not_awaited()
    service.email_service.send_account_change_email.assert_not_awaited()


@pytest.mark.anyio
async def test_response_and_email_do_not_read_expired_orm_data(account_service):
    service, user = account_service

    def expire_user():
        user.email = None
        user.first_name = None
        user.user_roles = []

    service.session.commit.side_effect = expire_user
    result = await service.update_user_and_notify(payload(user, is_active=False), 42)
    assert result.first_name == "Affected"
    assert result.email == "notifications@example.com"
    context = service.email_service.send_account_change_email.call_args.args[1]
    assert context["user_name"] == "Affected User"


@pytest.mark.anyio
async def test_subscription_reset_triggers_email_without_role_change(account_service):
    service, user = account_service
    service.notification_service.get_notification_channel_subscriptions_by_user_id.side_effect = [
        [subscription("IDIR_ANALYST__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW")],
        [],
    ]
    result = await service.update_user_and_notify(payload(user), 42)
    assert result.account_change_email_sent is True
    context = service.email_service.send_account_change_email.call_args.args[1]
    assert context["roles_removed"] == []
    assert context["preferences_changed"] is True
    assert context["preferences_removed"]


@pytest.mark.anyio
async def test_restored_disabled_preference_is_explained_in_email(account_service):
    service, user = account_service
    service.notification_service.get_notification_channel_subscriptions_by_user_id.side_effect = [
        [],
        [
            subscription(
                "IDIR_ANALYST__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW", enabled=False
            )
        ],
    ]
    result = await service.update_user_and_notify(payload(user), 42)
    assert result.account_change_email_sent is True
    context = service.email_service.send_account_change_email.call_args.args[1]
    assert context["preferences_added"] == [
        "Compliance Report: Submitted For Review (Email): disabled"
    ]
    assert context["notifications_added"] == []


@pytest.mark.anyio
@pytest.mark.parametrize(
    "is_government,changed_by",
    [
        (True, "Government of British Columbia"),
        (False, "Account Administrator (admin_user)"),
    ],
)
async def test_organization_user_change_notifies_the_affected_user(
    account_service, is_government, changed_by
):
    from lcfs.db.models.organization.Organization import Organization

    service, user = account_service
    user.organization = Organization(organization_id=5, name="Example organization")
    user.organization_id = 5
    user.user_roles = user_roles(RoleEnum.SUPPLIER, RoleEnum.CI_APPLICANT)
    for assignment in user.user_roles:
        assignment.role.is_government_role = False
    service.request.user.is_government = is_government
    service.request.user.role_names = (
        [RoleEnum.GOVERNMENT]
        if is_government
        else [RoleEnum.SUPPLIER, RoleEnum.MANAGE_USERS]
    )
    service.request.user.organization = user.organization
    service.repo.get_organization_available_roles.return_value = {RoleEnum.CI_APPLICANT}
    await service.update_user_and_notify(payload(user, roles=["Supplier"]), 42)
    context = service.email_service.send_account_change_email.call_args.args[1]
    assert context["roles_removed"] == ["CI Applicant"]
    assert context["changed_by"] == changed_by
    service.email_service.send_account_change_email.assert_awaited_once()
    service.repo.get_user_assigned_work.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("path", ["/users/42", "/organization/1/users/42"])
async def test_update_endpoints_expose_email_failure_status(account_service, path):
    from fastapi import FastAPI, Request
    from httpx import ASGITransport, AsyncClient

    from lcfs.web.api.organization.views import router as organization_router
    from lcfs.web.api.user.schema import UserUpdateResponseSchema
    from lcfs.web.api.user.views import router as user_router

    service, user = account_service
    existing = await service.get_user_by_id(42)
    saved = UserUpdateResponseSchema(
        **existing.model_dump(), account_change_email_sent=False
    )
    stub = SimpleNamespace(
        update_user_and_notify=AsyncMock(return_value=saved),
    )
    app = FastAPI()
    app.include_router(user_router, prefix="/users")
    app.include_router(organization_router, prefix="/organization")
    app.dependency_overrides[UserServices] = lambda: stub

    @app.middleware("http")
    async def authenticate(request: Request, call_next):
        request.scope["user"] = UserProfile(
            user_profile_id=42,
            user_roles=user_roles(
                RoleEnum.GOVERNMENT,
                RoleEnum.ADMINISTRATOR,
                RoleEnum.MANAGE_USERS,
            ),
        )
        return await call_next(request)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.put(path, json=payload(user).model_dump(mode="json"))
        stub.update_user_and_notify.assert_awaited_once()
    assert response.status_code == 200
    assert response.json()["accountChangeEmailSent"] is False


@pytest.mark.anyio
async def test_email_update_endpoint_keeps_existing_response():
    from fastapi import FastAPI, Request
    from httpx import ASGITransport, AsyncClient

    from lcfs.web.api.user.views import router

    stub = SimpleNamespace(
        update_email=AsyncMock(return_value=SimpleNamespace(email="new@example.com")),
        email_service=AsyncMock(spec=CHESEmailService),
    )
    app = FastAPI()
    app.include_router(router, prefix="/users")
    app.dependency_overrides[UserServices] = lambda: stub

    @app.middleware("http")
    async def authenticate(request: Request, call_next):
        request.scope["user"] = UserProfile(user_profile_id=42)
        return await call_next(request)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/users/update-email", json={"email": "new@example.com"}
        )

    assert response.status_code == 200
    assert response.json() == {"email": "new@example.com"}
    stub.update_email.assert_awaited_once_with(42, "new@example.com")
    stub.email_service.send_account_change_email.assert_not_awaited()


@pytest.mark.anyio
async def test_notification_completes_inside_existing_request_transaction(
    account_service,
):
    service, user = account_service
    async with AsyncSession() as session:
        service.session = session

        async def send(recipient, context):
            assert not session.in_transaction()
            return True

        service.email_service.send_account_change_email.side_effect = send
        async with session.begin():
            result = await service.update_user_and_notify(
                payload(user, is_active=False), 42
            )
        assert result.account_change_email_sent is True
