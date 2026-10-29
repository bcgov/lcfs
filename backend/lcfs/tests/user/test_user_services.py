import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import NotificationTypeEnum
from lcfs.web.api.user.services import UserServices


def _caller_request(is_government: bool):
    """A request whose signed-in user is an IDIR admin or a BCeID Manage Users user."""
    caller = MagicMock()
    caller.is_government = is_government
    caller.role_names = (
        [RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR]
        if is_government
        else [RoleEnum.SUPPLIER, RoleEnum.MANAGE_USERS]
    )
    request = MagicMock()
    request.user = caller
    return request


@pytest.mark.anyio
async def test_remove_user_success():
    # Create fake user and set it as safe to remove.
    fake_user = MagicMock()
    fake_user.keycloak_username = "safeuser"
    fake_user.user_profile_id = 101

    # Fake repo methods
    fake_repo = MagicMock()
    fake_repo.get_user_by_id = AsyncMock(return_value=fake_user)
    fake_repo.is_user_safe_to_remove = AsyncMock(return_value=True)
    fake_repo.delete_user = AsyncMock()

    # Fake role and notification services
    fake_role_service = MagicMock()
    fake_role_service.remove_roles_for_user = AsyncMock()
    fake_notification_service = MagicMock()
    fake_notification_service.remove_subscriptions_for_user = AsyncMock()

    # Patch FastAPICache.clear to avoid real cache calls
    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        service = UserServices()
        service.repo = fake_repo
        service.role_service = fake_role_service
        service.notification_service = fake_notification_service

        result = await service.remove_user(101)

        fake_repo.get_user_by_id.assert_awaited_once_with(101)
        fake_repo.is_user_safe_to_remove.assert_awaited_once_with(
            fake_user.keycloak_username
        )
        fake_role_service.remove_roles_for_user.assert_awaited_once_with(
            fake_user.user_profile_id
        )
        fake_notification_service.remove_subscriptions_for_user.assert_awaited_once_with(
            fake_user.user_profile_id
        )
        fake_repo.delete_user.assert_awaited_once_with(fake_user)
        # Expect result to be None after successful deletion.
        assert result is None


@pytest.mark.anyio
async def test_create_user_idir_government_subscription_created():
    fake_user = MagicMock()
    fake_user.user_profile_id = 10
    fake_user.is_active = True
    fake_user.is_government = True
    fake_user.role_names = [RoleEnum.ANALYST, RoleEnum.GOVERNMENT]

    fake_repo = MagicMock()
    fake_repo.create_user = AsyncMock(return_value=fake_user)
    fake_repo.get_user_by_id = AsyncMock(return_value=fake_user)

    fake_notification_service = MagicMock()
    fake_notification_service.add_subscriptions_for_notification_types = AsyncMock()
    fake_notification_service.add_subscriptions_for_user_role = AsyncMock()

    user_create = MagicMock()
    user_create.organization_id = None

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        service = UserServices()
        service.repo = fake_repo
        service.notification_service = fake_notification_service

        await service.create_user(user_create)

        fake_notification_service.add_subscriptions_for_notification_types.assert_awaited_once_with(
            fake_user.user_profile_id,
            [NotificationTypeEnum.IDIR_ANALYST__GOVERNMENT_NOTIFICATION],
            is_enabled=True,
        )
        fake_notification_service.add_subscriptions_for_user_role.assert_not_awaited()


