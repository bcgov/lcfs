import pandas as pd
from datetime import datetime
from io import BytesIO

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient

from lcfs.utils.constants import LCFS_Constants
from lcfs.db.models.transfer.Transfer import Transfer, TransferRecommendationEnum
from lcfs.web.api.transaction.schema import TransactionListSchema, TransfersInProgressSchema


# Tests for exporting transactions
@pytest.mark.anyio
async def test_export_transactions_for_org_successful(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("export_transactions_for_org")
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.headers["Content-Type"] == "application/vnd.ms-excel"

    # Read the Excel content into a DataFrame
    excel_data = pd.read_excel(BytesIO(response.content), engine="xlrd")

    # Define expected column names
    expected_column_names = LCFS_Constants.TRANSACTIONS_EXPORT_COLUMNS

    # Check that the column names match the expected values
    for column in expected_column_names:
        assert (
            column in excel_data.columns
        ), f"Column {column} not found in exported data."

@pytest.mark.anyio
async def test_export_transactions_for_org_forbidden(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("export_transactions_for_org")
    response = await client.get(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN

# Tests for getting paginated transactions
@pytest.mark.anyio
async def test_get_transactions_paginated_for_org_successful(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models):
    transfer = Transfer(
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
        transaction_effective_date=datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
        price_per_unit=1.0,
        quantity=10,
        transfer_category_id=1,
        current_status_id=1,
        recommendation=TransferRecommendationEnum.Record,
        effective_status=True
    )

    await add_models([transfer])

    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_transactions_paginated_for_org")
    request_data = {"page": 1, "size": 5, "sortOrders": [], "filters": []}
    response = await client.post(url, json=request_data)

    # Check the status code
    assert response.status_code == status.HTTP_200_OK

    # check if pagination is working as expected
    content = TransactionListSchema(**response.json())
    assert len(content.transactions) == 1
    assert content.pagination.page == 1

@pytest.mark.anyio
async def test_get_transactions_paginated_for_org_forbidden(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Government"])
    url = fastapi_app.url_path_for("get_transactions_paginated_for_org")
    response = await client.post(url, json={})

    assert response.status_code == status.HTTP_403_FORBIDDEN

@pytest.mark.anyio
async def test_get_transactions_paginated_for_org_not_found(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_transactions_paginated_for_org")
    request_data = {"page": 1, "size": 5, "sortOrders": [], "filters": []}
    response = await client.post(url, json=request_data)

    # Check the status code
    assert response.status_code == status.HTTP_404_NOT_FOUND

@pytest.mark.anyio
async def test_count_transfers_in_progress(client: AsyncClient, fastapi_app: FastAPI, set_mock_user_roles, add_models):
    transfer_draft = Transfer(
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=datetime.strptime("2023-01-01", "%Y-%m-%d"),
        transaction_effective_date=datetime.strptime("2023-01-01", "%Y-%m-%d"),
        price_per_unit=1,
        quantity=10,
        transfer_category_id=1,
        current_status_id=1,
        recommendation=TransferRecommendationEnum.Record,
    )

    transfer_sent = Transfer(
        from_organization_id=1,
        to_organization_id=2,
        agreement_date=datetime.strptime("2023-01-01", "%Y-%m-%d"),
        transaction_effective_date=datetime.strptime("2023-01-01", "%Y-%m-%d"),
        price_per_unit=1,
        quantity=10,
        transfer_category_id=1,
        current_status_id=3,
        recommendation=TransferRecommendationEnum.Record,
    )

    transfer_submitted = Transfer(
        from_organization_id=2,
        to_organization_id=1,
        agreement_date=datetime.strptime("2023-01-01", "%Y-%m-%d"),
        transaction_effective_date=datetime.strptime("2023-01-01", "%Y-%m-%d"),
        price_per_unit=1,
        quantity=10,
        transfer_category_id=1,
        current_status_id=4,
        recommendation=TransferRecommendationEnum.Record,
    )

    await add_models([transfer_draft, transfer_sent, transfer_submitted])

    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("count_org_transfers_in_progress", organization_id=1)
    response = await client.get(url)

    # Check the status code
    assert response.status_code == status.HTTP_200_OK

    # Check if the count is as expected
    content = TransfersInProgressSchema(**response.json())
    assert content.transfers_in_progress == 3
