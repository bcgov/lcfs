import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import NotificationTypeEnum
from lcfs.web.api.user.services import UserServices


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

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        service = UserServices()
        service.repo = fake_repo
        service.notification_service = fake_notification_service

        await service.create_user(MagicMock())

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

    fake_notification_service = MagicMock()
    fake_notification_service.add_subscriptions_for_notification_types = AsyncMock()
    fake_notification_service.add_subscriptions_for_user_role = AsyncMock()

    with patch("lcfs.web.api.user.services.FastAPICache.clear", AsyncMock()):
        service = UserServices()
        service.repo = fake_repo
        service.notification_service = fake_notification_service

        await service.create_user(MagicMock())

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
# IA Signer role guard in update_user
# ---------------------------------------------------------------------------


def _make_update_service(fake_user, updated_user, is_government_caller: bool):
    """Helper: wire up a UserServices instance for update_user tests."""
    fake_repo = MagicMock()
    fake_repo.get_user_by_id = AsyncMock(return_value=fake_user)
    fake_repo.update_user = AsyncMock(return_value=updated_user)

    fake_notification_service = MagicMock()
    fake_notification_service.add_subscriptions_for_notification_types = AsyncMock()
    fake_notification_service.add_subscriptions_for_user_role = AsyncMock()
    fake_notification_service.delete_subscriptions_for_user_role = AsyncMock()

    caller = MagicMock()
    caller.is_government = is_government_caller

    fake_request = MagicMock()
    fake_request.user = caller

    service = UserServices()
    service.repo = fake_repo
    service.notification_service = fake_notification_service
    service.request = fake_request
    return service, fake_repo


def _bceid_user_with_ia_signer():
    """A BCeID user who currently has IA Signer."""
    user = MagicMock()
    user.organization = MagicMock()
    user.is_active = True
    user.is_government = False
    user.role_names = [RoleEnum.IA_SIGNER, RoleEnum.IA_PROPONENT, RoleEnum.SUPPLIER]
    return user


def _bceid_user_without_ia_signer():
    """A BCeID user who does NOT currently have IA Signer."""
    user = MagicMock()
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

    user_create = MagicMock()
    # Caller submits IA Proponent but omits IA Signer
    user_create.roles = [RoleEnum.IA_PROPONENT.value, RoleEnum.SUPPLIER.value]

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

    user_create = MagicMock()
    # Caller attempts to add IA Signer
    user_create.roles = [
        RoleEnum.IA_SIGNER.value,
        RoleEnum.IA_PROPONENT.value,
        RoleEnum.SUPPLIER.value,
    ]

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
