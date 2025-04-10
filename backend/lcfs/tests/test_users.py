import pandas as pd
import numpy as np
from io import BytesIO
import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from starlette import status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.user.schema import UsersSchema


@pytest.mark.anyio
async def test_export_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("export_users")
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert (
        response.headers["Content-Type"]
        == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

    # Read the Excel content into a DataFrame
    excel_data = pd.read_excel(BytesIO(response.content), engine="openpyxl")

    # Define expected column names
    expected_column_names = [
        "Last name",
        "First name",
        "Email",
        "BCeID User ID",
        "Title",
        "Phone",
        "Mobile",
        "Status",
        "Role(s)",
        "Organization name",
    ]

    # Check that the column names match the expected values
    for column in expected_column_names:
        assert (
            column in excel_data.columns
        ), f"Column {column} not found in exported data."


@pytest.mark.anyio
async def test_export_unauthorized_access(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])
    url = fastapi_app.url_path_for("export_users")
    response = await client.get(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_get_users_with_pagination(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("get_users")
    request_data = {"page": 1, "size": 5, "sortOrders": [], "filters": []}
    response = await client.post(url, json=request_data)

    # Check the status code
    assert response.status_code == status.HTTP_200_OK
    # check if pagination is working as expected.
    content = UsersSchema(**response.json())
    assert len(content.users) <= 5
    assert content.pagination.page == 1


@pytest.mark.anyio
async def test_get_users_with_sort_order(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("get_users")
    request_data = {
        "page": 1,
        "size": 10,
        "sortOrders": [{"field": "email", "direction": "desc"}],
        "filters": [],
    }
    response = await client.post(url, json=request_data)

    # Check the status code
    assert response.status_code == status.HTTP_200_OK

    content = UsersSchema(**response.json())
    emails = [user.email for user in content.users]
    # check if emails are sorted in descending order.
    assert np.all(emails[:-1] >= emails[1:])


@pytest.mark.anyio
async def test_get_users_with_filter(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("get_users")
    request_data = {
        "page": 1,
        "size": 10,
        "sortOrders": [],
        "filters": [
            {
                "filterType": "number",
                "type": "equals",
                "filter": 1,
                "field": "user_profile_id",
            }
        ],
    }
    response = await client.post(url, json=request_data)

    # Check the status code
    assert response.status_code == status.HTTP_200_OK
    # check if pagination is working as expected.

    content = UsersSchema(**response.json())
    ids = [user.user_profile_id for user in content.users]
    # check if only one user element exists with user_profile_id 1.
    assert len(ids) == 1
    assert ids[0] == 1


@pytest.mark.anyio
async def test_get_user_by_id(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = fastapi_app.url_path_for("get_user_by_id", user_id=1)
    response = await client.get(url)

    # Check the status code
    assert response.status_code == status.HTTP_200_OK
    # check the user_profile_id
    assert response.json()["userProfileId"] == 1


@pytest.mark.anyio
async def test_create_user_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
) -> None:
    # Setup mock roles for authorization
    set_mock_user(fastapi_app, [RoleEnum.ADMINISTRATOR])

    # Define the URL for the create user endpoint
    url = fastapi_app.url_path_for("create_user")

    # Define the payload for creating a new user
    user_data = {
        "title": "Mr.",
        "keycloak_username": "testuser",
        "keycloak_email": "testuser@example.com",
        "email": "testuser@example.com",  # Optional, but provided for clarity
        "phone": "1234567890",
        "mobile_phone": "0987654321",
        "first_name": "Test",
        "last_name": "User",
        "is_active": True,
        "organization_id": None,
        "roles": [RoleEnum.SUPPLIER.value],
    }

    # Make the POST request to create a new user
    response = await client.post(url, json=user_data)

    # Check that the user creation was successful
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json() == "User created successfully"
