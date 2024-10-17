import pytest
from typing import List
from datetime import date
from lcfs.web.api.user.schema import UsersSchema
from unittest.mock import MagicMock
from lcfs.web.api.transaction.schema import TransactionListSchema, TransactionViewSchema


@pytest.mark.anyio
async def test_get_organization_users_list_success(
    organization_service, mock_user_repo
):
    mock_user_repo.get_users_paginated.return_value = ([], 0)

    result = await organization_service.get_organization_users_list(
        1,
        "status",
        MagicMock(),
    )

    assert isinstance(result, UsersSchema)
    mock_user_repo.get_users_paginated.assert_called_once()


@pytest.mark.anyio
async def test_get_transactions_paginated_success(
    organization_service, mock_transaction_repo
):
    mock_transaction_repo.get_transactions_paginated.return_value = (
        [
            {
                "transaction_id": 1,
                "transaction_type": "str",
                "to_organization": "str",
                "quantity": 1,
                "status": "str",
                "create_date": date.today(),
                "update_date": date.today(),
            }
        ],
        0,
    )

    pagination_mock = MagicMock()
    pagination_mock.page = 1
    pagination_mock.size = 10

    result = await organization_service.get_transactions_paginated(pagination_mock, 1)

    assert isinstance(result["transactions"][0], TransactionViewSchema)
    mock_transaction_repo.get_transactions_paginated.assert_called_once()
