"""The local Keycloak seeder must preserve in-app edits across restarts."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.seeders.dev.local_keycloak_user_seeder import (
    LOCAL_ROLE_USERS,
    seed_local_keycloak_users,
)


@pytest.mark.anyio
async def test_local_seeder_leaves_existing_profiles_and_roles_untouched():
    profiles = [
        UserProfile(
            user_profile_id=index,
            keycloak_username=username,
            keycloak_email=f"edited-{username}@example.com",
            email=f"notifications-{username}@example.com",
            organization_id=None,
            is_active=False,
        )
        for index, (username, _, _) in enumerate(LOCAL_ROLE_USERS, start=1)
    ]
    role_result = MagicMock()
    role_result.all.return_value = [
        (role.value, index) for index, role in enumerate(RoleEnum, start=1)
    ]
    profile_results = []
    for profile in profiles:
        result = MagicMock()
        result.scalar_one_or_none.return_value = profile
        profile_results.append(result)

    session = MagicMock()
    session.execute = AsyncMock(side_effect=[role_result, *profile_results])
    session.flush = AsyncMock()

    await seed_local_keycloak_users(session)

    session.add.assert_not_called()
    session.flush.assert_not_awaited()
    assert session.execute.await_count == len(LOCAL_ROLE_USERS) + 1
    for index, profile in enumerate(profiles):
        username, _, _ = LOCAL_ROLE_USERS[index]
        assert profile.keycloak_username == username
        assert profile.keycloak_email == f"edited-{username}@example.com"
        assert profile.email == f"notifications-{username}@example.com"
        assert profile.organization_id is None
        assert profile.is_active is False
