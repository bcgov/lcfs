from unittest.mock import Mock, AsyncMock, MagicMock
import pytest
from sqlalchemy import text
from lcfs.db.models import UserProfile, UserLoginHistory
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.user.repo import UserRepository
from lcfs.web.api.user.schema import UserCreateSchema
from lcfs.tests.user.user_payloads import user_orm_model


@pytest.fixture
def user_repo(dbsession):
    return UserRepository(db=dbsession)


# Tests for get_full_name
@pytest.mark.anyio
async def test_get_full_name_success(dbsession, user_repo):
    dbsession.add(user_orm_model)
    await dbsession.commit()
    full_name = await user_repo.get_full_name(user_orm_model.keycloak_username)
    expected_full_name = f"{user_orm_model.first_name} {user_orm_model.last_name}"
    assert (
        full_name == expected_full_name
    ), "The fetched full name did not match the expected value."


@pytest.mark.anyio
async def test_create_login_history(dbsession, user_repo):
    """Test creating a user login history entry."""
    # Mock user profile
    user = UserProfile(
        email="testuser@example.com",
        keycloak_username="testuser",
        keycloak_user_id="12345",
    )
    dbsession.add = Mock()

    # Act
    await user_repo.create_login_history(user)

    # Assert

    added_object = dbsession.add.call_args[0][0]
    assert isinstance(added_object, UserLoginHistory)
    assert added_object.keycloak_email == user.email
    assert added_object.external_username == user.keycloak_username
    assert added_object.keycloak_user_id == user.keycloak_user_id
    assert added_object.is_login_successful is True


@pytest.mark.anyio
async def test_update_email_success(dbsession, user_repo):
    # Arrange: Create a user in the database
    user = UserProfile(
        keycloak_user_id="user_id_1",
        keycloak_email="user1@domain.com",
        keycloak_username="username1",
        email="user1@domain.com",
        title="Developer",
        phone="1234567890",
        mobile_phone="0987654321",
        first_name="John",
        last_name="Doe",
        is_active=True,
        organization_id=1,
    )
    dbsession.add(user)
    await dbsession.commit()
    await dbsession.refresh(user)

    # Act: Update the email
    updated_user = await user_repo.update_email(
        user_profile_id=1, email="new_email@domain.com"
    )

    # Assert: Check if the email was updated
    assert updated_user.email == "new_email@domain.com"


@pytest.mark.anyio
async def test_is_user_safe_to_remove(dbsession):
    # Simulate dbsession.execute returning a result whose scalar() returns True
    expected_safe = True
    mock_result = MagicMock()
    mock_result.scalar.return_value = expected_safe
    dbsession.execute = AsyncMock(return_value=mock_result)

    repo = UserRepository(db=dbsession)
    keycloak_username = "testuser"
    result = await repo.is_user_safe_to_remove(keycloak_username)

    assert result is True

    # Compare string representations of the SQL text clauses
    expected_clause = str(text("SELECT is_user_safe_to_remove(:username) AS safe"))
    actual_clause = str(dbsession.execute.await_args[0][0])
    assert (
        expected_clause == actual_clause
    ), f"Expected clause: {expected_clause}, got: {actual_clause}"
    assert dbsession.execute.await_args[0][1] == {"username": keycloak_username}


@pytest.mark.anyio
async def test_delete_user(dbsession):
    repo = UserRepository(db=dbsession)
    fake_user = MagicMock(spec=UserProfile)

    dbsession.delete = AsyncMock()
    dbsession.flush = AsyncMock()

    result = await repo.delete_user(fake_user)

    dbsession.delete.assert_awaited_once_with(fake_user)
    dbsession.flush.assert_awaited_once()
    assert result is None


# ---------------------------------------------------------------------------
# Helpers shared by role-update tests
# ---------------------------------------------------------------------------


def _role(name: RoleEnum):
    r = MagicMock()
    r.name = name
    return r


def _user_role(role_name: RoleEnum):
    ur = MagicMock()
    ur.role = _role(role_name)
    return ur