@pytest.mark.anyio
async def test_create_user_bceid_government_subscription_created():
    fake_user = MagicMock()
    fake_user.user_profile_id = 20
    fake_user.is_active = True
    fake_user.is_government = False
    fake_user.role_names = [RoleEnum.SUPPLIER]

    fake_repo = MagicMock()
    fake_repo.create_user = AsyncMock(return_value=fake_user)
    fake_repo.get_user_by_id = AsyncMock(return_value=fake_user)
    fake_repo.get_organization_available_roles = AsyncMock(return_value=set())

    fake_notification_service = MagicMock()
    fake_notification_service.add_subscriptions_for_notification_types = AsyncMock()
    fake_notification_service.add_subscriptions_for_user_role = AsyncMock()

    user_create = MagicMock()
    user_create.organization_id = 42
    user_create.roles = [RoleEnum.SUPPLIER.value]

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        service = UserServices(request=_caller_request(is_government=False))
        service.repo = fake_repo
        service.notification_service = fake_notification_service

        await service.create_user(user_create)

        fake_notification_service.add_subscriptions_for_notification_types.assert_awaited_once_with(
            fake_user.user_profile_id,
            [NotificationTypeEnum.BCEID__GOVERNMENT_NOTIFICATION],
            is_enabled=True,
        )
        fake_notification_service.add_subscriptions_for_user_role.assert_not_awaited()


@pytest.mark.anyio
async def test_update_user_inactive_to_active_adds_government_subscription():
    fake_user = MagicMock()
    fake_user.user_profile_id = 30
    fake_user.organization = None
    fake_user.is_active = False
    fake_user.is_government = True
    fake_user.role_names = [RoleEnum.ANALYST, RoleEnum.GOVERNMENT]

    updated_user = MagicMock()
    updated_user.user_profile_id = 30
    updated_user.is_active = True
    updated_user.is_government = True
    updated_user.role_names = [RoleEnum.ANALYST, RoleEnum.GOVERNMENT]

    fake_repo = MagicMock()
    fake_repo.get_user_by_id = AsyncMock(return_value=fake_user)
    fake_repo.update_user = AsyncMock(return_value=updated_user)

    fake_notification_service = MagicMock()
    fake_notification_service.add_subscriptions_for_notification_types = AsyncMock()
    fake_notification_service.add_subscriptions_for_user_role = AsyncMock()

    fake_request = MagicMock()
    fake_request.user = MagicMock()
    fake_request.user.is_government = True
    fake_request.user.role_names = [RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR]

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        service = UserServices()
        service.repo = fake_repo
        service.notification_service = fake_notification_service
        service.request = fake_request

        await service.update_user(MagicMock(), 30)

        fake_notification_service.add_subscriptions_for_notification_types.assert_awaited_once_with(
            updated_user.user_profile_id,
            [NotificationTypeEnum.IDIR_ANALYST__GOVERNMENT_NOTIFICATION],
            is_enabled=True,
        )
        fake_notification_service.add_subscriptions_for_user_role.assert_not_awaited()


@pytest.mark.anyio
async def test_update_user_idir_role_added_adds_government_subscription():
    fake_user = MagicMock()
    fake_user.user_profile_id = 40
    fake_user.organization = None
    fake_user.is_active = True
    fake_user.is_government = True
    fake_user.role_names = [RoleEnum.GOVERNMENT]

    updated_user = MagicMock()
    updated_user.user_profile_id = 40
    updated_user.is_active = True
    updated_user.is_government = True
    updated_user.role_names = [RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR]

    fake_repo = MagicMock()
    fake_repo.get_user_by_id = AsyncMock(return_value=fake_user)
    fake_repo.update_user = AsyncMock(return_value=updated_user)

    fake_notification_service = MagicMock()
    fake_notification_service.add_subscriptions_for_notification_types = AsyncMock()
    fake_notification_service.add_subscriptions_for_user_role = AsyncMock()

    fake_request = MagicMock()
    fake_request.user = MagicMock()
    fake_request.user.is_government = True
    fake_request.user.role_names = [RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR]

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        service = UserServices()
        service.repo = fake_repo
        service.notification_service = fake_notification_service
        service.request = fake_request

        await service.update_user(MagicMock(), 40)

        fake_notification_service.add_subscriptions_for_notification_types.assert_awaited_once_with(
            updated_user.user_profile_id,
            [NotificationTypeEnum.IDIR_DIRECTOR__GOVERNMENT_NOTIFICATION],
            is_enabled=True,
        )
        fake_notification_service.add_subscriptions_for_user_role.assert_not_awaited()


