import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from datetime import datetime

from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.db.models.transfer.TransferHistory import TransferHistory
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.initiative_agreement.InitiativeAgreementHistory import InitiativeAgreementHistory
from lcfs.db.models.admin_adjustment.AdminAdjustment import AdminAdjustment
from lcfs.db.models.admin_adjustment.AdminAdjustmentHistory import AdminAdjustmentHistory
from lcfs.web.api.user.schema import UserActivitiesResponseSchema

@pytest.mark.anyio
async def test_get_user_activities_as_administrator(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    # Mock the current user as an ADMINISTRATOR
    set_mock_user(fastapi_app, ["ADMINISTRATOR"])

    # Assuming user with user_profile_id=7 exists in the database
    target_user_id = 7 # LCFS 1

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
        transfer_status_id=3, # Sent
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
        initiative_agreement_status_id=2, # Approved
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
        admin_adjustment_status_id=2, # Approved
        user_profile_id=target_user_id,
    )

    await add_models([
        transfer,
        transfer_history,
        initiative,
        initiative_history,
        admin_adjustment,
        admin_adjustment_history,
    ])

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
    set_mock_user(fastapi_app, ["MANAGE_USERS"])

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
        transfer_status_id=3, # Sent
        user_profile_id=target_user_id,
    )

    await add_models([
        transfer,
        transfer_history,
    ])

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
    set_mock_user(fastapi_app, ["MANAGE_USERS"])

    # Assuming target user with user_profile_id=8 exists and is in organization_id=2
    target_user_id = 8

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

    assert response.status_code == status.HTTP_403_FORBIDDEN

@pytest.mark.anyio
async def test_get_all_user_activities_as_administrator(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    add_models,
):
    # Mock the current user as an ADMINISTRATOR
    set_mock_user(fastapi_app, ["ADMINISTRATOR"])

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
        transfer_status_id=3, # Sent
        user_profile_id=7, # LCFS 1
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
        initiative_agreement_status_id=2, # Approved
        user_profile_id=7, # LCFS 1
    )

    await add_models([
        transfer,
        transfer_history,
        initiative,
        initiative_history,
    ])

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
    set_mock_user(fastapi_app, ["ANALYST"])

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
    set_mock_user(fastapi_app, ["ADMINISTRATOR"])

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

    assert response.status_code == status.HTTP_403_FORBIDDEN