def _make_repo_with_find(role_to_return):
    """Return a UserRepository whose find_user_role always returns a stub."""
    repo = UserRepository(db=MagicMock())
    repo.find_user_role = AsyncMock(
        side_effect=lambda name: _user_role(name)
    )
    return repo


# ---------------------------------------------------------------------------
# update_idir_roles
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_idir_director_replaces_analyst():
    repo = _make_repo_with_find(None)
    user = MagicMock()
    user.user_roles = [_user_role(RoleEnum.ANALYST)]
    existing = {RoleEnum.ANALYST}

    await repo.update_idir_roles(user, [RoleEnum.DIRECTOR], existing)

    names = {ur.role.name for ur in user.user_roles}
    assert RoleEnum.DIRECTOR in names
    assert RoleEnum.ANALYST not in names


@pytest.mark.anyio
async def test_idir_director_blocks_ia_roles():
    repo = _make_repo_with_find(None)
    user = MagicMock()
    user.user_roles = [
        _user_role(RoleEnum.IA_ANALYST),
        _user_role(RoleEnum.ANALYST),
    ]
    existing = {RoleEnum.ANALYST, RoleEnum.IA_ANALYST}

    await repo.update_idir_roles(
        user, [RoleEnum.DIRECTOR], existing
    )

    names = {ur.role.name for ur in user.user_roles}
    assert RoleEnum.DIRECTOR in names
    assert RoleEnum.IA_ANALYST not in names


@pytest.mark.anyio
async def test_idir_ia_analyst_and_ia_manager_mutually_exclusive():
    repo = _make_repo_with_find(None)
    user = MagicMock()
    user.user_roles = [_user_role(RoleEnum.IA_ANALYST)]
    existing = {RoleEnum.IA_ANALYST}

    await repo.update_idir_roles(
        user, [RoleEnum.ANALYST, RoleEnum.IA_MANAGER], existing
    )

    names = {ur.role.name for ur in user.user_roles}
    assert RoleEnum.IA_MANAGER in names
    assert RoleEnum.IA_ANALYST not in names


@pytest.mark.anyio
async def test_idir_system_admin_added_independently():
    repo = _make_repo_with_find(None)
    user = MagicMock()
    user.user_roles = [_user_role(RoleEnum.ADMINISTRATOR)]
    existing = {RoleEnum.ADMINISTRATOR}

    await repo.update_idir_roles(
        user, [RoleEnum.ADMINISTRATOR, RoleEnum.SYSTEM_ADMIN], existing
    )

    names = {ur.role.name for ur in user.user_roles}
    assert RoleEnum.ADMINISTRATOR in names
    assert RoleEnum.SYSTEM_ADMIN in names


@pytest.mark.anyio
async def test_idir_system_admin_removed_when_not_in_new_roles():
    repo = _make_repo_with_find(None)
    user = MagicMock()
    user.user_roles = [
        _user_role(RoleEnum.ADMINISTRATOR),
        _user_role(RoleEnum.SYSTEM_ADMIN),
    ]
    existing = {RoleEnum.ADMINISTRATOR, RoleEnum.SYSTEM_ADMIN}

    await repo.update_idir_roles(
        user, [RoleEnum.ADMINISTRATOR], existing
    )

    names = {ur.role.name for ur in user.user_roles}
    assert RoleEnum.SYSTEM_ADMIN not in names
    assert RoleEnum.ADMINISTRATOR in names


# ---------------------------------------------------------------------------
# update_bceid_roles
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_bceid_ia_signer_added_with_proponent():
    repo = _make_repo_with_find(None)
    user = MagicMock()
    user.user_roles = [_user_role(RoleEnum.SUPPLIER)]
    existing = {RoleEnum.SUPPLIER}

    await repo.update_bceid_roles(
        user,
        [RoleEnum.IA_PROPONENT, RoleEnum.IA_SIGNER, RoleEnum.SUPPLIER],
        existing,
    )

    names = {ur.role.name for ur in user.user_roles}
    assert RoleEnum.IA_PROPONENT in names
    assert RoleEnum.IA_SIGNER in names


