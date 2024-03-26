import pytest
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
    assert full_name == expected_full_name, (
        "The fetched full name did not match the expected value."
    )