@pytest.mark.anyio
async def test_update_user_idir_role_removed_deletes_subscriptions():
    fake_user = MagicMock()
    fake_user.user_profile_id = 50
    fake_user.organization = None
    fake_user.is_active = True
    fake_user.is_government = True
    fake_user.role_names = [RoleEnum.GOVERNMENT, RoleEnum.ANALYST]

    updated_user = MagicMock()
    updated_user.user_profile_id = 50
    updated_user.is_active = True
    updated_user.is_government = True
    updated_user.role_names = [RoleEnum.GOVERNMENT]

    fake_repo = MagicMock()
    fake_repo.get_user_by_id = AsyncMock(return_value=fake_user)
    fake_repo.update_user = AsyncMock(return_value=updated_user)

    fake_notification_service = MagicMock()
    fake_notification_service.add_subscriptions_for_notification_types = AsyncMock()
    fake_notification_service.add_subscriptions_for_user_role = AsyncMock()
    fake_notification_service.delete_subscriptions_for_user_role = AsyncMock()

    fake_request = MagicMock()
    fake_request.user = MagicMock()
    fake_request.user.is_government = True
    fake_request.user.role_names = [RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR]

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        service = UserServices()
        service.repo = fake_repo
        service.notification_service = fake_notification_service
        service.request = fake_request

        await service.update_user(MagicMock(), 50)

        fake_notification_service.delete_subscriptions_for_user_role.assert_awaited_once_with(
            updated_user.user_profile_id, RoleEnum.ANALYST
        )
        fake_notification_service.add_subscriptions_for_notification_types.assert_not_awaited()
        fake_notification_service.add_subscriptions_for_user_role.assert_not_awaited()


@pytest.mark.anyio
async def test_update_user_ci_applicant_role_removed_deletes_subscriptions():
    fake_user = MagicMock()
    fake_user.user_profile_id = 51
    fake_user.organization = MagicMock()
    fake_user.is_active = True
    fake_user.is_government = False
    fake_user.role_names = [RoleEnum.SUPPLIER, RoleEnum.CI_APPLICANT]

    updated_user = MagicMock()
    updated_user.user_profile_id = 51
    updated_user.organization = MagicMock()
    updated_user.is_active = True
    updated_user.is_government = False
    updated_user.role_names = [RoleEnum.SUPPLIER]

    fake_repo = MagicMock()
    fake_repo.get_user_by_id = AsyncMock(return_value=fake_user)
    fake_repo.update_user = AsyncMock(return_value=updated_user)
    fake_repo.get_organization_available_roles = AsyncMock(return_value=set())

    fake_notification_service = MagicMock()
    fake_notification_service.add_subscriptions_for_notification_types = AsyncMock()
    fake_notification_service.add_subscriptions_for_user_role = AsyncMock()
    fake_notification_service.delete_subscriptions_for_user_role = AsyncMock()

    fake_request = MagicMock()
    fake_request.user = MagicMock()
    fake_request.user.is_government = True
    fake_request.user.role_names = [RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR]

    user_create = MagicMock()
    user_create.roles = [RoleEnum.SUPPLIER.value]

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        service = UserServices()
        service.repo = fake_repo
        service.notification_service = fake_notification_service
        service.request = fake_request

        await service.update_user(user_create, 51)

        fake_notification_service.delete_subscriptions_for_user_role.assert_awaited_once_with(
            updated_user.user_profile_id, RoleEnum.CI_APPLICANT
        )
        fake_notification_service.add_subscriptions_for_notification_types.assert_not_awaited()
        fake_notification_service.add_subscriptions_for_user_role.assert_not_awaited()


@pytest.mark.anyio
async def test_remove_user_not_safe():
    fake_user = MagicMock()
    fake_user.keycloak_username = "unsafeuser"
    fake_user.user_profile_id = 202

    fake_repo = MagicMock()
    fake_repo.get_user_by_id = AsyncMock(return_value=fake_user)
    fake_repo.is_user_safe_to_remove = AsyncMock(return_value=False)

    service = UserServices()
    service.repo = fake_repo

    with pytest.raises(HTTPException) as exc_info:
        await service.remove_user(202)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "User is not safe to remove."


