from unittest.mock import Mock
import pytest
from lcfs.db.models import UserProfile, UserLoginHistory
from lcfs.web.api.user.repo import UserRepository
from lcfs.tests.user.user_payloads import user_orm_model
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy import text


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