@pytest.mark.anyio
async def test_bceid_ia_signer_preserved_when_proponent_removed_by_services_layer():
    """
    When services.py adds IA Signer back for a BCeID caller (who had it already),
    the repo should honour the restored payload even though IA Proponent is absent.
    """
    repo = _make_repo_with_find(None)
    user = MagicMock()
    # User currently has both roles in the DB
    user.user_roles = [
        _user_role(RoleEnum.IA_PROPONENT),
        _user_role(RoleEnum.IA_SIGNER),
        _user_role(RoleEnum.SUPPLIER),
    ]
    existing = {RoleEnum.IA_PROPONENT, RoleEnum.IA_SIGNER, RoleEnum.SUPPLIER}

    # Services layer restored IA_SIGNER; IA_PROPONENT was intentionally removed
    await repo.update_bceid_roles(
        user,
        [RoleEnum.IA_SIGNER, RoleEnum.SUPPLIER],
        existing,
    )

    names = {ur.role.name for ur in user.user_roles}
    assert RoleEnum.IA_SIGNER in names
    assert RoleEnum.IA_PROPONENT not in names


@pytest.mark.anyio
async def test_bceid_read_only_strips_other_roles():
    repo = _make_repo_with_find(None)
    user = MagicMock()
    user.user_roles = [
        _user_role(RoleEnum.SUPPLIER),
        _user_role(RoleEnum.MANAGE_USERS),
    ]
    existing = {RoleEnum.SUPPLIER, RoleEnum.MANAGE_USERS}

    await repo.update_bceid_roles(
        user, [RoleEnum.READ_ONLY, RoleEnum.SUPPLIER], existing
    )

    names = {ur.role.name for ur in user.user_roles}
    assert RoleEnum.READ_ONLY in names
    assert RoleEnum.MANAGE_USERS not in names


@pytest.mark.anyio
async def test_bceid_role_removed_when_not_in_new_roles():
    repo = _make_repo_with_find(None)
    user = MagicMock()
    user.user_roles = [
        _user_role(RoleEnum.SUPPLIER),
        _user_role(RoleEnum.TRANSFER),
        _user_role(RoleEnum.COMPLIANCE_REPORTING),
    ]
    existing = {RoleEnum.SUPPLIER, RoleEnum.TRANSFER, RoleEnum.COMPLIANCE_REPORTING}

    # Remove TRANSFER
    await repo.update_bceid_roles(
        user, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING], existing
    )

    names = {ur.role.name for ur in user.user_roles}
    assert RoleEnum.TRANSFER not in names
    assert RoleEnum.COMPLIANCE_REPORTING in names


# ---------------------------------------------------------------------------
# update_user organization guard
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_user_allows_organization_update_for_test_user():
    repo = UserRepository(db=MagicMock())
    user = MagicMock(spec=UserProfile)
    user.keycloak_username = "lcfs12"
    user.organization_id = 4
    user.organization = None
    user.role_names = []
    user.user_roles = []

    user_update = UserCreateSchema(
        title="Developer",
        keycloak_username="lcfs12",
        keycloak_email="lcfs12@example.com",
        email="lcfs12@example.com",
        first_name="Test",
        last_name="User",
        is_active=True,
        organization_id=9,
        roles=[],
    )

    await repo.update_user(user, user_update)

    assert user.organization_id == 9


@pytest.mark.anyio
async def test_update_user_blocks_organization_update_for_non_test_user():
    repo = UserRepository(db=MagicMock())
    user = MagicMock(spec=UserProfile)
    user.keycloak_username = "real.user"
    user.organization_id = 4
    user.organization = None
    user.role_names = []
    user.user_roles = []

    user_update = UserCreateSchema(
        title="Developer",
        keycloak_username="real.user",
        keycloak_email="real.user@example.com",
        email="real.user@example.com",
        first_name="Real",
        last_name="User",
        is_active=True,
        organization_id=9,
        roles=[],
    )

    await repo.update_user(user, user_update)

    assert user.organization_id == 4