# ---------------------------------------------------------------------------
# Organization available-role validation (#4565)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_create_user_rejects_role_not_available_to_org():
    fake_repo = MagicMock()
    fake_repo.get_organization_available_roles = AsyncMock(return_value=set())

    user_create = MagicMock()
    user_create.organization_id = 42
    user_create.roles = [RoleEnum.SUPPLIER.value, RoleEnum.CI_APPLICANT.value]

    service = UserServices(request=_caller_request(is_government=True))
    service.repo = fake_repo

    with pytest.raises(HTTPException) as exc_info:
        await service.create_user(user_create)

    assert exc_info.value.status_code == 400
    assert RoleEnum.CI_APPLICANT.value in exc_info.value.detail


@pytest.mark.anyio
async def test_create_user_rejects_government_role_for_org_user():
    fake_repo = MagicMock()
    fake_repo.get_organization_available_roles = AsyncMock(return_value=set())

    user_create = MagicMock()
    user_create.organization_id = 42
    user_create.roles = [RoleEnum.SUPPLIER.value, RoleEnum.ANALYST.value]

    service = UserServices(request=_caller_request(is_government=True))
    service.repo = fake_repo

    with pytest.raises(HTTPException) as exc_info:
        await service.create_user(user_create)

    assert exc_info.value.status_code == 400
    assert RoleEnum.ANALYST.value in exc_info.value.detail


@pytest.mark.anyio
async def test_create_user_always_available_roles_pass_with_empty_availability():
    fake_user = MagicMock()
    fake_user.user_profile_id = 60
    fake_user.is_active = False

    fake_repo = MagicMock()
    fake_repo.create_user = AsyncMock(return_value=fake_user)
    fake_repo.get_user_by_id = AsyncMock(return_value=fake_user)
    fake_repo.get_organization_available_roles = AsyncMock(return_value=set())

    user_create = MagicMock()
    user_create.organization_id = 42
    user_create.roles = [
        RoleEnum.SUPPLIER.value,
        RoleEnum.MANAGE_USERS.value,
        RoleEnum.SIGNING_AUTHORITY.value,
        RoleEnum.READ_ONLY.value,
    ]

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        service = UserServices(request=_caller_request(is_government=False))
        service.repo = fake_repo
        service.notification_service = MagicMock()

        result = await service.create_user(user_create)

    assert result == "User created successfully"


def _make_create_service(is_government_caller: bool):
    """Helper: wire up a UserServices instance for create_user tests."""
    fake_user = MagicMock()
    fake_user.user_profile_id = 61
    fake_user.is_active = False

    fake_repo = MagicMock()
    fake_repo.create_user = AsyncMock(return_value=fake_user)
    fake_repo.get_user_by_id = AsyncMock(return_value=fake_user)
    fake_repo.get_organization_available_roles = AsyncMock(
        return_value={RoleEnum.IA_PROPONENT}
    )

    service = UserServices(request=_caller_request(is_government_caller))
    service.repo = fake_repo
    service.notification_service = MagicMock()
    return service, fake_repo


def _create_payload_with_ia_signer():
    user_create = MagicMock()
    user_create.organization_id = 42
    user_create.roles = [
        RoleEnum.SUPPLIER.value,
        RoleEnum.IA_PROPONENT.value,
        RoleEnum.IA_SIGNER.value,
    ]
    return user_create


@pytest.mark.anyio
async def test_bceid_caller_cannot_grant_ia_signer_on_create():
    """A BCeID caller creating a user must have IA Signer stripped."""
    service, fake_repo = _make_create_service(is_government_caller=False)

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        await service.create_user(_create_payload_with_ia_signer())

    submitted = fake_repo.create_user.call_args[0][0].roles
    assert RoleEnum.IA_SIGNER.value not in submitted
    assert RoleEnum.IA_PROPONENT.value in submitted


