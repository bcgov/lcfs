import datetime

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from unittest.mock import MagicMock

from lcfs.web.api.initiative_agreement.schema import (
    InitiativeAgreementCreateSchema,
    InitiativeAgreementSchema,
    InitiativeAgreementUpdateSchema,
)
from lcfs.web.api.initiative_agreement.services import InitiativeAgreementServices
from lcfs.web.api.initiative_agreement.validation import InitiativeAgreementValidation


@pytest.fixture
def mock_initiative_agreement_services():
    return MagicMock(spec=InitiativeAgreementServices)


@pytest.fixture
def mock_initiative_agreement_validation():
    validation = MagicMock(spec=InitiativeAgreementValidation)

    validation.validate_initiative_agreement_update.return_value = None
    validation.validate_initiative_agreement_create.return_value = None

    return validation


@pytest.mark.anyio
async def test_get_initiative_agreement(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_initiative_agreement_services,
):
    set_mock_user_roles(fastapi_app, ["Government"])
    initiative_agreement_id = 1

    # Mock the service method
    mock_initiative_agreement_services.get_initiative_agreement.return_value = (
        InitiativeAgreementSchema(
            initiative_agreement_id=initiative_agreement_id,
            to_organization={"name": "name"},
            create_date=datetime.datetime.today().date().isoformat(),
            compliance_units=150,
            current_status={"initiative_agreement_status_id": 1, "status": "Updated"},
            to_organization_id=3,
            gov_comment="Updated initiative agreement.",
            history=[],
        )
    )

    # Use dependency override
    fastapi_app.dependency_overrides[InitiativeAgreementServices] = (
        lambda: mock_initiative_agreement_services
    )

    url = fastapi_app.url_path_for(
        "get_initiative_agreement", initiative_agreement_id=initiative_agreement_id
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["initiativeAgreementId"] == initiative_agreement_id


@pytest.mark.anyio
async def test_create_initiative_agreement(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_initiative_agreement_services,
    mock_initiative_agreement_validation,
):
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("create_initiative_agreement")
    initiative_agreement_payload = InitiativeAgreementCreateSchema(
        compliance_units=150,
        current_status="Updated",
        to_organization_id=3,
    )

    # Mock the service method
    mock_initiative_agreement_services.create_initiative_agreement.return_value = (
        InitiativeAgreementSchema(
            initiative_agreement_id=1,
            to_organization={"name": "name"},
            create_date=datetime.datetime.today().date().isoformat(),
            compliance_units=150,
            current_status={"initiative_agreement_status_id": 1, "status": "Updated"},
            to_organization_id=3,
            history=[],
        )
    )

    # Use dependency override
    fastapi_app.dependency_overrides[InitiativeAgreementServices] = (
        lambda: mock_initiative_agreement_services
    )
    fastapi_app.dependency_overrides[InitiativeAgreementValidation] = (
        lambda: mock_initiative_agreement_validation
    )

    data = initiative_agreement_payload.model_dump(by_alias=True)
    response = await client.post(url, json=data)
    assert response.status_code == status.HTTP_201_CREATED
    assert data["complianceUnits"] == 150


@pytest.mark.anyio
async def test_update_initiative_agreement(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_initiative_agreement_services,
    mock_initiative_agreement_validation,
):
    set_mock_user_roles(fastapi_app, ["Government"])
    initiative_agreement_id = 1
    url = fastapi_app.url_path_for("update_initiative_agreement")
    initiative_agreement_update_payload = InitiativeAgreementUpdateSchema(
        initiative_agreement_id=initiative_agreement_id,
        compliance_units=150,
        current_status="Updated",
        to_organization_id=3,
    )

    # Mock the service method
    mock_initiative_agreement_services.update_initiative_agreement.return_value = (
        InitiativeAgreementSchema(
            initiative_agreement_id=initiative_agreement_id,
            to_organization={"name": "name"},
            create_date=datetime.datetime.today().date().isoformat(),
            compliance_units=150,
            current_status={"initiative_agreement_status_id": 1, "status": "Updated"},
            to_organization_id=3,
            history=[],
        )
    )

    # Use dependency override
    fastapi_app.dependency_overrides[InitiativeAgreementServices] = (
        lambda: mock_initiative_agreement_services
    )
    fastapi_app.dependency_overrides[InitiativeAgreementValidation] = (
        lambda: mock_initiative_agreement_validation
    )

    response = await client.put(
        url, json=initiative_agreement_update_payload.model_dump(by_alias=True)
    )

    data = response.json()

    assert response.status_code == status.HTTP_200_OK
    assert data["complianceUnits"] == 150
