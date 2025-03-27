import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from lcfs.web.api.user.services import UserServices
from lcfs.web.exception.exceptions import DataNotFoundException


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
async def test_remove_user_not_safe():
    # Create fake user that is not safe to remove.
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