@pytest.mark.anyio
async def test_government_caller_can_grant_ia_signer_on_create():
    """An IDIR caller creating a user keeps IA Signer in the payload."""
    service, fake_repo = _make_create_service(is_government_caller=True)

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        await service.create_user(_create_payload_with_ia_signer())

    submitted = fake_repo.create_user.call_args[0][0].roles
    assert RoleEnum.IA_SIGNER.value in submitted


@pytest.mark.anyio
async def test_update_user_rejects_role_not_available_to_org():
    current_user = _bceid_user_without_ia_signer()
    updated = _updated_user_stub([RoleEnum.SUPPLIER])
    service, fake_repo = _make_update_service(
        current_user, updated, is_government_caller=True
    )
    # Org only offers IA Proponent (set in _make_update_service)
    user_create = MagicMock()
    user_create.roles = [RoleEnum.SUPPLIER.value, RoleEnum.TRANSFER.value]

    with pytest.raises(HTTPException) as exc_info:
        await service.update_user(user_create, 99)

    assert exc_info.value.status_code == 400
    assert RoleEnum.TRANSFER.value in exc_info.value.detail
    fake_repo.update_user.assert_not_awaited()


# ---------------------------------------------------------------------------
# IA Signer role guard in update_user
# ---------------------------------------------------------------------------


def _make_update_service(fake_user, updated_user, is_government_caller: bool):
    """Helper: wire up a UserServices instance for update_user tests."""
    fake_repo = MagicMock()
    fake_repo.get_user_by_id = AsyncMock(return_value=fake_user)
    fake_repo.update_user = AsyncMock(return_value=updated_user)
    fake_repo.get_organization_available_roles = AsyncMock(
        return_value={RoleEnum.IA_PROPONENT}
    )

    fake_notification_service = MagicMock()
    fake_notification_service.add_subscriptions_for_notification_types = AsyncMock()
    fake_notification_service.add_subscriptions_for_user_role = AsyncMock()
    fake_notification_service.delete_subscriptions_for_user_role = AsyncMock()

    service = UserServices(request=_caller_request(is_government_caller))
    service.repo = fake_repo
    service.notification_service = fake_notification_service
    return service, fake_repo


_BCEID_IDENTITY = {
    "keycloak_username": "bceid.user",
    "keycloak_email": "bceid.user@example.com",
}


def _update_payload(roles, **identity):
    """A submitted update that keeps the stored login identity unless overridden."""
    payload = MagicMock()
    payload.roles = roles
    for field, value in {**_BCEID_IDENTITY, **identity}.items():
        setattr(payload, field, value)
    return payload


def _bceid_user_with_ia_signer():
    """A BCeID user who currently has IA Signer."""
    user = MagicMock(**_BCEID_IDENTITY)
    user.organization = MagicMock()
    user.is_active = True
    user.is_government = False
    user.role_names = [RoleEnum.IA_SIGNER, RoleEnum.IA_PROPONENT, RoleEnum.SUPPLIER]
    return user


def _bceid_user_without_ia_signer():
    """A BCeID user who does NOT currently have IA Signer."""
    user = MagicMock(**_BCEID_IDENTITY)
    user.organization = MagicMock()
    user.is_active = True
    user.is_government = False
    user.role_names = [RoleEnum.IA_PROPONENT, RoleEnum.SUPPLIER]
    return user


def _updated_user_stub(role_names):
    u = MagicMock()
    u.user_profile_id = 99
    u.is_active = True
    u.is_government = False
    u.role_names = role_names
    return u


