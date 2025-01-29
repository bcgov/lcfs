from unittest.mock import Mock

import pytest

from lcfs.db.models import UserProfile, UserLoginHistory
from lcfs.web.api.user.repo import UserRepository
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
