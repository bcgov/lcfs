import pytest
from httpx import AsyncClient
from fastapi import FastAPI, status
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.transfer.repo import TransferRepository
from lcfs.tests.transfer.transfer_payloads import (
    transfer_orm_model,
    transfer_history_orm_model,
    transaction_orm_model,
    transfer_update_payload_3,
)


@pytest.fixture
def transaction_repo(dbsession):
    return TransactionRepository(db=dbsession)


@pytest.fixture
def transfer_repo(dbsession):
    return TransferRepository(db=dbsession)


@pytest.mark.anyio
async def test_update_transfer_recorded_forbidden(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    set_mock_user_roles(fastapi_app, ["SUPPLIER"])
    url = fastapi_app.url_path_for("update_transfer", transfer_id=1)
    response = await client.put(url, json={"current_status_id": 6})
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_update_transfer_sign_and_send_successful(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, transfer_repo
):
    transfer_id = 1
    set_mock_user_roles(fastapi_app, ["SUPPLIER", "SIGNING_AUTHORITY"])
    url = fastapi_app.url_path_for("update_transfer", transfer_id=transfer_id)

    response = await client.put(url, json={"current_status_id": 3})
    assert response.status_code == status.HTTP_200_OK

    transfer = await transfer_repo.get_transfer_by_id(transfer_id)
    assert transfer.current_status_id == 3
    assert transfer.from_transaction is not None


@pytest.mark.anyio
async def test_update_transfer_recorded_successful(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, transfer_repo
):
    transfer_id = 3
    set_mock_user_roles(fastapi_app, ["GOVERNMENT", "DIRECTOR"])
    url = fastapi_app.url_path_for("update_transfer", transfer_id=transfer_id)
    response = await client.put(url, json={"current_status_id": 6})
    assert response.status_code == status.HTTP_200_OK
    transfer = await transfer_repo.get_transfer_by_id(transfer_id)
    assert transfer.current_status_id == 6


@pytest.mark.anyio
async def test_update_transfer_recorded_order_failed(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles
):
    transfer_id = 1
    set_mock_user_roles(fastapi_app, ["GOVERNMENT", "DIRECTOR"])
    url = fastapi_app.url_path_for("update_transfer", transfer_id=transfer_id)
    response = await client.put(url, json={"current_status_id": 6})
    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


@pytest.mark.anyio
async def test_update_transfer_refused_successful(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    transfer_repo,
    add_models,
):
    transfer_orm_model.from_transaction_id = 1
    transaction_orm_model.transaction_id = 1
    await add_models(
        [transfer_orm_model, transfer_history_orm_model, transaction_orm_model]
    )

    transfer_id = 1
    set_mock_user_roles(fastapi_app, ["GOVERNMENT", "DIRECTOR"])
    url = fastapi_app.url_path_for(
        "government_update_transfer", transfer_id=transfer_id
    )

    response = await client.put(url, json=transfer_update_payload_3)
    assert response.status_code == status.HTTP_200_OK

    transfer = await transfer_repo.get_transfer_by_id(transfer_id)
    assert transfer.current_status_id == 7