@pytest.mark.anyio
async def test_bceid_caller_cannot_remove_ia_signer():
    """A BCeID caller submitting roles without IA Signer must have it restored."""
    current_user = _bceid_user_with_ia_signer()
    updated = _updated_user_stub(
        [RoleEnum.IA_SIGNER, RoleEnum.IA_PROPONENT, RoleEnum.SUPPLIER]
    )
    service, fake_repo = _make_update_service(
        current_user, updated, is_government_caller=False
    )

    # Caller submits IA Proponent but omits IA Signer
    user_create = _update_payload(
        [RoleEnum.IA_PROPONENT.value, RoleEnum.SUPPLIER.value]
    )

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        await service.update_user(user_create, 99)

    submitted = fake_repo.update_user.call_args[0][1].roles
    assert RoleEnum.IA_SIGNER.value in submitted


@pytest.mark.anyio
async def test_bceid_caller_cannot_grant_ia_signer():
    """A BCeID caller who tries to add IA Signer must have it stripped."""
    current_user = _bceid_user_without_ia_signer()
    updated = _updated_user_stub([RoleEnum.IA_PROPONENT, RoleEnum.SUPPLIER])
    service, fake_repo = _make_update_service(
        current_user, updated, is_government_caller=False
    )

    # Caller attempts to add IA Signer
    user_create = _update_payload(
        [
            RoleEnum.IA_SIGNER.value,
            RoleEnum.IA_PROPONENT.value,
            RoleEnum.SUPPLIER.value,
        ]
    )

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        await service.update_user(user_create, 99)

    submitted = fake_repo.update_user.call_args[0][1].roles
    assert RoleEnum.IA_SIGNER.value not in submitted


@pytest.mark.anyio
async def test_government_caller_can_remove_ia_signer():
    """An IDIR caller who submits without IA Signer must have it removed (no guard)."""
    current_user = _bceid_user_with_ia_signer()
    updated = _updated_user_stub([RoleEnum.IA_PROPONENT, RoleEnum.SUPPLIER])
    service, fake_repo = _make_update_service(
        current_user, updated, is_government_caller=True
    )

    user_create = MagicMock()
    # IDIR caller intentionally removes IA Signer
    user_create.roles = [RoleEnum.IA_PROPONENT.value, RoleEnum.SUPPLIER.value]

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        await service.update_user(user_create, 99)

    submitted = fake_repo.update_user.call_args[0][1].roles
    assert RoleEnum.IA_SIGNER.value not in submitted


@pytest.mark.anyio
async def test_government_caller_can_grant_ia_signer():
    """An IDIR caller who adds IA Signer must have it preserved in the payload."""
    current_user = _bceid_user_without_ia_signer()
    updated = _updated_user_stub(
        [RoleEnum.IA_SIGNER, RoleEnum.IA_PROPONENT, RoleEnum.SUPPLIER]
    )
    service, fake_repo = _make_update_service(
        current_user, updated, is_government_caller=True
    )

    user_create = MagicMock()
    user_create.roles = [
        RoleEnum.IA_SIGNER.value,
        RoleEnum.IA_PROPONENT.value,
        RoleEnum.SUPPLIER.value,
    ]

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        await service.update_user(user_create, 99)

    submitted = fake_repo.update_user.call_args[0][1].roles
    assert RoleEnum.IA_SIGNER.value in submitted


