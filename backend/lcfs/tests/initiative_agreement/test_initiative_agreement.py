import pytest
from httpx import AsyncClient
from fastapi import FastAPI, status
from datetime import datetime


@pytest.mark.anyio
async def test_get_initiative_agreement(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(
        fastapi_app, ["Government"]
    )  # Assuming the role needed is 'Government'
    initiative_agreement_id = 1  # Assume that there exists an initiative agreement with ID 1 in the test database.
    url = fastapi_app.url_path_for(
        "get_initiative_agreement", initiative_agreement_id=initiative_agreement_id
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_create_initiative_agreement(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("create_initiative_agreement")
    initiative_agreement_payload = {
        "compliance_units": 100,
        "current_status": "Pending",
        "transaction_effective_date": datetime.now().isoformat(),
        "to_organization_id": 2,
        "gov_comment": "Initial setup of the initiative agreement.",
    }
    response = await client.post(url, json=initiative_agreement_payload)
    assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.anyio
async def test_update_initiative_agreement(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, ["Government"])
    initiative_agreement_id = (
        1  # Assume there is an initiative agreement with ID 1 in the test database.
    )
    url = fastapi_app.url_path_for(
        "update_initiative_agreement", initiative_agreement_id=initiative_agreement_id
    )
    initiative_agreement_update_payload = {
        "compliance_units": 150,
        "current_status": "Updated",
        "transaction_effective_date": datetime.now().isoformat(),
        "to_organization_id": 3,
        "gov_comment": "Updated initiative agreement.",
    }
    response = await client.put(url, json=initiative_agreement_update_payload)
    assert response.status_code == status.HTTP_200_OK


# Test to ensure validation prevents editing an approved initiative agreement
@pytest.mark.anyio
async def test_fail_update_approved_initiative_agreement(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, ["Government"])
    initiative_agreement_id = (
        2  # Assuming this agreement is marked as "Approved" in the test setup.
    )
    url = fastapi_app.url_path_for(
        "update_initiative_agreement", initiative_agreement_id=initiative_agreement_id
    )
    initiative_agreement_update_payload = {
        "compliance_units": 200,
        "current_status": "Approved",  # Attempting to update an approved agreement
        "transaction_effective_date": datetime.now().isoformat(),
        "to_organization_id": 4,
        "gov_comment": "Attempt to update approved agreement.",
    }
    response = await client.put(url, json=initiative_agreement_update_payload)
    assert response.status_code == status.HTTP_403_FORBIDDEN
