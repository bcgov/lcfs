from unittest.mock import patch, AsyncMock

from lcfs.db.models import UserProfile
from lcfs.db.models.user import UserLoginHistory
import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from datetime import datetime

from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.transfer.TransferHistory import TransferHistory
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.initiative_agreement.InitiativeAgreementHistory import (
    InitiativeAgreementHistory,
)
from lcfs.db.models.admin_adjustment.AdminAdjustment import AdminAdjustment
from lcfs.db.models.admin_adjustment.AdminAdjustmentHistory import (
    AdminAdjustmentHistory,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.user.schema import (
    UserActivitiesResponseSchema,
    UserLoginHistoryResponseSchema,
)
from lcfs.web.exception.exceptions import DataNotFoundException


@pytest.mark.anyio
async def test_get_user_activities_as_administrator(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    # Mock the current user as an ADMINISTRATOR
    set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])

    # Assuming user with user_profile_id=7 exists in the database
    target_user_id = 7  # LCFS 1

    # Create activity history records for the target user
    transfer = Transfer(
        transfer_id=1,
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
        transaction_effective_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
        price_per_unit=1.0,
        quantity=10,
        transfer_category_id=1,
        current_status_id=1,
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True,
    )
    transfer_history = TransferHistory(
        transfer_history_id=1,
        transfer_id=transfer.transfer_id,
        transfer_status_id=3,  # Sent
        user_profile_id=target_user_id,
    )

    initiative = InitiativeAgreement(
        initiative_agreement_id=1,
        compliance_units=100,
        transaction_effective_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
        gov_comment="Test Initiative",
        to_organization_id=1,
        current_status_id=1,
    )
    initiative_history = InitiativeAgreementHistory(
        initiative_agreement_history_id=1,
        initiative_agreement_id=initiative.initiative_agreement_id,
        initiative_agreement_status_id=2,  # Approved
        user_profile_id=target_user_id,
    )

    admin_adjustment = AdminAdjustment(
        admin_adjustment_id=11,
        compliance_units=50,
        transaction_effective_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
        gov_comment="Test Adjustment",
        to_organization_id=1,
        current_status_id=1,
    )
    admin_adjustment_history = AdminAdjustmentHistory(
        admin_adjustment_history_id=1,
        admin_adjustment_id=admin_adjustment.admin_adjustment_id,
        admin_adjustment_status_id=2,  # Approved
        user_profile_id=target_user_id,
    )

    await add_models(
        [
            transfer,
            transfer_history,
            initiative,
            initiative_history,
            admin_adjustment,
            admin_adjustment_history,
        ]
    )

    # Prepare request data
    pagination = {
        "page": 1,
        "size": 10,
        "filters": [],
        "sortOrders": [],
    }

    # Send request to get user activities
    url = fastapi_app.url_path_for("get_user_activities", user_id=target_user_id)
    response = await client.post(url, json=pagination)

    assert response.status_code == status.HTTP_200_OK
    content = UserActivitiesResponseSchema(**response.json())
    assert len(content.activities) == 3  # Should have 3 activity records


@pytest.mark.anyio
async def test_get_user_activities_as_manage_users_same_org(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    # Mock the current user as a user with MANAGE_USERS
    set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR, RoleEnum.MANAGE_USERS])

    # Assuming target user with user_profile_id=3 exists and is in organization_id=1
    target_user_id = 1

    # Create activity history records for the target user
    transfer = Transfer(
        transfer_id=1,
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
        transaction_effective_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
        price_per_unit=1.0,
        quantity=10,
        transfer_category_id=1,
        current_status_id=1,
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True,
    )
    transfer_history = TransferHistory(
        transfer_history_id=1,
        transfer_id=transfer.transfer_id,
        transfer_status_id=3,  # Sent
        user_profile_id=target_user_id,
    )

    await add_models(
        [
            transfer,
            transfer_history,
        ]
    )

    # Prepare request data
    pagination = {
        "page": 1,
        "size": 10,
        "filters": [],
        "sortOrders": [],
    }

    # Send request to get user activities
    url = fastapi_app.url_path_for("get_user_activities", user_id=target_user_id)
    response = await client.post(url, json=pagination)

    assert response.status_code == status.HTTP_200_OK
    content = UserActivitiesResponseSchema(**response.json())
    assert len(content.activities) == 1  # Should have 1 activity record