# ---------------------------------------------------------------------------
# Login identity guard in update_user
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize(
    "identity",
    [
        {"keycloak_username": "someone.else"},
        {"keycloak_email": "someone.else@example.com"},
    ],
)
async def test_bceid_caller_cannot_change_login_identity(identity):
    """A Manage Users supplier cannot change the login username or email."""
    current_user = _bceid_user_without_ia_signer()
    updated = _updated_user_stub([RoleEnum.IA_PROPONENT, RoleEnum.SUPPLIER])
    service, fake_repo = _make_update_service(
        current_user, updated, is_government_caller=False
    )
    user_create = _update_payload(
        [RoleEnum.IA_PROPONENT.value, RoleEnum.SUPPLIER.value], **identity
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.update_user(user_create, 99)

    assert exc_info.value.status_code == 403
    fake_repo.update_user.assert_not_awaited()


@pytest.mark.anyio
async def test_bceid_caller_resubmitting_identity_keeps_stored_values():
    """Case or whitespace differences are not a change; stored values are kept."""
    current_user = _bceid_user_without_ia_signer()
    updated = _updated_user_stub([RoleEnum.IA_PROPONENT, RoleEnum.SUPPLIER])
    service, fake_repo = _make_update_service(
        current_user, updated, is_government_caller=False
    )
    user_create = _update_payload(
        [RoleEnum.IA_PROPONENT.value, RoleEnum.SUPPLIER.value],
        keycloak_username=" BCEID.User ",
        keycloak_email="BCeID.User@Example.com",
    )

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        await service.update_user(user_create, 99)

    submitted = fake_repo.update_user.call_args[0][1]
    assert submitted.keycloak_username == _BCEID_IDENTITY["keycloak_username"]
    assert submitted.keycloak_email == _BCEID_IDENTITY["keycloak_email"]


@pytest.mark.anyio
async def test_government_non_administrator_cannot_change_login_identity():
    """Only the Administrator role may change identity fields, not any IDIR user."""
    current_user = _bceid_user_without_ia_signer()
    updated = _updated_user_stub([RoleEnum.IA_PROPONENT, RoleEnum.SUPPLIER])
    service, fake_repo = _make_update_service(
        current_user, updated, is_government_caller=True
    )
    service.request.user.role_names = [RoleEnum.GOVERNMENT, RoleEnum.ANALYST]
    user_create = _update_payload(
        [RoleEnum.IA_PROPONENT.value, RoleEnum.SUPPLIER.value],
        keycloak_username="someone.else",
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.update_user(user_create, 99)

    assert exc_info.value.status_code == 403
    fake_repo.update_user.assert_not_awaited()


@pytest.mark.anyio
async def test_administrator_can_change_login_identity():
    """A government Administrator can still correct a profile's login identity."""
    current_user = _bceid_user_without_ia_signer()
    updated = _updated_user_stub([RoleEnum.IA_PROPONENT, RoleEnum.SUPPLIER])
    service, fake_repo = _make_update_service(
        current_user, updated, is_government_caller=True
    )
    user_create = _update_payload(
        [RoleEnum.IA_PROPONENT.value, RoleEnum.SUPPLIER.value],
        keycloak_username="corrected.user",
        keycloak_email="corrected.user@example.com",
    )

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        await service.update_user(user_create, 99)

    submitted = fake_repo.update_user.call_args[0][1]
    assert submitted.keycloak_username == "corrected.user"
    assert submitted.keycloak_email == "corrected.user@example.com"


@pytest.mark.anyio
async def test_get_user_assigned_work_returns_schema():
    raw = {
        "compliance_reports": [
            {"compliance_report_id": 1, "organization": "Acme Corp", "period": "2024", "status": "Submitted"}
        ],
        "ci_applications": [
            {"ci_application_id": 10, "organization": "Acme Corp", "status": "In Review"}
        ],
    }
    fake_repo = MagicMock()
    fake_repo.get_user_assigned_work = AsyncMock(return_value=raw)

    service = UserServices()
    service.repo = fake_repo

    result = await service.get_user_assigned_work(user_id=5)

    fake_repo.get_user_assigned_work.assert_awaited_once_with(5)
    assert len(result.compliance_reports) == 1
    assert result.compliance_reports[0].organization == "Acme Corp"
    assert result.compliance_reports[0].status == "Submitted"
    assert len(result.ci_applications) == 1
    assert result.ci_applications[0].ci_application_id == 10


@pytest.mark.anyio
async def test_get_user_assigned_work_empty():
    raw = {"compliance_reports": [], "ci_applications": []}
    fake_repo = MagicMock()
    fake_repo.get_user_assigned_work = AsyncMock(return_value=raw)

    service = UserServices()
    service.repo = fake_repo

    result = await service.get_user_assigned_work(user_id=99)

    assert result.compliance_reports == []
    assert result.ci_applications == []
