"""The local Keycloak seeder must preserve in-app edits across restarts."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.UserRole import UserRole
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
        (role, index) for index, role in enumerate(RoleEnum, start=1)
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


@pytest.mark.anyio
async def test_local_seeder_creates_profiles_and_role_assignments():
    role_ids = {role: index for index, role in enumerate(RoleEnum, start=1)}
    role_result = MagicMock()
    role_result.all.return_value = list(role_ids.items())
    profile_results = []
    for _ in LOCAL_ROLE_USERS:
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        profile_results.append(result)

    added_entities = []
    session = MagicMock()
    session.execute = AsyncMock(side_effect=[role_result, *profile_results])
    session.add.side_effect = added_entities.append

    async def flush_new_profile():
        profiles = [
            entity for entity in added_entities if isinstance(entity, UserProfile)
        ]
        profiles[-1].user_profile_id = len(profiles)

    session.flush = AsyncMock(side_effect=flush_new_profile)

    await seed_local_keycloak_users(session)

    profiles = {
        profile.keycloak_username: profile
        for profile in added_entities
        if isinstance(profile, UserProfile)
    }
    user_roles = [entity for entity in added_entities if isinstance(entity, UserRole)]
    role_by_id = {role_id: role for role, role_id in role_ids.items()}

    assert set(profiles) == {username for username, _, _ in LOCAL_ROLE_USERS}
    assert len(profiles) == len(LOCAL_ROLE_USERS)
    assert session.flush.await_count == len(LOCAL_ROLE_USERS)

    for username, identity_provider, assigned_role in LOCAL_ROLE_USERS:
        profile = profiles[username]
        expected_organization_id = 1 if identity_provider == "bceidbusiness" else None
        expected_base_role = (
            RoleEnum.GOVERNMENT if identity_provider == "idir" else RoleEnum.SUPPLIER
        )
        expected_roles = {expected_base_role, assigned_role}
        if assigned_role == RoleEnum.IA_SIGNER:
            expected_roles.add(RoleEnum.IA_PROPONENT)

        actual_roles = {
            role_by_id[user_role.role_id]
            for user_role in user_roles
            if user_role.user_profile_id == profile.user_profile_id
        }

        assert profile.organization_id == expected_organization_id
        assert profile.keycloak_email == f"{username}@example.com"
        assert actual_roles == expected_roles
