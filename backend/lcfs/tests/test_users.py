import pandas as pd
import numpy as np
from io import BytesIO
import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from starlette import status

from lcfs.web.api.user.schema import UsersSchema


@pytest.mark.anyio
async def test_export_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("export_users")
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.headers["Content-Type"] == "application/vnd.ms-excel"

    # Read the Excel content into a DataFrame
    excel_data = pd.read_excel(BytesIO(response.content), engine="xlrd")

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
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Analyst"])
    url = fastapi_app.url_path_for("export_users")
    response = await client.get(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_get_users_with_pagination(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
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
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
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
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_users")
    request_data = {
        "page": 1,
        "size": 10,
        "sortOrders": [],
        "filters": [
            {
                "filterType": "number",
                "type": "equals",
                "filter": "1",
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
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
) -> None:
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_user_by_id", user_id=1)
    response = await client.get(url)

    # Check the status code
    assert response.status_code == status.HTTP_200_OK
    # check the user_profile_id
    assert response.json()["user_profile_id"] == 1