@pytest.mark.anyio
async def test_get_user_activities_permission_denied(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    # Mock the current user as a user with MANAGE_USERS role in organization_id=1
    set_mock_user(fastapi_app, [RoleEnum.MANAGE_USERS])

    # Assuming target user with user_profile_id=7 exists and is in organization_id=3
    target_user_id = 7

    # Prepare request data
    pagination = {
        "page": 1,
        "size": 10,
        "filters": [],
        "sortOrders": [],
    }

    # Send request to get user activities
    url = fastapi_app.url_path_for("get_user_activities", user_id=target_user_id)
    response = await client.post(url, json=pagination)

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_get_all_user_activities_as_administrator(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    # Mock the current user as an ADMINISTRATOR
    set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])

    # Create activity history records for multiple users
    transfer = Transfer(
        transfer_id=1,
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
        transaction_effective_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
        price_per_unit=1.0,
        quantity=10,
        transfer_category_id=1,
        current_status_id=1,
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True,
    )
    transfer_history = TransferHistory(
        transfer_history_id=1,
        transfer_id=transfer.transfer_id,
        transfer_status_id=3,  # Sent
        user_profile_id=7,  # LCFS 1
    )

    initiative = InitiativeAgreement(
        initiative_agreement_id=1,
        compliance_units=100,
        transaction_effective_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
        gov_comment="Test Initiative",
        to_organization_id=1,
        current_status_id=1,
    )
    initiative_history = InitiativeAgreementHistory(
        initiative_agreement_history_id=1,
        initiative_agreement_id=initiative.initiative_agreement_id,
        initiative_agreement_status_id=2,  # Approved
        user_profile_id=7,  # LCFS 1
    )

    await add_models(
        [
            transfer,
            transfer_history,
            initiative,
            initiative_history,
        ]
    )

    # Prepare request data
    pagination = {
        "page": 1,
        "size": 10,
        "filters": [],
        "sortOrders": [],
    }

    # Send request to get all user activities
    url = fastapi_app.url_path_for("get_all_user_activities")
    response = await client.post(url, json=pagination)

    assert response.status_code == status.HTTP_200_OK
    content = UserActivitiesResponseSchema(**response.json())
    assert len(content.activities) == 2  # Should have 2 activity records


@pytest.mark.anyio
async def test_get_all_user_activities_permission_denied(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    # Mock the current user as a user without ADMINISTRATOR role
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])

    # Prepare request data
    pagination = {
        "page": 1,
        "size": 10,
        "filters": [],
        "sortOrders": [],
    }

    # Send request to get all user activities
    url = fastapi_app.url_path_for("get_all_user_activities")
    response = await client.post(url, json=pagination)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_get_user_activities_user_not_found(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    # Mock the current user as an ADMINISTRATOR
    set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])

    # Non-existent user_id
    non_existent_user_id = 9999

    # Prepare request data
    pagination = {
        "page": 1,
        "size": 10,
        "filters": [],
        "sortOrders": [],
    }

    # Send request to get user activities for a non-existent user
    url = fastapi_app.url_path_for("get_user_activities", user_id=non_existent_user_id)
    response = await client.post(url, json=pagination)

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_get_all_user_login_history_as_administrator(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    # Mock the current user as an ADMINISTRATOR
    set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])

    # Prepare login history records for multiple users
    login_history_1 = UserLoginHistory(
        user_login_history_id=1,
        keycloak_email="admin1@example.com",
        external_username="admin_user1",
        keycloak_user_id="user1",
        is_login_successful=True,
        create_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
    )
    login_history_2 = UserLoginHistory(
        user_login_history_id=2,
        keycloak_email="admin2@example.com",
        external_username="admin_user2",
        keycloak_user_id="user2",
        is_login_successful=False,
        login_error_message="Invalid password",
        create_date=datetime.strptime("2024-01-02", "%Y-%m-%d"),
    )

    await add_models([login_history_1, login_history_2])

    # Prepare request data for pagination
    pagination = {
        "page": 1,
        "size": 10,
        "filters": [],
        "sortOrders": [],
    }

    # Send request to get all user login history
    url = fastapi_app.url_path_for("get_all_user_login_history")
    response = await client.post(url, json=pagination)

    assert response.status_code == status.HTTP_200_OK
    content = UserLoginHistoryResponseSchema(**response.json())
    assert len(content.histories) == 2  # Should retrieve 2 records


