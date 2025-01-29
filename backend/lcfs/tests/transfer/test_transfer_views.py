from datetime import date

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.transfer.schema import TransferSchema
from lcfs.web.api.transfer.services import TransferServices
from lcfs.web.api.transfer.validation import TransferValidation


@pytest.mark.anyio
async def test_get_all_transfers_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_transfer_services,
):
    url = fastapi_app.url_path_for("get_all_transfers")

    mock_transfer_services.get_all_transfers.return_value = []

    fastapi_app.dependency_overrides[TransferServices] = lambda: mock_transfer_services

    response = await client.get(url)

    assert response.status_code == 200


@pytest.mark.anyio
async def test_get_transfer_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_transfer_services,
):
    transfer_id = 1
    url = fastapi_app.url_path_for("get_transfer", transfer_id=transfer_id)

    mock_transfer_services.get_transfer.return_value = TransferSchema(
        transfer_id=transfer_id,
        from_organization={"organization_id": 1, "name": "org1"},
        to_organization={"organization_id": 2, "name": "org2"},
        agreement_date=date.today(),
        quantity=1,
        price_per_unit=6.85,
        current_status={"transfer_status_id": 1, "status": "status"},
    )
    fastapi_app.dependency_overrides[TransferServices] = lambda: mock_transfer_services

    response = await client.get(url)

    assert response.status_code == 200

    data = response.json()

    assert data["transferId"] == transfer_id
    assert data["pricePerUnit"] == 6.85


@pytest.mark.anyio
async def test_government_update_transfer_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_transfer_services,
    mock_transfer_validation,
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    transfer_id = 1
    url = fastapi_app.url_path_for(
        "government_update_transfer", transfer_id=transfer_id
    )

    mock_transfer_validation.government_update_transfer.return_value = None
    mock_transfer_services.update_transfer.return_value = TransferSchema(
        transfer_id=transfer_id,
        from_organization={"organization_id": 1, "name": "org1"},
        to_organization={"organization_id": 2, "name": "org2"},
        agreement_date=date.today(),
        quantity=1,
        price_per_unit=7.25,
        current_status={"transfer_status_id": 1, "status": "status"},
    )
    fastapi_app.dependency_overrides[TransferServices] = lambda: mock_transfer_services
    fastapi_app.dependency_overrides[TransferValidation] = (
        lambda: mock_transfer_validation
    )

    payload = {
        "transfer_id": transfer_id,
        "from_organization_id": 1,
        "to_organization_id": 2,
        "price_per_unit": 7.25,
    }

    response = await client.put(url, json=payload)

    assert response.status_code == 200

    data = response.json()

    assert data["transferId"] == transfer_id
    assert data["pricePerUnit"] == 7.25


@pytest.mark.anyio
async def test_update_category_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_transfer_services,
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    transfer_id = 1
    url = fastapi_app.url_path_for("update_category", transfer_id=transfer_id)

    mock_transfer_services.update_category.return_value = {
        "transfer_id": transfer_id,
        "from_organization": {"organization_id": 1, "name": "org1"},
        "to_organization": {"organization_id": 2, "name": "org2"},
        "agreement_date": date.today(),
        "quantity": 1,
        "price_per_unit": 1,
        "current_status": {"transfer_status_id": 1, "status": "status"},
    }

    fastapi_app.dependency_overrides[TransferServices] = lambda: mock_transfer_services

    response = await client.put(url)

    assert response.status_code == 200

    data = response.json()

    assert data["transferId"] == transfer_id