@pytest.mark.anyio
async def test_get_all_user_login_history_permission_denied(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    # Mock the current user without ADMINISTRATOR role
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])

    # Prepare request data for pagination
    pagination = {
        "page": 1,
        "size": 10,
        "filters": [],
        "sortOrders": [],
    }

    # Send request to get all user login history
    url = fastapi_app.url_path_for("get_all_user_login_history")
    response = await client.post(url, json=pagination)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_get_all_user_login_history_with_pagination(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    # Mock the current user as an ADMINISTRATOR
    set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])

    # Prepare login history records for testing pagination
    login_history_records = [
        UserLoginHistory(
            user_login_history_id=i,
            keycloak_email=f"user{i}@example.com",
            external_username=f"user_{i}",
            keycloak_user_id=f"user_id_{i}",
            is_login_successful=(i % 2 == 0),
            create_date=datetime.strptime("2024-01-01", "%Y-%m-%d"),
        )
        for i in range(1, 21)  # Assuming 20 records
    ]
    await add_models(login_history_records)

    # Request data for the first page with size 5
    pagination = {
        "page": 1,
        "size": 5,
        "filters": [],
        "sortOrders": [],
    }

    # Send request to get the first page of login history
    url = fastapi_app.url_path_for("get_all_user_login_history")
    response = await client.post(url, json=pagination)

    assert response.status_code == status.HTTP_200_OK
    content = UserLoginHistoryResponseSchema(**response.json())
    assert len(content.histories) == 5
    assert content.pagination.total == 20
    assert content.pagination.page == 1
    assert content.pagination.size == 5
    assert content.pagination.total_pages == 4


@pytest.mark.anyio
async def test_track_logged_in_success(client: AsyncClient, fastapi_app, set_mock_user):
    """Test successful tracking of user login."""
    # Arrange
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])  # Mock user with valid role
    url = "/api/users/logged-in"  # Adjust prefix if needed

    # Mock the UserServices method
    with patch(
        "lcfs.web.api.user.services.UserServices.track_user_login"
    ) as mock_track_user_login:
        mock_track_user_login.return_value = AsyncMock()

        # Act
        response = await client.post(url)

    # Assert
    assert response.status_code == status.HTTP_200_OK
    assert response.text == '"Tracked"'  # FastAPI returns JSON-compatible strings

    # Extract the first argument of the first call
    user_profile = mock_track_user_login.call_args[0][0]
    assert isinstance(user_profile, UserProfile)


@pytest.mark.anyio
async def test_update_email_success(
    client: AsyncClient,
    fastapi_app,
    set_mock_user,
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    # Prepare request data
    request_data = {"email": "new_email@domain.com"}

    # Act: Send POST request to the endpoint
    url = fastapi_app.url_path_for("update_email")
    response = await client.post(url, json=request_data)

    # Assert: Check response status and content
    assert response.status_code == status.HTTP_200_OK
